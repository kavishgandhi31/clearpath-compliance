import { DEMO_PAGE_PATH } from "@/check/demo-page";
import type { DraftContent } from "@/check/types";
import { type ads, channelEnum, productEnum, sourceEnum } from "@/db/schema";

type AdRow = typeof ads.$inferSelect;

// What the ad form sends. Server Actions can be called with anything, so every field is re-checked in parseDraft.
export type DraftInput = {
  title: string;
  product: string;
  source: string;
  affiliateId: string;
  channel: string;
  subject: string;
  text: string;
  url: string;
};

export type DraftValues = Pick<
  AdRow,
  "title" | "product" | "source" | "affiliateId" | "channel" | "draftSubject" | "draftText" | "draftUrl"
>;

export function draftInputFrom(ad: AdRow): DraftInput {
  return {
    title: ad.title,
    product: ad.product,
    source: ad.source,
    affiliateId: ad.affiliateId === null ? "" : String(ad.affiliateId),
    channel: ad.channel,
    subject: ad.draftSubject ?? "",
    text: ad.draftText ?? "",
    url: ad.draftUrl ?? "",
  };
}

export function toDraftContent(ad: Pick<AdRow, "channel" | "draftSubject" | "draftText" | "draftUrl">): DraftContent {
  return ad.channel === "web_page"
    ? { kind: "url", url: ad.draftUrl ?? "" }
    : { kind: "text", subject: ad.draftSubject, text: ad.draftText ?? "" };
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function field(input: DraftInput, key: keyof DraftInput): string {
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export function parseDraft(input: DraftInput, ownAffiliateIds: number[]): { error: string } | { values: DraftValues } {
  const [title, product, source, channel] = (["title", "product", "source", "channel"] as const).map((key) =>
    field(input, key),
  );
  if (!title) return { error: "Give the ad a title." };
  if (!isOneOf(productEnum.enumValues, product)) return { error: "Pick a product." };
  if (!isOneOf(sourceEnum.enumValues, source)) return { error: "Pick a source." };
  if (!isOneOf(channelEnum.enumValues, channel)) return { error: "Pick a channel." };

  let affiliateId: number | null = null;
  if (source === "affiliate") {
    affiliateId = Number(field(input, "affiliateId"));
    if (!ownAffiliateIds.includes(affiliateId)) return { error: "Pick one of your affiliates." };
    if (channel !== "web_page") return { error: "Affiliate ads are web pages." };
  }

  const base = { title, product, source, affiliateId, channel };
  if (channel === "web_page") {
    const url = field(input, "url");
    const isWebAddress = URL.canParse(url) && ["http:", "https:"].includes(new URL(url).protocol);
    if (!isWebAddress && !DEMO_PAGE_PATH.test(url)) {
      return {
        error: "Enter the page's full address, starting with http:// or https://, or a demo page path like /demo/loanfinder.",
      };
    }
    return { values: { ...base, draftSubject: null, draftText: null, draftUrl: url } };
  }

  const text = field(input, "text");
  if (!text) return { error: "Add the ad's text." };
  if (channel === "email") {
    const subject = field(input, "subject");
    if (!subject) return { error: "Add the email's subject line." };
    return { values: { ...base, draftSubject: subject, draftText: text, draftUrl: null } };
  }
  return { values: { ...base, draftSubject: null, draftText: text, draftUrl: null } };
}
