import type { ExtractedContent } from "./types";

const INVISIBLE = /[­​-‏⁠﻿]/;
const PLAIN: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "–": "-",
  "—": "-",
  "−": "-",
};

type Folded = { text: string; origin: number[] };

// Lowercases text, swaps curly quotes and dashes for plain ones, drops invisible characters and collapses spacing,
// so two texts can be compared the way a reader sees them. origin[i] is where folded character i came from in the original.
function fold(original: string): Folded {
  let text = "";
  const origin: number[] = [];
  let spaceAt = -1;
  for (let i = 0; i < original.length; i++) {
    const char = original[i];
    if (INVISIBLE.test(char)) continue;
    if (/\s/.test(char)) {
      if (spaceAt === -1 && text) spaceAt = i;
      continue;
    }
    if (spaceAt !== -1) {
      text += " ";
      origin.push(spaceAt);
      spaceAt = -1;
    }
    const folded = (PLAIN[char] ?? char).toLowerCase();
    text += folded;
    for (let k = 0; k < folded.length; k++) origin.push(i);
  }
  return { text, origin };
}

export type ContentPart = { text: string; hidden: boolean };

// The ad's text in the order it's searched: subject line, visible text, hidden text.
export function contentParts(content: ExtractedContent): ContentPart[] {
  return [
    { text: content.subject ?? "", hidden: false },
    { text: content.visibleText, hidden: false },
    { text: content.hiddenText, hidden: true },
  ];
}

// Every place a pattern matches the folded text, as [start, end) positions in the original text. The pattern needs the g flag.
export function findAll(pattern: RegExp, text: string): [number, number][] {
  const folded = fold(text);
  return [...folded.text.matchAll(pattern)].map((match) => [
    folded.origin[match.index],
    folded.origin[match.index + match[0].length - 1] + 1,
  ]);
}

// A pattern that finds a fixed phrase in folded text, starting at a word boundary ("no credit check" but not "piano credit check").
export function phrasePattern(phrase: string): RegExp {
  const escaped = fold(phrase).text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, "gu");
}

// Whether a text contains another, ignoring the differences fold() ignores.
export function includesFolded(text: string, part: string): boolean {
  return fold(text).text.includes(fold(part).text);
}

// Finds a quote in the ad and returns the whole sentence (or sentences) around it exactly as the ad has them, and whether
// it's in hidden text. null if the ad doesn't contain it. Widening means the AI quoting a slightly different part of the same
// sentence on the next run still gives the same quote, so a note on that flag stays attached.
export function findQuote(quote: string, content: ExtractedContent): { sentence: string; hidden: boolean } | null {
  const needle = fold(quote).text;
  if (!needle) return null;
  for (const part of contentParts(content)) {
    const folded = fold(part.text);
    const at = folded.text.indexOf(needle);
    if (at !== -1) {
      const start = folded.origin[at];
      const end = folded.origin[at + needle.length - 1] + 1;
      return { sentence: sentenceAround(part.text, start, end), hidden: part.hidden };
    }
  }
  return null;
}

// Whether two quotes are the same or one contains the other, ignoring the differences fold() ignores.
export function quotesOverlap(a: string, b: string): boolean {
  const foldedA = fold(a).text;
  const foldedB = fold(b).text;
  return foldedA.includes(foldedB) || foldedB.includes(foldedA);
}

const SENTENCE_LIMIT = 150;

function endsSentence(text: string, i: number): boolean {
  return text[i] === "\n" || (/[.!?]/.test(text[i]) && (i + 1 === text.length || /\s/.test(text[i + 1])));
}

// Widens a match to the sentence or line around it, up to 150 characters each way.
export function sentenceAround(text: string, start: number, end: number): string {
  let from = start;
  while (from > 0 && start - from < SENTENCE_LIMIT && !endsSentence(text, from - 1)) from--;
  let to = end;
  while (to < text.length && to - end < SENTENCE_LIMIT && !endsSentence(text, to - 1) && text[to] !== "\n") to++;
  return text.slice(from, to).trim();
}
