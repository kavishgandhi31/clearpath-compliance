import { asc } from "drizzle-orm";
import { type EvalAd, evalAds } from "../evals/ads";
import type { ModelUsage } from "../src/check/ai";
import type { DroppedFlag, Effort } from "../src/check/ai-check";
import { contentFromHtml, fetchContent, runCheckWithUsage } from "../src/check/check";
import { db } from "../src/db";
import { rules } from "../src/db/schema";

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

// Dollars per million input and output tokens, matched by model ID prefix ("claude-sonnet-5" also covers the refusal fallback).
const PRICES: [prefix: string, input: number, output: number][] = [
  ["claude-sonnet-5", 2, 10],
  ["claude-haiku-4-5", 1, 5],
];

type Outcome =
  | { ad: EvalAd; ok: false; error: string }
  | {
      ad: EvalAd;
      ok: true;
      flaggedRuleIds: Set<string>;
      injectionFound: boolean;
      seconds: number;
      cost: number;
      dropped: DroppedFlag[];
    };

function costOf(usage: ModelUsage[]): number {
  return usage.reduce((total, call) => {
    const [, input, output] = PRICES.find(([prefix]) => call.model.startsWith(prefix)) ?? ["", NaN, NaN];
    return total + (call.inputTokens * input + call.outputTokens * output) / 1_000_000;
  }, 0);
}

async function runOne(ad: EvalAd, effort: Effort): Promise<Outcome> {
  const fetched =
    ad.content.kind === "text"
      ? await fetchContent({ kind: "text", subject: ad.content.subject, text: ad.content.text })
      : contentFromHtml(ad.content.html);
  if (!fetched.ok) return { ad, ok: false, error: fetched.reason };

  const started = performance.now();
  try {
    const { result, usage, dropped } = await runCheckWithUsage(ad.ad, fetched.content, effort);
    return {
      ad,
      ok: true,
      flaggedRuleIds: new Set(result.flags.flatMap((flag) => (flag.kind === "rule" ? [flag.ruleId] : []))),
      injectionFound: result.flags.some((flag) => flag.kind === "suspicious_instructions"),
      seconds: (performance.now() - started) / 1000,
      cost: costOf(usage),
      dropped,
    };
  } catch (error) {
    return { ad, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function list(ids: Iterable<string>): string {
  return [...ids].sort().join(", ") || "none";
}

async function main() {
  const effortArg = process.argv.find((arg) => arg.startsWith("--effort="))?.slice("--effort=".length) ?? "medium";
  if (!EFFORTS.includes(effortArg as Effort)) {
    console.error(`Unknown effort "${effortArg}". Use --effort=${EFFORTS.join("|")}.`);
    process.exit(1);
  }
  const effort = effortArg as Effort;

  const outcomes: Outcome[] = [];
  for (const ad of evalAds) {
    console.error(`Checking ${ad.id}...`);
    outcomes.push(await runOne(ad, effort));
  }
  const done = outcomes.filter((outcome) => outcome.ok);

  console.log(`## Eval: ${evalAds.length} ads, Sonnet effort ${effort}\n`);
  console.log("| Ad | Expected | Flagged | Injection expected / found | Time | Cost |");
  console.log("|---|---|---|---|---|---|");
  for (const outcome of outcomes) {
    const expected = list(outcome.ad.expectedRuleIds);
    if (!outcome.ok) {
      console.log(`| ${outcome.ad.id} | ${expected} | check failed: ${outcome.error} | ${outcome.ad.expectInjection ? "yes" : "no"} / — | — | — |`);
      continue;
    }
    const injection = `${outcome.ad.expectInjection ? "yes" : "no"} / ${outcome.injectionFound ? "yes" : "no"}`;
    console.log(
      `| ${outcome.ad.id} | ${expected} | ${list(outcome.flaggedRuleIds)} | ${injection} | ${outcome.seconds.toFixed(1)}s | $${outcome.cost.toFixed(4)} |`,
    );
  }

  const ruleIds = (await db.select({ id: rules.id }).from(rules).orderBy(asc(rules.id))).map((rule) => rule.id);
  console.log("\n| Rule | Violations caught | Missed | False alarms |");
  console.log("|---|---|---|---|");
  for (const ruleId of ruleIds) {
    let caught = 0;
    let missed = 0;
    let falseAlarms = 0;
    for (const outcome of done) {
      const expected = outcome.ad.expectedRuleIds.includes(ruleId);
      const flagged = outcome.flaggedRuleIds.has(ruleId);
      if (expected && flagged) caught++;
      if (expected && !flagged) missed++;
      if (!expected && flagged) falseAlarms++;
    }
    const total = caught + missed;
    console.log(`| ${ruleId} | ${total ? `${caught}/${total}` : "—"} | ${missed} | ${falseAlarms} |`);
  }

  const attempts = done.filter((outcome) => outcome.ad.expectInjection);
  const injectionFalseAlarms = done.filter((outcome) => !outcome.ad.expectInjection && outcome.injectionFound).length;
  console.log(
    `\nInjection attempts caught: ${attempts.filter((outcome) => outcome.injectionFound).length}/${attempts.length}` +
      ` (Suspicious instructions on other ads: ${injectionFalseAlarms})`,
  );
  if (done.length) {
    const seconds = done.reduce((total, outcome) => total + outcome.seconds, 0) / done.length;
    const cost = done.reduce((total, outcome) => total + outcome.cost, 0) / done.length;
    console.log(`Average per check: ${seconds.toFixed(1)}s, $${cost.toFixed(4)}`);
  }
  const failed = outcomes.length - done.length;
  if (failed) console.log(`Checks that failed: ${failed} (left out of the counts above)`);

  for (const outcome of done) {
    for (const flag of outcome.dropped) {
      console.log(`Dropped AI flag on ${outcome.ad.id}: ${flag.ruleId} ${JSON.stringify(flag.quote)} (${flag.reason})`);
    }
  }
}

main().finally(() => db.$client.end());
