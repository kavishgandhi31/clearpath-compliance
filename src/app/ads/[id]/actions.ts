"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { ads, decisionEnum, decisions, events, outbox, users } from "@/db/schema";
import { loadStatus } from "@/lib/ads";
import { requireUser } from "@/lib/auth";
import { parseId } from "@/lib/ids";
import type { Decision } from "@/lib/status";

export async function decide(
  adId: number,
  versionId: number,
  decision: Decision,
  comment: string,
): Promise<{ error?: string }> {
  const user = await requireUser("reviewer");
  if (!decisionEnum.enumValues.includes(decision)) throw new Error("Unknown decision.");
  const text = typeof comment === "string" ? comment.trim() : "";
  if (decision !== "approved" && !text) return { error: "Add a comment so the Submitter knows what to fix." };
  const requestHeaders = await headers();
  // Browsers send Origin with every Server Action call; a hand-made POST might not.
  const origin =
    requestHeaders.get("origin") ?? `${requestHeaders.get("x-forwarded-proto")}://${requestHeaders.get("host")}`;

  const error = await db.transaction(async (tx) => {
    // Locks the ad row so a decision can't interleave with a resubmit.
    const [ad] = parseId(adId) === null ? [] : await tx.select().from(ads).where(eq(ads.id, adId)).for("update");
    if (!ad) throw new Error("Unknown ad.");
    if (ad.ownerId === user.id) return "You can't review your own ad.";
    const { status, latestVersion } = await loadStatus(tx, adId);
    if (status !== "awaiting_review" || latestVersion?.id !== versionId) {
      return "This version is no longer waiting for review. Reload the page to see the latest.";
    }

    await tx.insert(decisions).values({ versionId, decision, reviewerId: user.id, comment: text || null });
    await tx.insert(events).values({
      adId,
      actorId: user.id,
      action: decision,
      details: { version: latestVersion.number, comment: text || null },
    });
    if (decision !== "approved") {
      const [owner] = await tx.select({ email: users.email }).from(users).where(eq(users.id, ad.ownerId));
      // A nudge only: the comment stays in the app, so the conversation doesn't move to email.
      await tx.insert(outbox).values({
        to: owner.email,
        subject: decision === "changes_requested" ? `Changes requested on ${ad.title}` : `Rejected: ${ad.title}`,
        body: `Open the ad to see the Reviewer's comment:\n${origin}/ads/${adId}/edit`,
        adId,
      });
    }
    return null;
  });
  if (error) return { error };
  refresh();
  return {};
}
