import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedContent } from "./types";

export const anthropic = new Anthropic();

export type ModelUsage = { model: string; inputTokens: number; outputTokens: number };

// Stops the ad's text from closing or opening the tags that mark where it starts and ends.
const SECTION_TAG = /<(\s*\/?\s*)(ad_content|subject_line|visible_text|hidden_text)\b/gi;

function escapeTags(text: string): string {
  return text.replace(SECTION_TAG, "&lt;$1$2");
}

// The ad's text for a prompt: inside <ad_content>, with the subject line, visible text and hidden text in their own sections.
export function formatAdContent(content: ExtractedContent): string {
  const sections = [
    content.subject === null ? null : `<subject_line>\n${escapeTags(content.subject)}\n</subject_line>`,
    `<visible_text>\n${escapeTags(content.visibleText)}\n</visible_text>`,
    content.hiddenText ? `<hidden_text>\n${escapeTags(content.hiddenText)}\n</hidden_text>` : null,
  ];
  return `<ad_content>\n${sections.filter(Boolean).join("\n")}\n</ad_content>`;
}
