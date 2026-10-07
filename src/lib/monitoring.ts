import { and, desc, eq, getTableColumns, inArray, isNotNull, isNull } from "drizzle-orm";
import { type Db, db } from "@/db";
import { adVersions, alerts, decisions, pageScans } from "@/db/schema";
import type { AdSummary, Tx } from "./ads";

// Approved versions, newest first. The first one is the last approved version.
export function loadApprovedVersions(conn: Db | Tx, adId: number) {
  return conn
    .select(getTableColumns(adVersions))
    .from(adVersions)
    .innerJoin(decisions, and(eq(decisions.versionId, adVersions.id), eq(decisions.decision, "approved")))
    .where(eq(adVersions.adId, adId))
    .orderBy(desc(adVersions.number));
}

export type OpenAlert = typeof alerts.$inferSelect;

type Monitoring = {
  latestScan: { fetchedAt: Date; failureReason: string | null } | null;
  hasSuccessfulScan: boolean;
  liveVersionNumber: number | null;
  openAlert: OpenAlert | null;
};

// What each ad's live page looked like on its latest scans, and its open alert, for the Live version column.
export async function loadMonitoring(adSummaries: AdSummary[]): Promise<Map<number, Monitoring>> {
  const adIds = adSummaries.filter((ad) => ad.channel === "web_page").map((ad) => ad.id);
  const liveVersionIds = adSummaries.flatMap((ad) => (ad.liveVersionId === null ? [] : [ad.liveVersionId]));
  if (adIds.length === 0) return new Map();

  const [latestScans, successfulScans, liveVersions, openAlerts] = await Promise.all([
    db
      .selectDistinctOn([pageScans.adId], {
        adId: pageScans.adId,
        fetchedAt: pageScans.fetchedAt,
        failureReason: pageScans.failureReason,
      })
      .from(pageScans)
      .where(inArray(pageScans.adId, adIds))
      .orderBy(pageScans.adId, desc(pageScans.id)),
    db
      .selectDistinctOn([pageScans.adId], { adId: pageScans.adId })
      .from(pageScans)
      .where(and(inArray(pageScans.adId, adIds), isNotNull(pageScans.hash))),
    liveVersionIds.length === 0
      ? []
      : db.select({ id: adVersions.id, number: adVersions.number }).from(adVersions).where(inArray(adVersions.id, liveVersionIds)),
    db
      .select()
      .from(alerts)
      .where(and(inArray(alerts.adId, adIds), isNull(alerts.closedAt))),
  ]);

  return new Map(
    adSummaries.map((ad) => [
      ad.id,
      {
        latestScan: latestScans.find((scan) => scan.adId === ad.id) ?? null,
        hasSuccessfulScan: successfulScans.some((scan) => scan.adId === ad.id),
        liveVersionNumber: liveVersions.find((version) => version.id === ad.liveVersionId)?.number ?? null,
        openAlert: openAlerts.find((alert) => alert.adId === ad.id) ?? null,
      },
    ]),
  );
}

export type LiveStatus =
  | { kind: "not_monitored" }
  | { kind: "not_monitored_yet" }
  | { kind: "not_scanned" }
  | { kind: "matches"; version: number; scannedAt: Date }
  | { kind: "doesnt_match"; shows: number | null; scannedAt: Date }
  | { kind: "failed"; reason: string; lastMatch: { matches: boolean; shows: number | null } | null };

// ads.liveVersionId keeps the last successful scan's match, so a failed scan still shows the last successful result.
export function liveStatus(ad: AdSummary, monitoring: Monitoring | undefined): LiveStatus {
  if (ad.channel !== "web_page") return { kind: "not_monitored" };
  if (!ad.lastApprovedVersion) return { kind: "not_monitored_yet" };
  const latestScan = monitoring?.latestScan;
  if (!monitoring || !latestScan) return { kind: "not_scanned" };
  const matches = ad.liveVersionId === ad.lastApprovedVersion.id;
  const shows = monitoring.liveVersionNumber;
  if (latestScan.failureReason !== null) {
    return {
      kind: "failed",
      reason: latestScan.failureReason,
      lastMatch: monitoring.hasSuccessfulScan ? { matches, shows } : null,
    };
  }
  return matches
    ? { kind: "matches", version: ad.lastApprovedVersion.number, scannedAt: latestScan.fetchedAt }
    : { kind: "doesnt_match", shows, scannedAt: latestScan.fetchedAt };
}
