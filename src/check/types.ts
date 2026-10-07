import type { Channel, Product, Source, rules } from "../db/schema";

export type AdContext = {
  product: Product;
  channel: Channel;
  source: Source;
};

export type DraftContent =
  | { kind: "text"; subject: string | null; text: string }
  | { kind: "url"; url: string };

export type ExtractedContent = {
  subject: string | null;
  visibleText: string;
  hiddenText: string;
  hash: string;
};

export type FetchResult =
  | { ok: true; content: ExtractedContent }
  | { ok: false; reason: string };

export type RuleSnapshot = typeof rules.$inferSelect;

export type Flag =
  | {
      kind: "rule";
      ruleId: string;
      // null when the problem is something missing, e.g. no mortgage licensing line
      quote: string | null;
      explanation: string;
      foundBy: "text_check" | "ai_check";
      approvedTextId: string | null;
    }
  | {
      kind: "suspicious_instructions";
      quote: string;
      explanation: string;
      foundBy: "phrase_search" | "injection_guard";
    };

export type CheckResult = {
  flags: Flag[];
  rulesUsed: RuleSnapshot[];
  // null when the AI rule check didn't run
  model: string | null;
};
