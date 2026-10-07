"use client";

import { type FormEvent, useState, useTransition } from "react";
import { createAd, runDraftCheck, saveDraft, submitAd } from "@/app/ads/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DraftInput } from "@/lib/draft";
import { channelLabels, productLabels, sourceLabels } from "@/lib/labels";

type Intent = "save" | "check" | "submit";

type Props = {
  // Missing on /ads/new: the only action there is creating the draft.
  adId?: number;
  initial: DraftInput;
  affiliates: { id: number; name: string }[];
  // Product, source and channel lock once the ad has a version.
  locked: boolean;
  // True while a version is waiting for review. The page's banner says why.
  submitLocked?: boolean;
};

const pendingLabels: Record<Intent, string> = {
  save: "Saving…",
  check: "Running the check…",
  submit: "Checking and submitting…",
};

export function AdForm({ adId, initial, affiliates, locked, submitLocked = false }: Props) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof DraftInput>(key: K, value: DraftInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setSource(source: string) {
    setValues((current) =>
      source === "affiliate"
        ? { ...current, source, channel: "web_page", affiliateId: current.affiliateId || String(affiliates[0]?.id ?? "") }
        : { ...current, source, affiliateId: "" },
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const chosen = (submitter?.value ?? "save") as Intent;
    setIntent(chosen);
    startTransition(async () => {
      const result =
        adId === undefined
          ? await createAd(values)
          : chosen === "check"
            ? await runDraftCheck(adId, values)
            : chosen === "submit"
              ? await submitAd(adId, values)
              : await saveDraft(adId, values);
      setError(result?.error ?? null);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={values.title} onChange={(e) => set("title", e.target.value)} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product">Product</Label>
          <NativeSelect
            id="product"
            className="w-full"
            value={values.product}
            onChange={(e) => set("product", e.target.value)}
            disabled={locked}
            required
          >
            <NativeSelectOption value="" disabled>
              Pick a product
            </NativeSelectOption>
            {Object.entries(productLabels).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="source">Source</Label>
          <NativeSelect
            id="source"
            className="w-full"
            value={values.source}
            onChange={(e) => setSource(e.target.value)}
            disabled={locked}
            required
          >
            <NativeSelectOption value="" disabled>
              Pick a source
            </NativeSelectOption>
            {Object.entries(sourceLabels).map(([value, label]) => (
              <NativeSelectOption key={value} value={value} disabled={value === "affiliate" && affiliates.length === 0}>
                {value === "affiliate" && affiliates.length === 0 ? `${label} (you have none)` : label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        {values.source === "affiliate" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="affiliate">Affiliate</Label>
            <NativeSelect
              id="affiliate"
              className="w-full"
              value={values.affiliateId}
              onChange={(e) => set("affiliateId", e.target.value)}
              disabled={locked}
            >
              {affiliates.map((affiliate) => (
                <NativeSelectOption key={affiliate.id} value={String(affiliate.id)}>
                  {affiliate.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="channel">Channel</Label>
          <NativeSelect
            id="channel"
            className="w-full"
            value={values.channel}
            onChange={(e) => set("channel", e.target.value)}
            disabled={locked}
            required
          >
            <NativeSelectOption value="" disabled>
              Pick a channel
            </NativeSelectOption>
            {Object.entries(channelLabels).map(([value, label]) => (
              <NativeSelectOption
                key={value}
                value={value}
                disabled={values.source === "affiliate" && value !== "web_page"}
              >
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      {locked && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Product, source and channel are locked once the ad has been submitted.
        </p>
      )}

      {values.channel === "web_page" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="url">Page URL</Label>
          <Input
            id="url"
            value={values.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://"
            required
          />
          <p className="text-xs text-muted-foreground">
            A live page, a preview link, an unlisted draft page, or a demo page path like /demo/loanfinder.
          </p>
        </div>
      ) : (
        values.channel !== "" && (
          <>
            {values.channel === "email" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="subject">Subject line</Label>
                <Input id="subject" value={values.subject} onChange={(e) => set("subject", e.target.value)} required />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="text">Text</Label>
              <Textarea
                id="text"
                value={values.text}
                onChange={(e) => set("text", e.target.value)}
                rows={10}
                required
              />
            </div>
          </>
        )
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" value="save" variant={adId === undefined ? "default" : "outline"} disabled={pending}>
          Save draft
        </Button>
        {adId !== undefined && (
          <>
            <Button type="submit" value="check" variant="outline" disabled={pending}>
              Run check
            </Button>
            <Button type="submit" value="submit" disabled={pending || submitLocked}>
              Submit
            </Button>
          </>
        )}
        {pending && intent && <span className="text-sm text-muted-foreground">{pendingLabels[intent]}</span>}
      </div>
    </form>
  );
}
