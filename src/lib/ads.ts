import { eq, inArray, type SQL } from "drizzle-orm";
import { type Db, db } from "@/db";
import { adVersions, ads, decisions, users } from "@/db/schema";
import { deriveStatus } from "./status";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function loadHistory(conn: Db | Tx, adIds: number[]) {
  if (adIds.length === 0) return { versionRows: [], decisionRows: [] };
  const versionRows = await conn
    .select({ id: adVersions.id, adId: adVersions.adId, number: adVersions.number, createdAt: adVersions.createdAt })
    .from(adVersions)
    .where(inArray(adVersions.adId, adIds));
  const decisionRows = await conn
    .select({
      id: decisions.id,
      adId: adVersions.adId,
      versionId: decisions.versionId,
      decision: decisions.decision,
      comment: decisions.comment,
      createdAt: decisions.createdAt,
    })
    .from(decisions)
    .innerJoin(adVersions, eq(adVersions.id, decisions.versionId))
    .where(inArray(adVersions.adId, adIds));
  return { versionRows, decisionRows };
}

export async function loadStatus(conn: Db | Tx, adId: number) {
  const { versionRows, decisionRows } = await loadHistory(conn, [adId]);
  return deriveStatus(versionRows, decisionRows);
}

// Ads matching `where`, each with its derived status, latest version and last approved version.
export async function loadAdSummaries(where?: SQL) {
  const rows = await db
    .select({ ad: ads, ownerName: users.name })
    .from(ads)
    .innerJoin(users, eq(users.id, ads.ownerId))
    .where(where);
  const { versionRows, decisionRows } = await loadHistory(
    db,
    rows.map((r) => r.ad.id),
  );

  return rows.map(({ ad, ownerName }) => ({
    ...ad,
    ownerName,
    ...deriveStatus(
      versionRows.filter((v) => v.adId === ad.id),
      decisionRows.filter((d) => d.adId === ad.id),
    ),
  }));
}

export type AdSummary = Awaited<ReturnType<typeof loadAdSummaries>>[number];
