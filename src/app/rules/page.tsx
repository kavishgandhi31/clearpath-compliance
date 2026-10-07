import { asc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { approvedTexts, channelEnum, productEnum, rules, sourceEnum } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { channelLabels, productLabels, sourceLabels } from "@/lib/labels";

function appliesTo<T extends string>(values: T[], all: readonly T[], labels: Record<T, string>) {
  return values.length === all.length ? "All" : values.map((value) => labels[value]).join(", ");
}

export default async function RulesPage() {
  await requireUser();
  const [ruleRows, textRows] = await Promise.all([
    db.select().from(rules).orderBy(asc(rules.name)),
    db.select().from(approvedTexts),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold">Rules</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only. Text checks run in code and are used only where code can be certain. AI checks are judged by the
          model, and every flag must quote the ad.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {ruleRows.map((rule) => {
          const requiredText = textRows.find((text) => text.id === rule.requiredApprovedTextId);
          return (
            <li key={rule.id} className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{rule.name}</h2>
                {rule.severity === "blocker" ? (
                  <Badge className="bg-red-100 text-red-900">Blocker</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-900">Warning</Badge>
                )}
                <span className="ml-auto flex gap-2">
                  {(requiredText || rule.bannedPhrases.length > 0) && <Badge variant="outline">Text check</Badge>}
                  {rule.aiInstruction && <Badge variant="outline">AI check</Badge>}
                </span>
              </div>

              {requiredText && (
                <p>
                  <span className="font-medium">Text check: </span>must include the approved{" "}
                  {requiredText.name.toLowerCase()}, word for word: “{requiredText.text}”
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

              <p className="text-xs text-muted-foreground">
                Products: {appliesTo(rule.products, productEnum.enumValues, productLabels)} · Channels:{" "}
                {appliesTo(rule.channels, channelEnum.enumValues, channelLabels)} · Sources:{" "}
                {appliesTo(rule.sources, sourceEnum.enumValues, sourceLabels)} · Based on: {rule.basedOn}
              </p>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
