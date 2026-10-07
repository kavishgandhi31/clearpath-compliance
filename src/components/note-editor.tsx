"use client";

import { useState, useTransition } from "react";
import { saveNote } from "@/app/ads/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = { adId: number; ruleId: string; quote: string | null; note: string | null };

export function NoteEditor({ adId, ruleId, quote, note }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = `note-${ruleId}-${quote ?? "missing"}`;

  if (!editing && note !== null) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-md bg-muted px-3 py-2">
        <p className="whitespace-pre-wrap">
          <span className="font-medium">Your note: </span>
          {note}
        </p>
        <Button type="button" variant="ghost" size="xs" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2">
        <p className="text-muted-foreground">To clear this flag, fix the ad or add a note saying why it&apos;s fine.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          Add a note
        </Button>
      </div>
    );
  }

  function save() {
    startTransition(async () => {
      const result = await saveNote(adId, ruleId, quote, value);
      setError(result.error ?? null);
      if (!result.error) setEditing(false);
    });
  }

  function cancel() {
    setValue(note ?? "");
    setError(null);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>Your note (the Reviewer sees this)</Label>
      <Textarea id={inputId} value={value} onChange={(e) => setValue(e.target.value)} rows={2} autoFocus />
      {error && <p className="text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
