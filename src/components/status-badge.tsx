import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatAgo } from "@/lib/format";
import { statusLabels } from "@/lib/labels";
import type { LiveStatus } from "@/lib/monitoring";
import type { AdStatus } from "@/lib/status";

const statusColors: Record<AdStatus, string> = {
  draft: "border-border bg-transparent text-muted-foreground",
  awaiting_review: "bg-sky-100 text-sky-900",
  changes_requested: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
};

// Shows "Awaiting review (v4)" style labels: the version is left off for Approved, since Last approved version already shows it.
export function StatusBadge({ status, version }: { status: AdStatus; version?: number | null }) {
  const showVersion = version && status !== "approved" && status !== "draft";
  return (
    <Badge className={statusColors[status]}>
      {statusLabels[status]}
      {showVersion ? ` (v${version})` : null}
    </Badge>
  );
}

function matchText(shows: number | null) {
  return shows === null ? "matched nothing approved" : `matched v${shows}`;
}

function LiveNote({ badge, note }: { badge: ReactNode; note: string | null }) {
  return (
    <div className="flex flex-col items-start gap-1">
      {badge}
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

export function LiveVersion({ live }: { live: LiveStatus }) {
  switch (live.kind) {
    case "matches":
      return (
        <LiveNote
          badge={<Badge className="bg-emerald-100 text-emerald-900">✓ Matches</Badge>}
          note={`v${live.version} · scanned ${formatAgo(live.scannedAt)}`}
        />
      );
    case "doesnt_match":
      return (
        <LiveNote
          badge={<Badge className="bg-red-100 text-red-900">⚠ Doesn&apos;t match</Badge>}
          note={live.shows === null ? "matches nothing approved" : `live page shows v${live.shows}`}
        />
      );
    case "failed":
      return (
        <LiveNote
          badge={<Badge className="bg-muted text-muted-foreground">Couldn&apos;t check</Badge>}
          note={
            live.lastMatch
              ? `${live.reason} · last successful scan ${live.lastMatch.matches ? `matched v${live.lastMatch.shows}` : matchText(live.lastMatch.shows)}`
              : live.reason
          }
        />
      );
    case "not_scanned":
      return <span className="text-muted-foreground">Not scanned yet</span>;
    case "not_monitored":
      return <span className="text-muted-foreground">Not monitored</span>;
    case "not_monitored_yet":
      return <span className="text-muted-foreground">Not monitored yet</span>;
  }
}
