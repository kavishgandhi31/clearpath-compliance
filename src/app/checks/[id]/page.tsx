import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlagList, issueCounts, SuspiciousBanner } from "@/components/flag-list";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { adVersions, ads, checks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { numberFlags } from "@/lib/flags";
import { formatDateTime } from "@/lib/format";
import { parseId } from "@/lib/ids";

export default async function CheckPage(props: PageProps<"/checks/[id]">) {
  await requireUser();
  const checkId = parseId((await props.params).id);
  const [row] =
    checkId === null
      ? []
      : await db
          .select({ check: checks, adTitle: ads.title, versionNumber: adVersions.number })
          .from(checks)
          .innerJoin(ads, eq(ads.id, checks.adId))
          .leftJoin(adVersions, eq(adVersions.id, checks.versionId))
          .where(eq(checks.id, checkId));
  if (!row) notFound();
  const { check, adTitle, versionNumber } = row;
  const flags = numberFlags(check.flags, check.rulesUsed);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 text-sm">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Check #{check.id}</h1>
        <p className="text-muted-foreground">
          On{" "}
          <Link href={`/ads/${check.adId}`} className="underline underline-offset-3">
            {adTitle}
          </Link>
          {versionNumber !== null ? `, v${versionNumber}` : check.pageScanId !== null ? ", a scan of the live page" : ", the draft"}{" "}
          · {formatDateTime(check.createdAt)} · AI rule check: {check.model ?? "skipped"}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          Compliance issues <span className="font-normal text-muted-foreground">· {issueCounts(flags)}</span>
        </h2>
        <SuspiciousBanner flags={flags} />
        <FlagList flags={flags} notes={[]} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">Rules this check used</h2>
          <p className="text-muted-foreground">
            A copy saved with the check, so it shows the exact rule text even if the rules change later.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {check.rulesUsed.map((rule) => (
            <li key={rule.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{rule.name}</span>
                {rule.severity === "blocker" ? (
                  <Badge className="bg-red-100 text-red-900">Blocker</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-900">Warning</Badge>
                )}
              </div>
              {rule.requiredApprovedTextId && (
                <p>
                  <span className="font-medium">Text check: </span>must include approved text{" "}
                  <code className="rounded bg-muted px-1">{rule.requiredApprovedTextId}</code>
                </p>
              )}
              {rule.bannedPhrases.length > 0 && (
                <p>
                  <span className="font-medium">Text check: </span>must not include{" "}
                  {rule.bannedPhrases.map((phrase) => `“${phrase}”`).join(", ")}
                </p>
              )}
              {rule.aiInstruction && (
                <p>
                  <span className="font-medium">AI check: </span>
                  {rule.aiInstruction}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
