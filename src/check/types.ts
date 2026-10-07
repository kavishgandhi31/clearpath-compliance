import type { Channel, Product, Source, rules } from "../db/schema";

export type AdContext = {
  product: Product;
  channel: Channel;
  source: Source;
};

// One variant per channel, so an email always has a subject, a social post never does, and the kind matches the channel.
export type DraftContent =
  | { kind: "email"; subject: string; text: string }
  | { kind: "social_post"; text: string }
  | { kind: "web_page"; url: string };

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
