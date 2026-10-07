import { diffWords } from "diff";
import { DiffView } from "@/components/diff-view";

type Text = { subject: string | null; url: string | null; visibleText: string; hiddenText: string };

export function WhatChanged({ before, after }: { before: Text & { number: number }; after: Text }) {
  // diffWords skips whitespace, so a whitespace-only edit has no added or removed part and is left out.
  const fields = [
    { label: "Subject line", parts: diffWords(before.subject ?? "", after.subject ?? "") },
    { label: "URL", parts: diffWords(before.url ?? "", after.url ?? "") },
    { label: "Text", parts: diffWords(before.visibleText, after.visibleText) },
    { label: "Hidden text", parts: diffWords(before.hiddenText, after.hiddenText) },
  ].filter((field) => field.parts.some((part) => part.added || part.removed));

  if (fields.length === 0) return <p className="text-muted-foreground">The text is the same as v{before.number}.</p>;
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground uppercase">{field.label}</span>
          <DiffView parts={field.parts} />
        </div>
      ))}
    </div>
  );
}
