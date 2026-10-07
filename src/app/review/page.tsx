import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadAdSummaries } from "@/lib/ads";
import { requireUser } from "@/lib/auth";
import { durationSince } from "@/lib/format";
import { channelLabels, productLabels, statusLabels } from "@/lib/labels";
import type { AdStatus } from "@/lib/status";

const filters = ["awaiting_review", "changes_requested", "approved", "rejected", "all"] as const;
type Filter = (typeof filters)[number];

export default async function ReviewQueuePage(props: PageProps<"/review">) {
  await requireUser("reviewer");
  const requested = (await props.searchParams).status;
  const filter: Filter = filters.find((f) => f === requested) ?? "awaiting_review";

  const submitted = (await loadAdSummaries())
    .flatMap((ad) => (ad.latestVersion ? [{ ...ad, latestVersion: ad.latestVersion }] : []))
    .sort((a, b) => a.latestVersion.createdAt.getTime() - b.latestVersion.createdAt.getTime());
  const counts = new Map<Filter, number>(
    filters.map((f) => [f, f === "all" ? submitted.length : submitted.filter((ad) => ad.status === f).length]),
  );
  const shown = filter === "all" ? submitted : submitted.filter((ad) => ad.status === filter);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-xl font-semibold">Review queue</h1>

      <nav className="flex flex-wrap gap-2 text-sm">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "awaiting_review" ? "/review" : `/review?status=${f}`}
            className={`rounded-full border px-3 py-1 ${f === filter ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}
          >
            {f === "all" ? "All" : statusLabels[f as AdStatus]} ({counts.get(f)})
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Waited</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((ad) => (
              <TableRow key={ad.id}>
                <TableCell>
                  <Link href={`/ads/${ad.id}`} className="font-medium hover:underline">
                    {ad.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {productLabels[ad.product]} · {channelLabels[ad.channel]}
                  </div>
                </TableCell>
                <TableCell>{ad.ownerName}</TableCell>
                <TableCell>
                  <StatusBadge status={ad.status} version={ad.latestVersion.number} />
                </TableCell>
                <TableCell>{durationSince(ad.latestVersion.createdAt, ad.latestDecision?.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
