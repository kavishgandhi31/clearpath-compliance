import type { approvedTexts } from "../db/schema";
import { contentParts, findAll, includesFolded, phrasePattern } from "./match";
import type { ExtractedContent, Flag, RuleSnapshot } from "./types";

export type ApprovedText = typeof approvedTexts.$inferSelect;

// Text checks: a required approved text must appear word for word in the subject line or visible text,
// and a banned phrase must not appear anywhere, hidden text included.
export function runTextChecks(rules: RuleSnapshot[], texts: ApprovedText[], content: ExtractedContent): Flag[] {
  const shown = `${content.subject ?? ""}\n${content.visibleText}`;
  const flags: Flag[] = [];
  for (const rule of rules) {
    if (rule.requiredApprovedTextId) {
      const required = texts.find((text) => text.id === rule.requiredApprovedTextId)!;
      if (!includesFolded(shown, required.text)) {
        const name = required.name.toLowerCase();
        flags.push({
          kind: "rule",
          ruleId: rule.id,
          quote: null,
          explanation: includesFolded(content.hiddenText, required.text)
            ? `The approved ${name} only appears in hidden text. It must be visible, word for word.`
            : `The approved ${name} is missing. It must appear word for word.`,
          foundBy: "text_check",
          approvedTextId: required.id,
        });
      }
    }
    for (const phrase of rule.bannedPhrases) {
      for (const part of contentParts(content)) {
        for (const [start, end] of findAll(phrasePattern(phrase), part.text)) {
          flags.push({
            kind: "rule",
            ruleId: rule.id,
            quote: part.text.slice(start, end),
            explanation: `Uses the banned phrase "${phrase}"${part.hidden ? " in hidden text" : ""}.`,
            foundBy: "text_check",
            approvedTextId: null,
          });
        }
      }
    }
  }
  return flags;
}
