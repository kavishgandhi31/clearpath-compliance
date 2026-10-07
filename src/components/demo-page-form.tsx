"use client";

import { type FormEvent, useState, useTransition } from "react";
import { saveDemoPage } from "@/app/demo/[slug]/edit/actions";
import type { DemoPageFields } from "@/check/demo-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DemoPageForm({ slug, initial }: { slug: string; initial: DemoPageFields }) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof DemoPageFields>(key: K, value: DemoPageFields[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      await saveDemoPage(slug, values);
      setSaved(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="headline">Headline</Label>
        <Input id="headline" value={values.headline} onChange={(e) => set("headline", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">Body text</Label>
        <Textarea id="body" value={values.body} onChange={(e) => set("body", e.target.value)} rows={12} />
        <p className="text-xs text-muted-foreground">A blank line starts a new paragraph.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.showDisclosure}
          onChange={(e) => set("showDisclosure", e.target.checked)}
          className="size-4"
        />
        Show the advertiser disclosure
      </label>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hiddenText">Hidden text</Label>
        <Textarea id="hiddenText" value={values.hiddenText} onChange={(e) => set("hiddenText", e.target.value)} rows={3} />
        <p className="text-xs text-muted-foreground">
          On the page but not shown to visitors, in an element with the hidden attribute.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {saved && !pending && <span className="text-sm text-muted-foreground">Saved. The live page shows this now.</span>}
      </div>
    </form>
  );
}
