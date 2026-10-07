import type { Change } from "diff";

const MAX_UNCHANGED_WORDS = 40;
const CONTEXT_WORDS = 12;

// Long unchanged runs are cut down to the words next to a change, so the Reviewer reads only what changed plus a little context.
function shorten(text: string, changeBefore: boolean, changeAfter: boolean) {
  const words = text.split(/(?<=\s)(?=\S)/);
  if (words.length <= MAX_UNCHANGED_WORDS) return text;
  const head = changeBefore ? words.slice(0, CONTEXT_WORDS).join("") : "";
  const tail = changeAfter ? words.slice(-CONTEXT_WORDS).join("") : "";
  return `${head}${head ? " " : ""}…${tail ? " " : ""}${tail}`;
}

export function DiffView({ parts }: { parts: Change[] }) {
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.added) {
          return (
            <ins key={i} className="rounded-sm bg-emerald-100 text-emerald-900 no-underline">
              {part.value}
            </ins>
          );
        }
        if (part.removed) {
          return (
            <del key={i} className="rounded-sm bg-red-100 text-red-900">
              {part.value}
            </del>
          );
        }
        return (
          <span key={i} className="text-muted-foreground">
            {shorten(part.value, i > 0, i < parts.length - 1)}
          </span>
        );
      })}
    </p>
  );
}
