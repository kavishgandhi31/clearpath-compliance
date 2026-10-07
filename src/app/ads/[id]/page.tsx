import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AuditLog } from "@/components/audit-log";
import { DecisionPanel } from "@/components/decision-panel";
import { FlagList, issueCounts, SuspiciousBanner } from "@/components/flag-list";
import { HighlightedText } from "@/components/highlighted-text";
import { RescanButton } from "@/components/rescan-button";
import { LiveVersion, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { WhatChanged } from "@/components/what-changed";
import { DEMO_PAGE_PATH } from "@/check/demo-page";
import { db } from "@/db";
import { adVersions, ads, affiliates, checks, decisions, events, flagNotes, rules, users } from "@/db/schema";
import { loadAdSummaries } from "@/lib/ads";
import { requireUser } from "@/lib/auth";
import { numberFlags } from "@/lib/flags";
import { formatAgo } from "@/lib/format";
import type { Mark } from "@/lib/highlight";
import { parseId } from "@/lib/ids";
import { channelLabels, createdViaLabels, decisionLabels, productLabels, sourceLabels } from "@/lib/labels";
import { liveStatus, loadMonitoring } from "@/lib/monitoring";

// Re-scan runs the full check when the page changed. Same limit as the edit page's Run check and Submit.
export const maxDuration = 180;

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function AdPage(props: PageProps<"/ads/[id]">) {
  const user = await requireUser();
  const adId = parseId((await props.params).id);
  const [ad] = adId === null ? [] : await loadAdSummaries(eq(ads.id, adId));
  if (!ad) notFound();

  const [affiliateRows, versionRows, decisionRows, notes, eventRows, ruleRows, monitoring] = await Promise.all([
    ad.affiliateId === null
      ? []
      : db.select({ name: affiliates.name }).from(affiliates).where(eq(affiliates.id, ad.affiliateId)),
    db
      .select({ version: adVersions, createdByName: users.name })
      .from(adVersions)
      .innerJoin(users, eq(users.id, adVersions.createdById))
      .where(eq(adVersions.adId, ad.id))
      .orderBy(desc(adVersions.number)),
    db
      .select({ decision: decisions, reviewerName: users.name })
      .from(decisions)
      .innerJoin(adVersions, eq(adVersions.id, decisions.versionId))
      .innerJoin(users, eq(users.id, decisions.reviewerId))
      .where(eq(adVersions.adId, ad.id))
      .orderBy(asc(decisions.id)),
    db.select().from(flagNotes).where(eq(flagNotes.adId, ad.id)),
    db
      .select({
        id: events.id,
        action: events.action,
        details: events.details,
        createdAt: events.createdAt,
        actorName: users.name,
      })
      .from(events)
      .leftJoin(users, eq(users.id, events.actorId))
      .where(eq(events.adId, ad.id))
      .orderBy(asc(events.id)),
    db.select({ id: rules.id, name: rules.name }).from(rules),
    loadMonitoring([ad]),
  ]);
  const live = liveStatus(ad, monitoring.get(ad.id));
  const openAlert = monitoring.get(ad.id)?.openAlert ?? null;

  const requested = Number((await props.searchParams).v);
  const selected = versionRows.find(({ version }) => version.number === requested) ?? versionRows[0];
  const previous = selected && versionRows.find(({ version }) => version.number === selected.version.number - 1);
  // A version approved from an alert has no check of its own: it's the live text that was checked on that scan.
  const [check] = selected
    ? await db
        .select()
        .from(checks)
        .where(
          selected.version.createdVia === "submitted"
            ? and(eq(checks.versionId, selected.version.id), isNull(checks.pageScanId))
            : and(eq(checks.adId, ad.id), eq(checks.contentHash, selected.version.hash), isNotNull(checks.pageScanId)),
        )
        .orderBy(desc(checks.id))
        .limit(1)
    : [];
  const flags = check ? numberFlags(check.flags, check.rulesUsed) : [];
  const marks: Mark[] = flags.flatMap(({ flag, n }) => (flag.quote ? [{ quote: flag.quote, n }] : []));

  const isOwner = ad.ownerId === user.id;
  const canDecide =
    user.role === "reviewer" &&
    !isOwner &&
    ad.status === "awaiting_review" &&
    selected?.version.id === ad.latestVersion?.id;
  const decisionsOn = (versionId: number) => decisionRows.filter(({ decision }) => decision.versionId === versionId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{ad.title}</h1>
          {isOwner && user.role === "submitter" && (
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <Link href={`/ads/${ad.id}/edit`}>Edit draft</Link>
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
          <Detail label="Status">
            <StatusBadge status={ad.status} version={ad.latestVersion?.number} />
          </Detail>
          <Detail label="Last approved">
            {ad.lastApprovedVersion ? `v${ad.lastApprovedVersion.number}` : "None yet"}
          </Detail>
          <Detail label="Live version">
            <LiveVersion live={live} />
          </Detail>
          <div>
            {user.role === "reviewer" && ad.channel === "web_page" && ad.lastApprovedVersion && (
              <RescanButton adId={ad.id} />
            )}
          </div>
          <Detail label="Product">{productLabels[ad.product]}</Detail>
          <Detail label="Channel">{channelLabels[ad.channel]}</Detail>
          <Detail label="Made by">
            {affiliateRows[0] ? `${affiliateRows[0].name} (${sourceLabels.affiliate.toLowerCase()})` : sourceLabels[ad.source]}
          </Detail>
          <Detail label="Submitted by">{ad.ownerName}</Detail>
        </dl>
        {openAlert && ad.lastApprovedVersion && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950">
            ⚠ Open alert: the live page doesn&apos;t match v{ad.lastApprovedVersion.number}.{" "}
            <Link href={`/alerts/${openAlert.id}`} className="font-medium underline underline-offset-3">
              View alert
            </Link>
          </div>
        )}
      </header>

      {!selected ? (
        <p className="text-sm text-muted-foreground">This ad hasn&apos;t been submitted yet.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <div className="flex min-w-0 flex-col gap-8 text-sm">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">
                Version {selected.version.number}
                {selected.version.id === ad.latestVersion?.id && " (latest)"}
              </h2>
              <p className="text-muted-foreground">
                {createdViaLabels[selected.version.createdVia]} by {selected.createdByName} ·{" "}
                {formatAgo(selected.version.createdAt)}
                {selected.version.id !== ad.latestVersion?.id && (
                  <>
                    {" · "}
                    <Link href={`/ads/${ad.id}`} className="underline underline-offset-3">
                      Go to the latest version
                    </Link>
                  </>
                )}
              </p>
            </div>

            {canDecide && (
              <DecisionPanel adId={ad.id} versionId={selected.version.id} versionNumber={selected.version.number} />
            )}

            {decisionsOn(selected.version.id).map(({ decision, reviewerName }) => (
              <div key={decision.id} className="rounded-lg border bg-muted px-4 py-3">
                <p className="font-medium">
                  {decisionLabels[decision.decision]} by {reviewerName} · {formatAgo(decision.createdAt)}
                </p>
                {decision.comment && <p className="mt-1 whitespace-pre-wrap">“{decision.comment}”</p>}
              </div>
            ))}

            {previous && (
              <Section title={`What changed since version ${previous.version.number}`}>
                <WhatChanged before={previous.version} after={selected.version} />
              </Section>
            )}

            <Section title={`Ad content (version ${selected.version.number})`}>
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                {selected.version.subject !== null && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Subject line</span>
                    <HighlightedText text={selected.version.subject} marks={marks} />
                  </div>
                )}
                {selected.version.url !== null && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">URL</span>
                    <a
                      href={selected.version.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all underline underline-offset-3"
                    >
                      {selected.version.url}
                    </a>
                    {DEMO_PAGE_PATH.test(selected.version.url) && (
                      <Link href={`${selected.version.url}/edit`} className="text-xs underline underline-offset-3">
                        Edit demo page
                      </Link>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {(selected.version.subject !== null || selected.version.url !== null) && (
                    <span className="text-xs font-medium text-muted-foreground uppercase">Text</span>
                  )}
                  <HighlightedText text={selected.version.visibleText} marks={marks} />
                </div>
              </div>
              {ad.channel === "web_page" && (
                <details className="rounded-lg border px-4 py-3">
                  <summary className="cursor-pointer font-medium">Hidden text on this page</summary>
                  <div className="mt-3">
                    {selected.version.hiddenText ? (
                      <HighlightedText text={selected.version.hiddenText} marks={marks} />
                    ) : (
                      <p className="text-muted-foreground">None found.</p>
                    )}
                  </div>
                </details>
              )}
            </Section>

            <Section
              title={
                <span className="flex items-baseline justify-between gap-2">
                  <span>
                    Compliance issues <span className="font-normal text-muted-foreground">· {issueCounts(flags)}</span>
                  </span>
                  {check && (
                    <Link
                      href={`/checks/${check.id}`}
                      className="text-xs font-normal text-muted-foreground underline underline-offset-3"
                    >
                      Check #{check.id}
                    </Link>
                  )}
                </span>
              }
            >
              <SuspiciousBanner flags={flags} />
              <FlagList flags={flags} notes={notes} />
            </Section>
          </div>

          <aside className="flex flex-col gap-3 text-sm">
            <h2 className="font-medium">Version history</h2>
            <ol className="flex flex-col gap-2">
              {versionRows.map(({ version, createdByName }) => (
                <li
                  key={version.id}
                  className={`rounded-lg border p-3 ${version.id === selected.version.id ? "border-foreground/40 bg-muted" : ""}`}
                >
                  <Link href={`/ads/${ad.id}?v=${version.number}`} className="font-medium hover:underline">
                    Version {version.number}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {createdViaLabels[version.createdVia]} by {createdByName} · {formatAgo(version.createdAt)}
                  </p>
                  {decisionsOn(version.id).map(({ decision, reviewerName }) => (
                    <p key={decision.id} className="mt-1 text-xs">
                      <span className="font-medium">{decisionLabels[decision.decision]}</span> by {reviewerName}{" "}
                      {formatAgo(decision.createdAt)}
                      {decision.comment && <span className="block text-muted-foreground">“{decision.comment}”</span>}
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}

      <Section title="Audit log">
        <AuditLog events={eventRows} ruleNames={new Map(ruleRows.map((rule) => [rule.id, rule.name]))} />
      </Section>
    </main>
  );
}
