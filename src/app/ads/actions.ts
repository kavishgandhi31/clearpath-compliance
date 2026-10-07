"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { fetchContent, runCheck } from "@/check";
import type { CheckResult, ExtractedContent } from "@/check/types";
import { db } from "@/db";
import { adVersions, ads, affiliates, checks, events, flagNotes } from "@/db/schema";
import { loadStatus, type Tx } from "@/lib/ads";
import { requireUser } from "@/lib/auth";
import { type DraftInput, parseDraft, toDraftContent } from "@/lib/draft";
import { noteFor } from "@/lib/flags";
import { parseId } from "@/lib/ids";

export type ActionResult = { error?: string };

type User = Awaited<ReturnType<typeof requireUser>>;
type Ad = typeof ads.$inferSelect;
type Checked = { content: ExtractedContent; result: CheckResult };

const ALREADY_IN_REVIEW = "This ad is already waiting for review. You can submit again after the Reviewer decides.";

async function ownAffiliateIds(user: User) {
  const rows = await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.ownerId, user.id));
  return rows.map((row) => row.id);
}

async function loadOwnAd(adId: number, user: User) {
  const id = parseId(adId);
  const [ad] = id === null ? [] : await db.select().from(ads).where(eq(ads.id, id));
  if (!ad || ad.ownerId !== user.id) throw new Error("Only the ad's owner can change it.");
  return ad;
}

export async function createAd(input: DraftInput): Promise<ActionResult> {
  const user = await requireUser("submitter");
  const parsed = parseDraft(input, await ownAffiliateIds(user));
  if ("error" in parsed) return parsed;

  const adId = await db.transaction(async (tx) => {
    const [ad] = await tx
      .insert(ads)
      .values({ ...parsed.values, ownerId: user.id })
      .returning({ id: ads.id });
    await tx.insert(events).values({ adId: ad.id, actorId: user.id, action: "ad_created" });
    return ad.id;
  });
  redirect(`/ads/${adId}/edit`);
}

// Product, source and channel lock once a version exists: they decide which rules apply, so changing them would make earlier checks meaningless.
async function saveDraftValues(adId: number, input: DraftInput, user: User): Promise<{ error: string } | { ad: Ad }> {
  const ad = await loadOwnAd(adId, user);
  const { latestVersion } = await loadStatus(db, adId);
  const parsed = parseDraft(
    latestVersion
      ? { ...input, product: ad.product, source: ad.source, channel: ad.channel, affiliateId: String(ad.affiliateId) }
      : input,
    await ownAffiliateIds(user),
  );
  if ("error" in parsed) return parsed;

  const changed = (Object.keys(parsed.values) as (keyof typeof parsed.values)[]).filter(
    (key) => parsed.values[key] !== ad[key],
  );
  if (changed.length === 0) return { ad };

  return db.transaction(async (tx) => {
    const [saved] = await tx.update(ads).set(parsed.values).where(eq(ads.id, adId)).returning();
    await tx.insert(events).values({ adId, actorId: user.id, action: "draft_saved", details: { changed } });
    return { ad: saved };
  });
}

async function checkDraft(ad: Ad, user: User): Promise<{ error: string } | Checked> {
  const fetched = await fetchContent(toDraftContent(ad));
  if (!fetched.ok) {
    await db
      .insert(events)
      .values({ adId: ad.id, actorId: user.id, action: "check_failed", details: { reason: fetched.reason } });
    return { error: `Couldn't read the page: ${fetched.reason}` };
  }
  // runCheck throws when an AI step can't answer, so a failed check never passes as a clean one.
  try {
    const result = await runCheck({ product: ad.product, channel: ad.channel, source: ad.source }, fetched.content);
    return { content: fetched.content, result };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await db.insert(events).values({ adId: ad.id, actorId: user.id, action: "check_failed", details: { reason } });
    return { error: `The check couldn't finish. ${reason}` };
  }
}

async function insertCheck(tx: Tx, adId: number, versionId: number | null, { content, result }: Checked) {
  const [check] = await tx
    .insert(checks)
    .values({
      adId,
      versionId,
      contentHash: content.hash,
      rulesUsed: result.rulesUsed,
      model: result.model,
      flags: result.flags,
    })
    .returning({ id: checks.id });
  return check.id;
}

export async function saveDraft(adId: number, input: DraftInput): Promise<ActionResult> {
  const user = await requireUser("submitter");
  const saved = await saveDraftValues(adId, input, user);
  if ("error" in saved) return saved;
  refresh();
  return {};
}

export async function runDraftCheck(adId: number, input: DraftInput): Promise<ActionResult> {
  const user = await requireUser("submitter");
  const saved = await saveDraftValues(adId, input, user);
  if ("error" in saved) return saved;
  const checked = await checkDraft(saved.ad, user);
  if ("error" in checked) return checked;

  await db.transaction(async (tx) => {
    const checkId = await insertCheck(tx, adId, null, checked);
    await tx
      .insert(events)
      .values({ adId, actorId: user.id, action: "check_run", details: { checkId, flags: checked.result.flags.length } });
  });
  refresh();
  return {};
}

// Re-runs the check on the current draft and freezes it into the next version, but only if every flag has a note.
export async function submitAd(adId: number, input: DraftInput): Promise<ActionResult> {
  const user = await requireUser("submitter");
  const saved = await saveDraftValues(adId, input, user);
  if ("error" in saved) return saved;
  if ((await loadStatus(db, adId)).status === "awaiting_review") return { error: ALREADY_IN_REVIEW };
  const checked = await checkDraft(saved.ad, user);
  if ("error" in checked) return checked;

  const notes = await db.select().from(flagNotes).where(eq(flagNotes.adId, adId));
  const withoutNote = checked.result.flags.filter((flag) => !noteFor(flag, notes));

  if (withoutNote.length > 0) {
    await db.transaction(async (tx) => {
      const checkId = await insertCheck(tx, adId, null, checked);
      await tx.insert(events).values({
        adId,
        actorId: user.id,
        action: "submit_blocked",
        details: { checkId, flags: checked.result.flags.length, withoutNote: withoutNote.length },
      });
    });
    refresh();
    const suspicious = withoutNote.some((flag) => flag.kind === "suspicious_instructions");
    return {
      error: suspicious
        ? "Not submitted. The check found suspicious instructions, which can't get a note. Remove that text and try again."
        : `Not submitted. ${withoutNote.length === 1 ? "1 flag needs" : `${withoutNote.length} flags need`} a fix or a note.`,
    };
  }

  const { ad } = saved;
  const { content } = checked;
  const error = await db.transaction(async (tx) => {
    // Locks the ad row so two submits (or a submit and a decision) can't interleave.
    await tx.select({ id: ads.id }).from(ads).where(eq(ads.id, adId)).for("update");
    const { status, latestVersion } = await loadStatus(tx, adId);
    if (status === "awaiting_review") return ALREADY_IN_REVIEW;

    const number = (latestVersion?.number ?? 0) + 1;
    const [version] = await tx
      .insert(adVersions)
      .values({
        adId,
        number,
        subject: content.subject,
        url: ad.channel === "web_page" ? ad.draftUrl : null,
        visibleText: content.visibleText,
        hiddenText: content.hiddenText,
        hash: content.hash,
        createdVia: "submitted",
        createdById: user.id,
      })
      .returning({ id: adVersions.id });
    const checkId = await insertCheck(tx, adId, version.id, checked);
    await tx.insert(events).values({ adId, actorId: user.id, action: "submitted", details: { version: number, checkId } });
    return null;
  });
  if (error) return { error };
  redirect(`/ads/${adId}`);
}

export async function saveNote(adId: number, ruleId: string, quote: string | null, note: string): Promise<ActionResult> {
  const user = await requireUser("submitter");
  await loadOwnAd(adId, user);
  if (typeof ruleId !== "string" || (quote !== null && typeof quote !== "string")) throw new Error("Unknown flag.");
  const text = typeof note === "string" ? note.trim() : "";
  if (!text) return { error: "Write a note first." };

  await db.transaction(async (tx) => {
    await tx
      .insert(flagNotes)
      .values({ adId, ruleId, quote, note: text, authorId: user.id })
      .onConflictDoUpdate({
        target: [flagNotes.adId, flagNotes.ruleId, flagNotes.quote],
        set: { note: text, authorId: user.id },
      });
    await tx.insert(events).values({ adId, actorId: user.id, action: "note_saved", details: { ruleId, quote, note: text } });
  });
  refresh();
  return {};
}
