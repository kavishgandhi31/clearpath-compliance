export type Mark = { quote: string; n: number };
export type Segment = { text: string; marks: number[] };

// Splits text into runs so every flag quote can be wrapped in a highlight, including quotes that overlap.
export function splitByQuotes(text: string, marks: Mark[]): Segment[] {
  const ranges: { start: number; end: number; n: number }[] = [];
  for (const { quote, n } of marks) {
    if (!quote) continue;
    for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + quote.length)) {
      ranges.push({ start: i, end: i + quote.length, n });
    }
  }

  const cuts = [...new Set([0, text.length, ...ranges.flatMap((r) => [r.start, r.end])])].sort((a, b) => a - b);
  const segments: Segment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [start, end] = [cuts[i], cuts[i + 1]];
    const covering = ranges.filter((r) => r.start <= start && r.end >= end).map((r) => r.n);
    segments.push({ text: text.slice(start, end), marks: [...new Set(covering)].sort((a, b) => a - b) });
  }
  return segments;
}
