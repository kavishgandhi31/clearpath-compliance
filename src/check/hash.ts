import { createHash } from "node:crypto";
import type { ExtractedContent } from "./types";

// Turns an ad's text into a fingerprint, ignoring spacing, so a live page can be compared with the approved version.
export function hashContent(content: Omit<ExtractedContent, "hash">): string {
  const normalized = [content.subject ?? "", content.visibleText, content.hiddenText]
    .map((part) => part.replace(/\s+/g, " ").trim())
    .join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}
