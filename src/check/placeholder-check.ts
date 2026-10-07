import { inArray } from "drizzle-orm";
import { db } from "../db";
import { approvedTexts } from "../db/schema";
import { hashContent } from "./hash";
import { loadApplicableRules } from "./rules";
import type { AdContext, CheckResult, DraftContent, ExtractedContent, FetchResult, Flag } from "./types";

// Placeholder content step: uses pasted text as-is, and returns made-up page text for a URL instead of fetching it.
export async function fetchContent(content: DraftContent): Promise<FetchResult> {
  const parts =
    content.kind === "text"
      ? { subject: content.subject, visibleText: content.text, hiddenText: "" }
      : { subject: null, visibleText: `Placeholder page text for ${content.url}. Our lowest rates ever.`, hiddenText: "" };
  return { ok: true, content: { ...parts, hash: hashContent(parts) } };
}

// Placeholder check: returns sample flags from simple word matches ("pre-approved", "lowest", "ignore your rules") and missing required texts.
export async function runCheck(ad: AdContext, content: ExtractedContent): Promise<CheckResult> {
  const rulesUsed = await loadApplicableRules(ad);
  const ruleIds = new Set(rulesUsed.map((rule) => rule.id));
  const allText = `${content.subject ?? ""}\n${content.visibleText}\n${content.hiddenText}`;
  const sentences = allText.split(/(?<=[.!?])\s+|\n/).map((s) => s.trim()).filter(Boolean);
  const flags: Flag[] = [];

  const injection = sentences.find((s) => /ignore (previous|your|all)/i.test(s));
  if (injection) {
    flags.push({
      kind: "suspicious_instructions",
      quote: injection,
      explanation: "Placeholder check: looks like an instruction aimed at an AI.",
      foundBy: "phrase_search",
    });
  }

  const required = rulesUsed.filter((rule) => rule.requiredApprovedTextId);
  const requiredTexts = required.length
    ? await db
        .select()
        .from(approvedTexts)
        .where(inArray(approvedTexts.id, required.map((rule) => rule.requiredApprovedTextId!)))
    : [];
  for (const rule of required) {
    const approved = requiredTexts.find((t) => t.id === rule.requiredApprovedTextId)!;
    if (!allText.toLowerCase().includes(approved.text.toLowerCase())) {
      flags.push({
        kind: "rule",
        ruleId: rule.id,
        quote: null,
        explanation: `Placeholder check: the ${approved.name.toLowerCase()} is missing.`,
        foundBy: "text_check",
        approvedTextId: approved.id,
      });
    }
  }

  if (!injection) {
    const preApproved = sentences.find((s) => /pre-?approved/i.test(s));
    if (preApproved && ruleIds.has("prequalification_isnt_approval")) {
      flags.push({
        kind: "rule",
        ruleId: "prequalification_isnt_approval",
        quote: preApproved,
        explanation: "Placeholder check: prequalification is described as an approval.",
        foundBy: "ai_check",
        approvedTextId: "prequalification_disclaimer",
      });
    }
    const unproven = sentences.find((s) => /lowest|best/i.test(s));
    if (unproven && ruleIds.has("unproven_claims")) {
      flags.push({
        kind: "rule",
        ruleId: "unproven_claims",
        quote: unproven,
        explanation: "Placeholder check: a comparative claim with no proof.",
        foundBy: "ai_check",
        approvedTextId: null,
      });
    }
  }

  return { flags, rulesUsed, model: injection ? null : "placeholder" };
}
