import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { alertColorLabels, eventLabels } from "@/lib/labels";

type Event = {
  id: number;
  action: string;
  details: Record<string, unknown>;
  createdAt: Date;
  actorName: string | null;
};

// Details written by the actions EventDetails knows about. Any other action shows only its name.
type Details = {
  changed?: string[];
  flags?: number;
  withoutNote?: number;
  checkId?: number;
  reason?: string;
  ruleId?: string;
  note?: string;
  version?: number;
  comment?: string | null;
  scanId?: number;
  result?: "matched" | "changed" | "failed";
  matchedVersion?: number | null;
  failureReason?: string;
  alertId?: number;
  color?: "red" | "gray";
  resolution?: "page_matches" | "approved_as_is";
  to?: string;
  cc?: string | null;
};

const fieldLabels: Record<string, string> = {
  title: "title",
  product: "product",
  source: "source",
  affiliateId: "affiliate",
  channel: "channel",
  draftSubject: "subject line",
  draftText: "text",
  draftUrl: "URL",
};

function flagCount(n: number) {
  return n === 1 ? "1 flag" : `${n} flags`;
}

function EventDetails({ action, details, ruleNames }: { action: string; details: Details; ruleNames: Map<string, string> }) {
  const alert = details.alertId !== undefined && (
    <Link href={`/alerts/${details.alertId}`} className="underline underline-offset-3">
      alert #{details.alertId}
    </Link>
  );
  const check = details.checkId !== undefined && (
    <Link href={`/checks/${details.checkId}`} className="underline underline-offset-3">
      Check #{details.checkId}
    </Link>
  );
  switch (action) {
    case "draft_saved":
      return <>Changed {details.changed?.map((key) => fieldLabels[key] ?? key).join(", ")}</>;
    case "check_run":
      return (
        <>
          {flagCount(details.flags ?? 0)} · {check}
        </>
      );
    case "check_failed":
      return <>{details.reason}</>;
    case "note_saved":
      return (
        <>
          On {ruleNames.get(details.ruleId ?? "") ?? details.ruleId}: “{details.note}”
        </>
      );
    case "submit_blocked":
      return (
        <>
          {details.withoutNote} of {flagCount(details.flags ?? 0)} had no note, so no version was created · {check}
        </>
      );
    case "submitted":
      return (
        <>
          v{details.version} · {check}
        </>
      );
    case "approved":
    case "changes_requested":
    case "rejected":
      return (
        <>
          v{details.version}
          {details.comment && `: “${details.comment}”`}
        </>
      );
    case "page_scanned":
      if (details.result === "failed") return <>Couldn&apos;t check: {details.failureReason}</>;
      if (details.result === "matched") return <>✓ Matches v{details.matchedVersion}</>;
      return (
        <>
          Changed · {details.matchedVersion ? `matches v${details.matchedVersion}` : "matches nothing approved"}
        </>
      );
    case "alert_opened":
    case "alert_updated":
      return (
        <>
          {alertColorLabels[details.color ?? "gray"]} · {alert}
        </>
      );
    case "alert_closed":
      return (
        <>
          {details.resolution === "approved_as_is" ? "Approved as-is" : "The live page matches again"} · {alert}
        </>
      );
    case "approved_as_is":
      return (
        <>
          v{details.version}, from {alert}
        </>
      );
    case "fix_requested":
      return (
        <>
          Emailed {details.to}
          {details.cc && `, cc ${details.cc}`} · {alert}
        </>
      );
    default:
      return null;
  }
}

export function AuditLog({ events, ruleNames }: { events: Event[]; ruleNames: Map<string, string> }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-36">When</TableHead>
          <TableHead className="w-36">Who</TableHead>
          <TableHead className="w-40">What</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell className="text-muted-foreground">{formatDateTime(event.createdAt)}</TableCell>
            <TableCell>{event.actorName ?? "System"}</TableCell>
            <TableCell>{eventLabels[event.action] ?? event.action}</TableCell>
            <TableCell className="whitespace-normal">
              <EventDetails action={event.action} details={event.details as Details} ruleNames={ruleNames} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
