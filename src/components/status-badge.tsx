import { Badge } from "@/components/ui/badge";
import { statusLabels } from "@/lib/labels";
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

export function LiveVersion({ channel }: { channel: string }) {
  return <span className="text-muted-foreground">{channel === "web_page" ? "Not scanned yet" : "—"}</span>;
}
