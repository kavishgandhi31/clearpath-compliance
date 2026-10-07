import type { Channel, Product, Role, Source, versionCreatedViaEnum } from "@/db/schema";
import type { Flag } from "@/check/types";
import type { AdStatus, Decision } from "./status";

type VersionCreatedVia = (typeof versionCreatedViaEnum.enumValues)[number];

export const roleLabels: Record<Role, string> = {
  submitter: "Submitter",
  reviewer: "Reviewer",
};

export const productLabels: Record<Product, string> = {
  personal_loan: "Personal loan",
  credit_card: "Credit card",
  mortgage: "Mortgage",
};

export const channelLabels: Record<Channel, string> = {
  email: "Email",
  social_post: "Social post",
  web_page: "Web page",
};

export const sourceLabels: Record<Source, string> = {
  clearpath: "ClearPath",
  affiliate: "Affiliate",
};

export const statusLabels: Record<AdStatus, string> = {
  draft: "Draft",
  awaiting_review: "Awaiting review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};

export const decisionLabels: Record<Decision, string> = {
  approved: "Approved",
  changes_requested: "Changes requested",
  rejected: "Rejected",
};

export const createdViaLabels: Record<VersionCreatedVia, string> = {
  submitted: "Submitted",
  approved_from_alert: "Approved from alert",
};

export const foundByLabels: Record<Flag["foundBy"], string> = {
  text_check: "Text check",
  ai_check: "AI check",
  phrase_search: "Phrase search",
  injection_guard: "Injection guard",
};

export const eventLabels: Record<string, string> = {
  ad_created: "Created the ad",
  draft_saved: "Saved the draft",
  check_run: "Ran the check",
  check_failed: "Check couldn't run",
  note_saved: "Wrote a note",
  submit_blocked: "Tried to submit",
  submitted: "Submitted",
  approved: "Approved",
  changes_requested: "Requested changes",
  rejected: "Rejected",
};
