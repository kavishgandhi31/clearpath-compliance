import type { Change } from "diff";

const MAX_UNCHANGED_WORDS = 40;
const CONTEXT_WORDS = 12;

function splitWords(text: string) {
  return text.split(/(?<=\s)(?=\S)/);
}

// Long unchanged runs are cut down to the words next to a change, so the Reviewer reads only what changed plus a little context.
function shorten(text: string, changeBefore: boolean, changeAfter: boolean) {
  const words = splitWords(text);
  if (words.length <= MAX_UNCHANGED_WORDS) return text;
  const head = changeBefore ? words.slice(0, CONTEXT_WORDS).join("") : "";
  const tail = changeAfter ? words.slice(-CONTEXT_WORDS).join("") : "";
  return `${head}${head ? " " : ""}…${tail ? " " : ""}${tail}`;
}

// True when DiffView will cut some unchanged text down to "…".
export function isShortened(parts: Change[]) {
  return parts.some((part) => !part.added && !part.removed && splitWords(part.value).length > MAX_UNCHANGED_WORDS);
}

export function DiffView({ parts, since }: { parts: Change[]; since: number }) {
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.added) {
          return (
            <ins
              key={i}
              title={`Added since v${since}`}
              className={`rounded-sm bg-emerald-100 text-emerald-900 no-underline ${parts[i - 1]?.removed ? "ml-1" : ""}`}
            >
              {part.value}
            </ins>
          );
        }
        if (part.removed) {
          return (
            <del key={i} title={`Removed since v${since}`} className={`rounded-sm bg-red-100 text-red-900 ${parts[i - 1]?.added ? "ml-1" : ""}`}>
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
