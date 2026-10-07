import { eq } from "drizzle-orm";
import Link from "next/link";
import { LiveVersion, StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ads } from "@/db/schema";
import { loadAdSummaries } from "@/lib/ads";
import { requireUser } from "@/lib/auth";
import { formatAgo } from "@/lib/format";
import { alertColorLabels, channelLabels, productLabels } from "@/lib/labels";
import { liveStatus, loadMonitoring } from "@/lib/monitoring";

export default async function MyAdsPage() {
  const user = await requireUser("submitter");
  const myAds = (await loadAdSummaries(eq(ads.ownerId, user.id))).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const monitoring = await loadMonitoring(myAds);
  // Not stored anywhere: recomputed from decisions and open alerts on every page load.
  const needsAttention = myAds.filter((ad) => ad.status === "changes_requested" || ad.status === "rejected");
  const withOpenAlert = myAds.flatMap((ad) => {
    const { openAlert, liveVersionNumber } = monitoring.get(ad.id) ?? {};
    return openAlert ? [{ ad, alert: openAlert, shows: liveVersionNumber ?? null }] : [];
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My ads</h1>
        <Button asChild>
          <Link href="/ads/new">New ad</Link>
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Needs your attention</h2>
        {needsAttention.length === 0 && withOpenAlert.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {withOpenAlert.map(({ ad, alert, shows }) => (
              <li key={`alert-${alert.id}`}>
                <Link
                  href={`/alerts/${alert.id}`}
                  className="flex flex-col gap-1 rounded-lg border p-3 text-sm hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ad.title}</span>
                    <Badge className={alert.color === "red" ? "bg-red-100 text-red-900" : "bg-muted text-muted-foreground"}>
                      {alertColorLabels[alert.color]} alert
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">opened {formatAgo(alert.openedAt)}</span>
                  </div>
                  <p className="text-muted-foreground">
                    The live page doesn&apos;t match v{ad.lastApprovedVersion?.number}.{" "}
                    {shows === null ? "It matches nothing we approved." : `It shows v${shows}.`}
                  </p>
                </Link>
              </li>
            ))}
            {needsAttention.map((ad) => (
              <li key={ad.id}>
                <Link
                  href={`/ads/${ad.id}/edit`}
                  className="flex flex-col gap-1 rounded-lg border p-3 text-sm hover:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ad.title}</span>
                    <StatusBadge status={ad.status} version={ad.latestVersion?.number} />
                    {ad.latestDecision && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatAgo(ad.latestDecision.createdAt)}
                      </span>
                    )}
                  </div>
                  {ad.latestDecision?.comment && (
                    <p className="text-muted-foreground">“{ad.latestDecision.comment}”</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">My ads</h2>
        {myAds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ads yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last approved version</TableHead>
                <TableHead>Live version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myAds.map((ad) => (
                <TableRow key={ad.id}>
                  <TableCell>
                    <Link href={`/ads/${ad.id}`} className="font-medium hover:underline">
                      {ad.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {productLabels[ad.product]} · {channelLabels[ad.channel]}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ad.status} version={ad.latestVersion?.number} />
                  </TableCell>
                  <TableCell>{ad.lastApprovedVersion ? `v${ad.lastApprovedVersion.number}` : "None yet"}</TableCell>
                  <TableCell>
                    <LiveVersion live={liveStatus(ad, monitoring.get(ad.id))} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  );
}
