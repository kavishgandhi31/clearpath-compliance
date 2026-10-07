import { asc } from "drizzle-orm";
import { db } from "../db";
import { approvedTexts } from "../db/schema";
import type { ModelUsage } from "./ai";
import { type DroppedFlag, type Effort, runAiRuleCheck } from "./ai-check";
import { extractPageText } from "./extract";
import { hashContent } from "./hash";
import { findInstructionPhrases, runInjectionGuard } from "./injection";
import { quotesOverlap } from "./match";
import { loadApplicableRules } from "./rules";
import { safeFetch } from "./safe-fetch";
import { runTextChecks } from "./text-checks";
import type { AdContext, CheckResult, DraftContent, ExtractedContent, FetchResult, Flag } from "./types";

// Keeps one check under the guard model's input limit and its cost to a few cents.
const MAX_CHARACTERS = 100_000;

function isTooLong(parts: Omit<ExtractedContent, "hash">): boolean {
  return (parts.subject ?? "").length + parts.visibleText.length + parts.hiddenText.length > MAX_CHARACTERS;
}

// Gets an ad's text: pasted text as-is, or a web page through safe fetch, split into visible and hidden text.
export async function fetchContent(content: DraftContent): Promise<FetchResult> {
  if (content.kind === "text") {
    const parts = { subject: content.subject, visibleText: content.text, hiddenText: "" };
    if (isTooLong(parts)) return { ok: false, reason: "too much text in the ad (over 100,000 characters)" };
    return { ok: true, content: { ...parts, hash: hashContent(parts) } };
  }
  const page = await safeFetch(content.url);
  if (!page.ok) return page;
  return contentFromHtml(page.body, page.contentType);
}

// Turns a page's HTML into the ad's text: visible and hidden text and their hash. Fails when the page has no body text
// or more text than a check takes.
export function contentFromHtml(html: string | Buffer, contentType = ""): FetchResult {
  const { visibleText, hiddenText, hasBodyText } = extractPageText(html, contentType);
  if (!hasBodyText) return { ok: false, reason: "no readable text on the page (it may need JavaScript)" };
  const parts = { subject: null, visibleText, hiddenText };
  if (isTooLong(parts)) return { ok: false, reason: "too much text on the page (over 100,000 characters)" };
  return { ok: true, content: { ...parts, hash: hashContent(parts) } };
}

// Runs the full check on an ad's text. Throws when an AI step can't give an answer, so a failed check never looks like a clean one.
export async function runCheck(ad: AdContext, content: ExtractedContent): Promise<CheckResult> {
  return (await runCheckWithUsage(ad, content)).result;
}

// runCheck, plus each AI call's token usage and the AI flags dropped by verification, for the eval.
export async function runCheckWithUsage(
  ad: AdContext,
  content: ExtractedContent,
  effort: Effort = "medium",
): Promise<{ result: CheckResult; usage: ModelUsage[]; dropped: DroppedFlag[] }> {
  const [rulesUsed, texts] = await Promise.all([
    loadApplicableRules(ad),
    db.select().from(approvedTexts).orderBy(asc(approvedTexts.id)),
  ]);
  const usage: ModelUsage[] = [];

  let suspicious = findInstructionPhrases(content);
  if (suspicious.length === 0) {
    const guard = await runInjectionGuard(content);
    usage.push(guard.usage);
    suspicious = guard.flags;
  }

  const textFlags = runTextChecks(rulesUsed, texts, content);

  const aiRules = rulesUsed.filter((rule) => rule.aiInstruction);
  if (suspicious.length > 0 || aiRules.length === 0) {
    return { result: { flags: mergeFlags([...suspicious, ...textFlags]), rulesUsed, model: null }, usage, dropped: [] };
  }
  const ai = await runAiRuleCheck({ ad, rules: aiRules, approvedTexts: texts, content, effort });
  usage.push(ai.usage);
  return {
    result: { flags: mergeFlags([...textFlags, ...ai.flags]), rulesUsed, model: ai.model },
    usage,
    dropped: ai.dropped,
  };
}

// Shows each problem once: the same rule and quote only once, and an AI flag is dropped when an earlier flag for the
// same rule (a text check's, or the AI's own) quotes an overlapping part of the ad. Text-check flags come first, so they win.
function mergeFlags(flags: Flag[]): Flag[] {
  const merged: Flag[] = [];
  for (const flag of flags) {
    if (!merged.some((kept) => isRepeat(kept, flag))) merged.push(flag);
  }
  return merged;
}

function isRepeat(kept: Flag, flag: Flag): boolean {
  if (kept.kind !== flag.kind) return false;
  if (kept.kind === "rule" && flag.kind === "rule") {
    if (kept.ruleId !== flag.ruleId) return false;
    if (flag.foundBy === "ai_check" && kept.quote !== null && flag.quote !== null) {
      return quotesOverlap(kept.quote, flag.quote);
    }
  }
  return kept.quote === flag.quote;
}
