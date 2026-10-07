import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdForm } from "@/components/ad-form";
import { FlagList, SuspiciousBanner } from "@/components/flag-list";
import { StatusBadge } from "@/components/status-badge";
import { Suggestions } from "@/components/suggestions";
import { db } from "@/db";
import { ads, affiliates, approvedTexts, checks, events, flagNotes } from "@/db/schema";
import { loadAdSummaries } from "@/lib/ads";
import { requireUser } from "@/lib/auth";
import { draftInputFrom } from "@/lib/draft";
import { noteFor, numberFlags } from "@/lib/flags";
import { formatAgo } from "@/lib/format";
import { parseId } from "@/lib/ids";
import { decisionLabels } from "@/lib/labels";

// Server Actions called from this page (Run check, Submit) inherit this limit. The check's worst case is about 155s: two tries of the 60s rule check plus two of the 15s injection guard.
export const maxDuration = 180;

export default async function EditAdPage(props: PageProps<"/ads/[id]/edit">) {
  const user = await requireUser("submitter");
  const adId = parseId((await props.params).id);
  const [ad] = adId === null ? [] : await loadAdSummaries(eq(ads.id, adId));
  if (!ad) notFound();
  if (ad.ownerId !== user.id) redirect(`/ads/${ad.id}`);

  const [myAffiliates, [latestCheck], notes, [lastSave]] = await Promise.all([
    db
      .select({ id: affiliates.id, name: affiliates.name })
      .from(affiliates)
      .where(eq(affiliates.ownerId, user.id))
      .orderBy(asc(affiliates.name)),
    db
      .select()
      .from(checks)
      .where(and(eq(checks.adId, ad.id), isNull(checks.pageScanId)))
      .orderBy(desc(checks.id))
      .limit(1),
    db.select().from(flagNotes).where(eq(flagNotes.adId, ad.id)),
    db
      .select({ createdAt: events.createdAt })
      .from(events)
      .where(and(eq(events.adId, ad.id), eq(events.action, "draft_saved")))
      .orderBy(desc(events.id))
      .limit(1),
  ]);

  const flags = latestCheck ? numberFlags(latestCheck.flags, latestCheck.rulesUsed) : [];
  const suggestedIds = flags.flatMap(({ flag }) => (flag.kind === "rule" && flag.approvedTextId ? [flag.approvedTextId] : []));
  const suggestedTexts = suggestedIds.length
    ? await db.select().from(approvedTexts).where(inArray(approvedTexts.id, suggestedIds))
    : [];
  const withoutNote = flags.filter(({ flag }) => !noteFor(flag, notes)).length;
  const checkIsStale = latestCheck && lastSave && lastSave.createdAt > latestCheck.createdAt;
  const inReview = ad.status === "awaiting_review";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{ad.title}</h1>
        <StatusBadge status={ad.status} version={ad.latestVersion?.number} />
        {ad.latestVersion && (
          <Link href={`/ads/${ad.id}`} className="ml-auto text-sm underline underline-offset-3">
            Ad page
          </Link>
        )}
      </div>

      {ad.latestDecision && ad.status !== "approved" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">
            {decisionLabels[ad.latestDecision.decision]} on v{ad.latestVersion?.number} ·{" "}
            {formatAgo(ad.latestDecision.createdAt)}
          </p>
          {ad.latestDecision.comment && <p className="mt-1 whitespace-pre-wrap">“{ad.latestDecision.comment}”</p>}
        </div>
      )}
      {inReview && (
        <div className="rounded-lg border bg-muted px-4 py-3 text-sm">
          Version {ad.latestVersion?.number} is with the Reviewer. You can&apos;t submit again until they approve it,
          request changes or reject it. Meanwhile you can keep editing this draft and running the check.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">Edit your ad</h2>
            <p className="text-sm text-muted-foreground">
              Your changes are saved as a draft. The Reviewer only sees them after you submit.
            </p>
          </div>
          <AdForm
            adId={ad.id}
            initial={draftInputFrom(ad)}
            affiliates={myAffiliates}
            locked={ad.latestVersion !== null}
            submitLocked={inReview}
          />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-medium">Check results</h2>
            {latestCheck && (
              <Link href={`/checks/${latestCheck.id}`} className="text-xs text-muted-foreground underline underline-offset-3">
                Check #{latestCheck.id} · {formatAgo(latestCheck.createdAt)}
              </Link>
            )}
          </div>
          {!latestCheck ? (
            <p className="text-sm text-muted-foreground">Run the check to see flags and suggestions.</p>
          ) : (
            <>
              {checkIsStale && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  You&apos;ve changed the draft since this check. Run the check again to update the flags.
                </div>
              )}
              <SuspiciousBanner flags={flags} />
              <p className="text-sm text-muted-foreground">
                {flags.length === 0
                  ? "No flags."
                  : withoutNote === 0
                    ? `${flags.length} ${flags.length === 1 ? "flag" : "flags"}, all with notes.`
                    : `${flags.length} ${flags.length === 1 ? "flag" : "flags"}, ${withoutNote} still ${withoutNote === 1 ? "needs" : "need"} a fix or a note.`}
                {withoutNote === 0 && !inReview && " Ready to submit."}
              </p>
              {flags.length > 0 && (
                <div className="text-sm">
                  <FlagList flags={flags} notes={notes} editableAdId={ad.id} />
                </div>
              )}
              <div className="text-sm">
                <Suggestions flags={flags} approvedTexts={suggestedTexts} />
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
