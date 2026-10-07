import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AlertActions } from "@/components/alert-actions";
import { FlagList, issueCounts, SuspiciousBanner } from "@/components/flag-list";
import { HighlightedText } from "@/components/highlighted-text";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WhatChanged } from "@/components/what-changed";
import { db } from "@/db";
import { adVersions, ads, alerts, checks, events, flagNotes, pageScans } from "@/db/schema";
import { loadAdSummaries } from "@/lib/ads";
import { requireUser } from "@/lib/auth";
import { numberFlags } from "@/lib/flags";
import { formatAgo, formatDateTime } from "@/lib/format";
import type { Mark } from "@/lib/highlight";
import { parseId } from "@/lib/ids";
import { alertColorLabels } from "@/lib/labels";
import { loadApprovedVersions } from "@/lib/monitoring";

// Re-scan runs the full check when the page changed.
export const maxDuration = 180;

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default async function AlertPage(props: PageProps<"/alerts/[id]">) {
  const user = await requireUser();
  const alertId = parseId((await props.params).id);
  const [alert] = alertId === null ? [] : await db.select().from(alerts).where(eq(alerts.id, alertId));
  if (!alert) notFound();

  const [[ad], [scan], approvedVersions, [check], notes, scanRows, alertEvents] = await Promise.all([
    loadAdSummaries(eq(ads.id, alert.adId)),
    db.select().from(pageScans).where(eq(pageScans.id, alert.latestScanId)),
    loadApprovedVersions(db, alert.adId),
    db.select().from(checks).where(eq(checks.pageScanId, alert.latestScanId)).orderBy(desc(checks.id)).limit(1),
    db.select().from(flagNotes).where(eq(flagNotes.adId, alert.adId)),
    db
      .select({
        id: pageScans.id,
        fetchedAt: pageScans.fetchedAt,
        failureReason: pageScans.failureReason,
        matchedVersion: adVersions.number,
        checkId: checks.id,
      })
      .from(pageScans)
      .leftJoin(adVersions, eq(adVersions.id, pageScans.matchedVersionId))
      .leftJoin(checks, eq(checks.pageScanId, pageScans.id))
      .where(eq(pageScans.adId, alert.adId))
      .orderBy(desc(pageScans.id)),
    db
      .select({ action: events.action, details: events.details, createdAt: events.createdAt })
      .from(events)
      .where(eq(events.adId, alert.adId))
      .orderBy(desc(events.id)),
  ]);
  const forThisAlert = alertEvents.filter((event) => event.details.alertId === alert.id);
  const lastFix = forThisAlert.find((event) => event.action === "fix_requested");
  const approvedAsIs = forThisAlert.find((event) => event.action === "approved_as_is");
  // The scan that closed it: the first one after the alert's latest scan that matched with no check.
  const closingScan = scanRows.findLast((row) => row.id > alert.latestScanId && row.matchedVersion !== null && row.checkId === null);
  const matchedVersion = scanRows.find((row) => row.id === scan.id)?.matchedVersion ?? null;
  // A closed alert keeps showing the change it was opened for, not a comparison with a later approval of the same text.
  const approved = !alert.closedAt
    ? approvedVersions[0]
    : alert.resolution === "approved_as_is"
      ? approvedVersions.find((version) => version.number < Number(approvedAsIs?.details.version))!
      : approvedVersions.find((version) => version.number === closingScan?.matchedVersion)!;

  const flags = check ? numberFlags(check.flags, check.rulesUsed) : [];
  const marks: Mark[] = flags.flatMap(({ flag, n }) => (flag.quote ? [{ quote: flag.quote, n }] : []));
  const live = { subject: null, url: approved.url, visibleText: scan.visibleText ?? "", hiddenText: scan.hiddenText ?? "" };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 text-sm">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Alert on {ad.title}</h1>
          <Badge className={alert.color === "red" ? "bg-red-100 text-red-900" : "bg-muted text-muted-foreground"}>
            {alertColorLabels[alert.color]}
          </Badge>
          <Badge className="border-border bg-transparent text-muted-foreground">{alert.closedAt ? "Closed" : "Open"}</Badge>
          <Link href={`/ads/${ad.id}`} className="ml-auto underline underline-offset-3">
            Ad page
          </Link>
        </div>
        <p className="text-muted-foreground">
          Opened {formatAgo(alert.openedAt)} · change spotted {formatDateTime(scan.fetchedAt)}
        </p>
        {!alert.closedAt && (
          <p className="text-base font-medium">
            {matchedVersion === null
              ? "Live page matches nothing we approved"
              : `Live page matches v${matchedVersion}, which was approved before`}
          </p>
        )}
        {alert.closedAt && (
          <div className="rounded-lg border bg-muted px-4 py-3">
            Closed {formatAgo(alert.closedAt)}:{" "}
            {alert.resolution === "approved_as_is"
              ? `approved as-is as v${approvedAsIs?.details.version}`
              : `the live page matches v${closingScan?.matchedVersion} again`}
          </div>
        )}
        {!alert.closedAt && user.role === "reviewer" && (
          <AlertActions
            alertId={alert.id}
            adId={ad.id}
            scanId={scan.id}
            flagCount={flags.length}
            suspicious={flags.some(({ flag }) => flag.kind === "suspicious_instructions")}
          />
        )}
        {!alert.closedAt && lastFix && (
          <p className="text-muted-foreground">
            Fix requested {formatAgo(lastFix.createdAt)} ·{" "}
            <Link href="/outbox" className="underline underline-offset-3">
              see Outbox
            </Link>
          </p>
        )}
      </header>

      <Section
        title={`What changed since v${approved.number} (${alert.closedAt ? "last approved at the time" : "last approved"})`}
      >
        <WhatChanged before={approved} after={live} />
      </Section>

      <Section
        title={
          <span className="flex items-baseline justify-between gap-2">
            <span>
              Flags on the live text <span className="font-normal text-muted-foreground">· {issueCounts(flags)}</span>
            </span>
            {check && (
              <Link href={`/checks/${check.id}`} className="text-xs font-normal text-muted-foreground underline underline-offset-3">
                Check #{check.id}
              </Link>
            )}
          </span>
        }
      >
        <SuspiciousBanner flags={flags} />
        <FlagList flags={flags} notes={notes} />
      </Section>

      <Section title="Live page text">
        <div className="rounded-lg border p-4">
          <HighlightedText text={live.visibleText} marks={marks} />
        </div>
        <details className="rounded-lg border px-4 py-3">
          <summary className="cursor-pointer font-medium">Hidden text on this page</summary>
          <div className="mt-3">
            {live.hiddenText ? (
              <HighlightedText text={live.hiddenText} marks={marks} />
            ) : (
              <p className="text-muted-foreground">None found.</p>
            )}
          </div>
        </details>
      </Section>

      <Section title="Scan history">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">When</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="w-28">Check</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scanRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">{formatDateTime(row.fetchedAt)}</TableCell>
                <TableCell className="whitespace-normal">
                  {row.failureReason !== null
                    ? `Couldn't check: ${row.failureReason}`
                    : row.checkId === null
                      ? `✓ Matches v${row.matchedVersion}`
                      : `Changed, ${row.matchedVersion === null ? "matches nothing approved" : `matches v${row.matchedVersion}`}`}
                </TableCell>
                <TableCell>
                  {row.checkId !== null && (
                    <Link href={`/checks/${row.checkId}`} className="underline underline-offset-3">
                      Check #{row.checkId}
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </main>
  );
}
