import { eq, sql } from "drizzle-orm";
import { hashContent } from "../check/hash";
import type { ExtractedContent, Flag, RuleSnapshot } from "../check/types";
import type { Db } from "./index";
import {
  adVersions,
  ads,
  affiliates,
  alerts,
  approvedTexts,
  checks,
  decisions,
  demoPages,
  events,
  flagNotes,
  outbox,
  pageScans,
  rules,
  users,
} from "./schema";
import {
  type DemoPageFields,
  type SeedAd,
  type SeedContent,
  approvedText,
  seedAds,
  seedAffiliates,
  seedApprovedTexts,
  seedDemoPages,
  seedRules,
  seedUsers,
} from "./seed-data";

const allTables = [
  users,
  approvedTexts,
  rules,
  affiliates,
  demoPages,
  ads,
  adVersions,
  decisions,
  pageScans,
  checks,
  flagNotes,
  alerts,
  events,
  outbox,
];

const AI_MODEL = "claude-sonnet-5-5";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type User = typeof users.$inferSelect;
type EventRow = typeof events.$inferInsert & { createdAt: Date };
type OutboxRow = typeof outbox.$inferInsert & { createdAt: Date };

type SeedContext = {
  at: (hoursAgo: number) => Date;
  owner: User;
  reviewer: User;
  affiliateId: number | null;
  rulesUsed: RuleSnapshot[];
  eventRows: EventRow[];
  outboxRows: OutboxRow[];
};

// Wipes every table and refills it with the starting data. Uses TRUNCATE because the events trigger rejects DELETE.
export async function resetAndSeed(db: Db) {
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE ${sql.join(allTables, sql`, `)} RESTART IDENTITY CASCADE`);
    const userRows = await tx.insert(users).values(seedUsers).returning();
    await tx.insert(approvedTexts).values(seedApprovedTexts);
    const ruleRows = await tx.insert(rules).values(seedRules).returning();
    await tx.insert(demoPages).values(seedDemoPages);

    const userNamed = (name: string) => userRows.find((user) => user.name === name)!;
    const reviewer = userRows.find((user) => user.role === "reviewer")!;
    const affiliateRows = await tx
      .insert(affiliates)
      .values(seedAffiliates.map(({ owner, ...affiliate }) => ({ ...affiliate, ownerId: userNamed(owner).id })))
      .returning();

    const eventRows: EventRow[] = [];
    const outboxRows: OutboxRow[] = [];
    for (const seedAd of seedAds) {
      await replayAd(tx, seedAd, {
        at,
        owner: userNamed(seedAd.owner),
        reviewer,
        affiliateId: affiliateRows.find((affiliate) => affiliate.name === seedAd.affiliate)?.id ?? null,
        rulesUsed: ruleRows
          .filter(
            (rule) =>
              rule.products.includes(seedAd.product) &&
              rule.channels.includes(seedAd.channel) &&
              rule.sources.includes(seedAd.source),
          )
          .sort((a, b) => (a.id < b.id ? -1 : 1)),
        eventRows,
        outboxRows,
      });
    }
    const byTime = (a: { createdAt: Date }, b: { createdAt: Date }) => a.createdAt.getTime() - b.createdAt.getTime();
    await tx.insert(events).values(eventRows.sort(byTime));
    await tx.insert(outbox).values(outboxRows.sort(byTime));
  });
}

// What the /demo/<slug> template shows, in page order. A seeded "Matches" only holds on a real re-scan if this is
// exactly the text extraction pulls from that page.
export function demoPageText(page: DemoPageFields) {
  const visible = [page.headline, page.body];
  if (page.showDisclosure) visible.push(approvedText("affiliate_disclosure"));
  return { visibleText: visible.join("\n"), hiddenText: page.hiddenText };
}

function extract(content: SeedContent): ExtractedContent {
  const parts =
    content.kind === "text"
      ? { subject: content.subject, visibleText: content.text, hiddenText: "" }
      : { subject: null, ...demoPageText(content.page) };
  return { ...parts, hash: hashContent(parts) };
}

// Hand-written flags must pass the same verification the real check applies before showing a flag.
function assertFlagsFit(title: string, content: ExtractedContent, flags: Flag[], rulesUsed: RuleSnapshot[]) {
  const text = [content.subject ?? "", content.visibleText, content.hiddenText].join("\n");
  for (const flag of flags) {
    if (flag.kind === "rule" && !rulesUsed.some((rule) => rule.id === flag.ruleId)) {
      throw new Error(`${title}: rule ${flag.ruleId} doesn't apply to this ad`);
    }
    if (flag.quote !== null && !text.includes(flag.quote)) {
      throw new Error(`${title}: quote isn't in the content: "${flag.quote}"`);
    }
  }
}

async function replayAd(
  tx: Tx,
  seedAd: SeedAd,
  { at, owner, reviewer, affiliateId, rulesUsed, eventRows, outboxRows }: SeedContext,
) {
  const draft = seedAd.draft ?? seedAd.versions!.at(-1)!.content;
  const [ad] = await tx
    .insert(ads)
    .values({
      title: seedAd.title,
      product: seedAd.product,
      channel: seedAd.channel,
      source: seedAd.source,
      affiliateId,
      ownerId: owner.id,
      draftSubject: draft.kind === "text" ? draft.subject : null,
      draftText: draft.kind === "text" ? draft.text : null,
      draftUrl: draft.kind === "page" ? draft.url : null,
      createdAt: at(seedAd.createdHoursAgo),
    })
    .returning();

  const log = (hoursAgo: number, actor: User, action: string, details: Record<string, unknown> = {}) =>
    eventRows.push({ adId: ad.id, actorId: actor.id, action, details, createdAt: at(hoursAgo) });

  const insertCheck = async (
    hoursAgo: number,
    content: ExtractedContent,
    flags: Flag[],
    link: { versionId?: number; pageScanId?: number },
  ) => {
    assertFlagsFit(seedAd.title, content, flags, rulesUsed);
    const [check] = await tx
      .insert(checks)
      .values({ adId: ad.id, ...link, contentHash: content.hash, rulesUsed, model: AI_MODEL, flags, createdAt: at(hoursAgo) })
      .returning();
    return check;
  };

  log(seedAd.createdHoursAgo, owner, "ad_created");

  for (const draftCheck of seedAd.draftChecks ?? []) {
    const check = await insertCheck(draftCheck.hoursAgo, extract(draftCheck.content), draftCheck.flags, {});
    log(draftCheck.hoursAgo, owner, "check_run", { checkId: check.id, flags: draftCheck.flags.length });
  }

  for (const { hoursAgo, ruleId, quote, note } of seedAd.notes ?? []) {
    await tx.insert(flagNotes).values({ adId: ad.id, ruleId, quote, note, authorId: owner.id, createdAt: at(hoursAgo) });
    log(hoursAgo, owner, "note_saved", { ruleId, note });
  }

  const approved: { id: number; number: number; hash: string }[] = [];
  for (const [index, version] of (seedAd.versions ?? []).entries()) {
    const number = index + 1;
    const content = extract(version.content);
    const [row] = await tx
      .insert(adVersions)
      .values({
        adId: ad.id,
        number,
        subject: content.subject,
        url: version.content.kind === "page" ? version.content.url : null,
        visibleText: content.visibleText,
        hiddenText: content.hiddenText,
        hash: content.hash,
        createdVia: "submitted",
        createdById: owner.id,
        createdAt: at(version.hoursAgo),
      })
      .returning();
    const check = await insertCheck(version.hoursAgo, content, version.flags, { versionId: row.id });
    log(version.hoursAgo, owner, "submitted", { version: number, checkId: check.id });

    const { decision } = version;
    if (!decision) continue;
    await tx.insert(decisions).values({
      versionId: row.id,
      decision: decision.decision,
      reviewerId: reviewer.id,
      comment: decision.comment,
      createdAt: at(decision.hoursAgo),
    });
    log(decision.hoursAgo, reviewer, decision.decision, { version: number, comment: decision.comment });

    if (decision.decision === "approved") {
      approved.push({ id: row.id, number, hash: content.hash });
    } else {
      outboxRows.push({
        to: owner.email,
        subject:
          decision.decision === "changes_requested" ? `Changes requested on ${ad.title}` : `Rejected: ${ad.title}`,
        body: `Open the ad to see the Reviewer's comment:\n/ads/${ad.id}/edit`,
        adId: ad.id,
        createdAt: at(decision.hoursAgo),
      });
    }
  }

  let liveVersionId: number | null = null;
  let lastScannedAt: Date | null = null;
  for (const scan of seedAd.scans ?? []) {
    lastScannedAt = at(scan.hoursAgo);
    if ("failureReason" in scan) {
      const [row] = await tx
        .insert(pageScans)
        .values({ adId: ad.id, fetchedAt: lastScannedAt, failureReason: scan.failureReason })
        .returning();
      log(scan.hoursAgo, reviewer, "page_scanned", { scanId: row.id, result: "failed", failureReason: scan.failureReason });
      continue;
    }

    const live = extract(scan.content);
    const matched = approved.findLast((version) => version.hash === live.hash);
    const matchesLastApproved = matched !== undefined && matched === approved.at(-1);
    const [row] = await tx
      .insert(pageScans)
      .values({
        adId: ad.id,
        fetchedAt: lastScannedAt,
        visibleText: live.visibleText,
        hiddenText: live.hiddenText,
        hash: live.hash,
        matchedVersionId: matched?.id ?? null,
      })
      .returning();
    liveVersionId = matched?.id ?? null;
    log(scan.hoursAgo, reviewer, "page_scanned", {
      scanId: row.id,
      result: matchesLastApproved ? "matched" : "changed",
      matchedVersion: matched?.number ?? null,
    });
    if (matchesLastApproved) continue;

    if (!scan.flags) {
      throw new Error(`${seedAd.title}: a scan that doesn't match the last approved version needs its check's flags`);
    }
    await insertCheck(scan.hoursAgo, live, scan.flags, { pageScanId: row.id });
    const color = scan.flags.length ? "red" : "gray";
    const [alert] = await tx
      .insert(alerts)
      .values({ adId: ad.id, latestScanId: row.id, color, openedAt: lastScannedAt })
      .returning();
    log(scan.hoursAgo, reviewer, "alert_opened", { alertId: alert.id, color });
  }

  if (lastScannedAt) {
    await tx.update(ads).set({ liveVersionId, lastScannedAt }).where(eq(ads.id, ad.id));
  }
}
