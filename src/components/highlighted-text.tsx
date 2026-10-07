import { type Mark, splitByQuotes } from "@/lib/highlight";

export function HighlightedText({ text, marks }: { text: string; marks: Mark[] }) {
  const segments = splitByQuotes(text, marks);
  return (
    <p className="whitespace-pre-wrap break-words">
      {segments.map((segment, i) => {
        if (segment.marks.length === 0) return <span key={i}>{segment.text}</span>;
        // Put the flag number only where its quote ends, so a quote split by an overlap isn't numbered twice.
        const ending = segment.marks.filter((n) => !segments[i + 1]?.marks.includes(n));
        return (
          <mark key={i} className="rounded-sm bg-amber-200/70 text-foreground" title={`Flag ${segment.marks.join(", ")}`}>
            {segment.text}
            {ending.length > 0 && (
              <sup className="ml-0.5 font-semibold text-amber-900">{ending.join(",")}</sup>
            )}
          </mark>
        );
      })}
    </p>
  );
}
