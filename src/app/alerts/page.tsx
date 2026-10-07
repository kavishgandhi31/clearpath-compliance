import { asc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { RescanButton } from "@/components/rescan-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { adVersions, ads, alerts, checks, pageScans } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatAgo } from "@/lib/format";
import { alertColorLabels } from "@/lib/labels";

// Re-scan runs the full check when the page changed.
export const maxDuration = 180;

export default async function AlertsPage() {
  await requireUser("reviewer");
  const rows = await db
    .select({
      alert: alerts,
      adTitle: ads.title,
      lastScannedAt: ads.lastScannedAt,
      matchedVersion: adVersions.number,
      flags: checks.flags,
    })
    .from(alerts)
    .innerJoin(ads, eq(ads.id, alerts.adId))
    .innerJoin(pageScans, eq(pageScans.id, alerts.latestScanId))
    .leftJoin(adVersions, eq(adVersions.id, pageScans.matchedVersionId))
    .leftJoin(checks, eq(checks.pageScanId, alerts.latestScanId))
    .where(isNull(alerts.closedAt))
    // alert_color is declared red, gray, so ascending puts red first.
    .orderBy(asc(alerts.color), asc(alerts.openedAt));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold">Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitored web pages that don&apos;t match their last approved version. Red first, then oldest.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open alerts.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>Alert</TableHead>
              <TableHead>Live page</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead>Last scanned</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ alert, adTitle, lastScannedAt, matchedVersion, flags }) => {
              const flagCount = flags?.length ?? 0;
              return (
                <TableRow key={alert.id}>
                  <TableCell>
                    <Link href={`/alerts/${alert.id}`} className="font-medium hover:underline">
                      {adTitle}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={alert.color === "red" ? "bg-red-100 text-red-900" : "bg-muted text-muted-foreground"}>
                      {alertColorLabels[alert.color]} ·{" "}
                      {flagCount === 0 ? "no flags" : flagCount === 1 ? "1 flag" : `${flagCount} flags`}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {matchedVersion === null
                      ? "Matches nothing we approved"
                      : `Matches v${matchedVersion}, which was approved before`}
                  </TableCell>
                  <TableCell>{formatAgo(alert.openedAt)}</TableCell>
                  <TableCell>{lastScannedAt ? formatAgo(lastScannedAt) : "Never"}</TableCell>
                  <TableCell className="whitespace-normal">
                    <RescanButton adId={alert.adId} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
