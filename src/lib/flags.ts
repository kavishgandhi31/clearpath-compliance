import type { Flag, RuleSnapshot } from "@/check/types";

export type NumberedFlag = { flag: Flag; n: number; rule: RuleSnapshot | null };
export type FlagNote = { ruleId: string; quote: string | null; note: string };

function rank({ flag, rule }: Omit<NumberedFlag, "n">) {
  if (flag.kind === "suspicious_instructions") return 0;
  return rule?.severity === "blocker" ? 1 : 2;
}

// Suspicious instructions first, then blockers, then warnings. Numbers link each flag to its highlight in the content.
export function numberFlags(flags: Flag[], rulesUsed: RuleSnapshot[]): NumberedFlag[] {
  return flags
    .map((flag) => ({
      flag,
      rule: flag.kind === "rule" ? (rulesUsed.find((rule) => rule.id === flag.ruleId) ?? null) : null,
    }))
    .sort((a, b) => rank(a) - rank(b))
    .map((item, i) => ({ ...item, n: i + 1 }));
}

// Notes match on rule + quote, so a note follows the same flag into later checks and versions. Suspicious instructions can't have one.
export function noteFor<N extends FlagNote>(flag: Flag, notes: N[]): N | null {
  if (flag.kind !== "rule") return null;
  return notes.find((note) => note.ruleId === flag.ruleId && note.quote === flag.quote) ?? null;
}
