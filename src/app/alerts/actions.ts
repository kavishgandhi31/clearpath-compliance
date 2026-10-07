"use server";

import { diffWords } from "diff";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { fetchContent, runCheck } from "@/check";
import type { CheckResult } from "@/check/types";
import { db } from "@/db";
import { adVersions, ads, affiliates, alerts, checks, decisions, events, outbox, pageScans, users } from "@/db/schema";
import { loadStatus } from "@/lib/ads";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { parseId } from "@/lib/ids";
import { suspiciousApproveMessage } from "@/lib/labels";
import { loadApprovedVersions } from "@/lib/monitoring";

export type ActionResult = { error?: string };

async function loadAd(adId: number) {
  const id = parseId(adId);
  const [ad] = id === null ? [] : await db.select().from(ads).where(eq(ads.id, id));
  if (!ad || ad.channel !== "web_page") throw new Error("Unknown web page ad.");
  return ad;
}

async function loadAlert(alertId: number) {
  const id = parseId(alertId);
  const [alert] = id === null ? [] : await db.select().from(alerts).where(eq(alerts.id, id));
  if (!alert) throw new Error("Unknown alert.");
  return alert;
}

// Fetches the live page and compares it with the last approved version. A match closes the open alert. A failed fetch
// is recorded with no alert. Anything else runs the full check on the live text and opens the ad's alert or updates it.
export async function rescan(adId: number): Promise<ActionResult> {
  const user = await requireUser("reviewer");
  const ad = await loadAd(adId);
  const [approved] = await loadApprovedVersions(db, ad.id);
  if (!approved) return { error: "This ad has no approved version to compare the live page with." };

  const fetchedAt = new Date();
  const fetched = await fetchContent({ kind: "web_page", url: approved.url ?? "" });
  let checked: CheckResult | null = null;
  let reusedCheckId: number | null = null;
  if (fetched.ok && fetched.content.hash !== approved.hash) {
    // The open alert already has a check of this exact text, so re-scanning an unchanged page costs no AI call.
    const [previous] = await db
      .select({ check: checks })
      .from(alerts)
      .innerJoin(pageScans, eq(pageScans.id, alerts.latestScanId))
      .innerJoin(checks, eq(checks.pageScanId, pageScans.id))
      .where(and(eq(alerts.adId, ad.id), isNull(alerts.closedAt), eq(pageScans.hash, fetched.content.hash)))
      .orderBy(desc(checks.id))
      .limit(1);
    if (previous) {
      checked = { flags: previous.check.flags, rulesUsed: previous.check.rulesUsed, model: previous.check.model };
      reusedCheckId = previous.check.id;
    } else {
      // runCheck throws when an AI step can't answer. The scan isn't saved then, so a changed page never shows without its flags.
      try {
        checked = await runCheck({ product: ad.product, channel: ad.channel, source: ad.source }, fetched.content);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await db.insert(events).values({ adId: ad.id, actorId: user.id, action: "check_failed", details: { reason } });
        return { error: `The page changed, but the check couldn't finish: ${reason} Try Re-scan again.` };
      }
    }
  }

  const error = await db.transaction(async (tx) => {
    // The same lock Submit and Approve as-is take, so the last approved version can't change under this scan.
    await tx.select({ id: ads.id }).from(ads).where(eq(ads.id, ad.id)).for("update");
    const approvedVersions = await loadApprovedVersions(tx, ad.id);
    if (approvedVersions[0]?.id !== approved.id) return "A new version was approved while the page was being scanned. Re-scan again.";
    const log = (action: string, details: Record<string, unknown>) =>
      tx.insert(events).values({ adId: ad.id, actorId: user.id, action, details });

    if (!fetched.ok) {
      const [scan] = await tx
        .insert(pageScans)
        .values({ adId: ad.id, fetchedAt, failureReason: fetched.reason })
        .returning({ id: pageScans.id });
      await tx.update(ads).set({ lastScannedAt: fetchedAt }).where(eq(ads.id, ad.id));
      await log("page_scanned", { scanId: scan.id, result: "failed", failureReason: fetched.reason });
      return null;
    }

    const live = fetched.content;
    const matched = approvedVersions.find((version) => version.hash === live.hash) ?? null;
    const [scan] = await tx
      .insert(pageScans)
      .values({
        adId: ad.id,
        fetchedAt,
        visibleText: live.visibleText,
        hiddenText: live.hiddenText,
        hash: live.hash,
        matchedVersionId: matched?.id ?? null,
      })
      .returning({ id: pageScans.id });
    await tx
      .update(ads)
      .set({ liveVersionId: matched?.id ?? null, lastScannedAt: fetchedAt })
      .where(eq(ads.id, ad.id));
    await log("page_scanned", {
      scanId: scan.id,
      result: checked ? "changed" : "matched",
      matchedVersion: matched?.number ?? null,
      ...(reusedCheckId !== null && { reusedCheckId }),
    });

    const [openAlert] = await tx
      .select()
      .from(alerts)
      .where(and(eq(alerts.adId, ad.id), isNull(alerts.closedAt)));
    if (!checked) {
      if (openAlert) {
        await tx
          .update(alerts)
          .set({ closedAt: new Date(), resolution: "page_matches" })
          .where(eq(alerts.id, openAlert.id));
        await log("alert_closed", { alertId: openAlert.id, resolution: "page_matches" });
      }
      return null;
    }

    await tx.insert(checks).values({
      adId: ad.id,
      pageScanId: scan.id,
      contentHash: live.hash,
      rulesUsed: checked.rulesUsed,
      model: checked.model,
      flags: checked.flags,
    });
    const color = checked.flags.length > 0 ? "red" : "gray";
    if (openAlert) {
      await tx.update(alerts).set({ latestScanId: scan.id, color }).where(eq(alerts.id, openAlert.id));
      await log("alert_updated", { alertId: openAlert.id, color });
    } else {
      const [alert] = await tx
        .insert(alerts)
        .values({ adId: ad.id, latestScanId: scan.id, color })
        .returning({ id: alerts.id });
      await log("alert_opened", { alertId: alert.id, color });
    }
    return null;
  });
  if (error) return { error };
  refresh();
  return {};
}

// Approves the live text the Reviewer was looking at (scanId) as a new version, then compares it with the newest scan:
// if the page changed again meanwhile, the alert stays open with the newer text.
export async function approveAsIs(alertId: number, scanId: number): Promise<ActionResult> {
  const user = await requireUser("reviewer");
  const { adId } = await loadAlert(alertId);

  const error = await db.transaction(async (tx) => {
    // The same lock Submit takes, so the new version's number can't collide with a resubmit.
    await tx.select({ id: ads.id }).from(ads).where(eq(ads.id, adId)).for("update");
    const [alert] = await tx.select().from(alerts).where(eq(alerts.id, alertId));
    if (alert.closedAt) return "This alert is already closed. Reload the page to see the latest.";
    const { status, latestVersion } = await loadStatus(tx, adId);
    if (!latestVersion) throw new Error("An alert needs an approved version.");
    if (status === "awaiting_review") return `v${latestVersion.number} is waiting for review. Decide on it first.`;
    const id = parseId(scanId);
    const [scan] =
      id === null
        ? []
        : await tx
            .select()
            .from(pageScans)
            .where(and(eq(pageScans.id, id), eq(pageScans.adId, adId), isNotNull(pageScans.hash)));
    if (!scan) throw new Error("Unknown scan.");
    const [check] = await tx
      .select({ flags: checks.flags })
      .from(checks)
      .where(eq(checks.pageScanId, scan.id))
      .orderBy(desc(checks.id))
      .limit(1);
    // Same rule as Submit: suspicious instructions can't be waved through.
    if (check?.flags.some((flag) => flag.kind === "suspicious_instructions")) return suspiciousApproveMessage;
    const [approved] = await loadApprovedVersions(tx, adId);

    const number = latestVersion.number + 1;
    const [version] = await tx
      .insert(adVersions)
      .values({
        adId,
        number,
        url: approved.url,
        visibleText: scan.visibleText ?? "",
        hiddenText: scan.hiddenText ?? "",
        hash: scan.hash!,
        createdVia: "approved_from_alert",
        createdById: user.id,
      })
      .returning({ id: adVersions.id });
    await tx.insert(decisions).values({ versionId: version.id, decision: "approved", reviewerId: user.id });
    await tx.insert(events).values({ adId, actorId: user.id, action: "approved_as_is", details: { alertId, version: number } });

    const [newest] = await tx
      .select({ hash: pageScans.hash })
      .from(pageScans)
      .where(and(eq(pageScans.adId, adId), isNotNull(pageScans.hash)))
      .orderBy(desc(pageScans.id))
      .limit(1);
    if (newest.hash === scan.hash) {
      await tx.update(alerts).set({ closedAt: new Date(), resolution: "approved_as_is" }).where(eq(alerts.id, alertId));
      await tx.update(ads).set({ liveVersionId: version.id }).where(eq(ads.id, adId));
      await tx
        .insert(events)
        .values({ adId, actorId: user.id, action: "alert_closed", details: { alertId, resolution: "approved_as_is" } });
    }
    return null;
  });
  if (error) return { error };
  refresh();
  return {};
}

function changeLines(label: string, before: string, after: string): string[] {
  return diffWords(before, after).flatMap((part) => {
    const words = part.value.replace(/\s+/g, " ").trim();
    if (!words || (!part.added && !part.removed)) return [];
    return [`${part.added ? "Added" : "Removed"}${label}: "${words}"`];
  });
}

function pageText(visibleText: string, hiddenText: string): string {
  return hiddenText ? `${visibleText}\n\nHidden text:\n${hiddenText}` : visibleText;
}

// Emails the evidence to whoever can fix the page: the affiliate's contact with the owning Partner Manager on Cc, or the
// ad owner for a ClearPath page. The alert stays open until a scan matches or the Reviewer approves the live text.
export async function requestFix(alertId: number): Promise<ActionResult> {
  const user = await requireUser("reviewer");
  const alert = await loadAlert(alertId);
  if (alert.closedAt) return { error: "This alert is already closed. Reload the page to see the latest." };

  const [[ad], [scan], [approved]] = await Promise.all([
    db.select().from(ads).where(eq(ads.id, alert.adId)),
    db.select().from(pageScans).where(eq(pageScans.id, alert.latestScanId)),
    loadApprovedVersions(db, alert.adId),
  ]);
  const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, ad.ownerId));
  const [affiliate] =
    ad.affiliateId === null
      ? []
      : await db
          .select({ contactEmail: affiliates.contactEmail, ownerEmail: users.email })
          .from(affiliates)
          .innerJoin(users, eq(users.id, affiliates.ownerId))
          .where(eq(affiliates.id, ad.affiliateId));

  const requestHeaders = await headers();
  // Browsers send Origin with every Server Action call; a hand-made POST might not.
  const origin =
    requestHeaders.get("origin") ?? `${requestHeaders.get("x-forwarded-proto")}://${requestHeaders.get("host")}`;
  const pageUrl = approved.url?.startsWith("/") ? `${origin}${approved.url}` : (approved.url ?? "");
  const liveVisible = scan.visibleText ?? "";
  const liveHidden = scan.hiddenText ?? "";
  const opening = affiliate
    ? `Your page at ${pageUrl} changed after ClearPath approved it. Please change it back to the approved text below, or send the new version to your ClearPath Partner Manager for review.`
    : `Your page at ${pageUrl} changed after it was approved. Please change it back to the approved text below, or submit the new version for review:\n${origin}/ads/${ad.id}/edit`;
  const body = [
    opening,
    `Spotted: ${formatDateTime(scan.fetchedAt)}`,
    [
      "What changed:",
      ...changeLines("", approved.visibleText, liveVisible),
      ...changeLines(" (hidden text)", approved.hiddenText, liveHidden),
    ].join("\n"),
    `Approved text (v${approved.number}):\n${pageText(approved.visibleText, approved.hiddenText)}`,
    `Live text:\n${pageText(liveVisible, liveHidden)}`,
  ].join("\n\n");

  const to = affiliate ? affiliate.contactEmail : owner.email;
  const cc = affiliate ? affiliate.ownerEmail : null;
  await db.transaction(async (tx) => {
    await tx.insert(outbox).values({ to, cc, subject: `Fix requested: ${ad.title}`, body, adId: ad.id });
    await tx.insert(events).values({ adId: ad.id, actorId: user.id, action: "fix_requested", details: { alertId, to, cc } });
  });
  refresh();
  return {};
}
