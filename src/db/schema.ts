import { isNull, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Flag, RuleSnapshot } from "../check/types";

export const roleEnum = pgEnum("role", ["submitter", "reviewer"]);
export const productEnum = pgEnum("product", ["personal_loan", "credit_card", "mortgage"]);
export const channelEnum = pgEnum("channel", ["email", "social_post", "web_page"]);
export const sourceEnum = pgEnum("source", ["clearpath", "affiliate"]);
export const severityEnum = pgEnum("severity", ["blocker", "warning"]);
export const versionCreatedViaEnum = pgEnum("version_created_via", ["submitted", "approved_from_alert"]);
export const decisionEnum = pgEnum("decision", ["approved", "changes_requested", "rejected"]);
export const alertColorEnum = pgEnum("alert_color", ["red", "gray"]);

export type Role = (typeof roleEnum.enumValues)[number];
export type Product = (typeof productEnum.enumValues)[number];
export type Channel = (typeof channelEnum.enumValues)[number];
export type Source = (typeof sourceEnum.enumValues)[number];

// A timestamp column that's filled in with the time the row is inserted.
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  email: text().notNull(),
  role: roleEnum().notNull(),
});

export const approvedTexts = pgTable("approved_texts", {
  id: text().primaryKey(),
  name: text().notNull(),
  text: text().notNull(),
});

export const rules = pgTable("rules", {
  id: text().primaryKey(),
  name: text().notNull(),
  requiredApprovedTextId: text().references(() => approvedTexts.id),
  bannedPhrases: text().array().notNull().default(sql`'{}'`),
  aiInstruction: text(),
  products: productEnum().array().notNull(),
  channels: channelEnum().array().notNull(),
  sources: sourceEnum().array().notNull(),
  severity: severityEnum().notNull(),
  basedOn: text().notNull(),
});

export const affiliates = pgTable("affiliates", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  website: text().notNull(),
  contactEmail: text().notNull(),
  ownerId: integer().notNull().references(() => users.id),
});

export const demoPages = pgTable("demo_pages", {
  slug: text().primaryKey(),
  headline: text().notNull(),
  body: text().notNull(),
  showDisclosure: boolean().notNull(),
  hiddenText: text().notNull().default(""),
});

export const ads = pgTable("ads", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  product: productEnum().notNull(),
  channel: channelEnum().notNull(),
  source: sourceEnum().notNull(),
  affiliateId: integer().references(() => affiliates.id),
  ownerId: integer().notNull().references(() => users.id),
  draftSubject: text(),
  draftText: text(),
  draftUrl: text(),
  liveVersionId: integer().references((): AnyPgColumn => adVersions.id),
  lastScannedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

export const adVersions = pgTable(
  "ad_versions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    adId: integer().notNull().references(() => ads.id),
    number: integer().notNull(),
    subject: text(),
    url: text(),
    visibleText: text().notNull(),
    hiddenText: text().notNull().default(""),
    hash: text().notNull(),
    createdVia: versionCreatedViaEnum().notNull(),
    createdById: integer().notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.adId, t.number)],
);

export const decisions = pgTable("decisions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  versionId: integer().notNull().references(() => adVersions.id),
  decision: decisionEnum().notNull(),
  reviewerId: integer().notNull().references(() => users.id),
  comment: text(),
  createdAt: createdAt(),
});

export const pageScans = pgTable("page_scans", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  adId: integer().notNull().references(() => ads.id),
  fetchedAt: createdAt(),
  failureReason: text(),
  visibleText: text(),
  hiddenText: text(),
  hash: text(),
  matchedVersionId: integer().references(() => adVersions.id),
});

export const checks = pgTable("checks", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  adId: integer().notNull().references(() => ads.id),
  versionId: integer().references(() => adVersions.id),
  pageScanId: integer().references(() => pageScans.id),
  contentHash: text().notNull(),
  rulesUsed: jsonb().$type<RuleSnapshot[]>().notNull(),
  model: text(),
  flags: jsonb().$type<Flag[]>().notNull(),
  createdAt: createdAt(),
});

export const flagNotes = pgTable(
  "flag_notes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    adId: integer().notNull().references(() => ads.id),
    ruleId: text().notNull().references(() => rules.id),
    quote: text(),
    note: text().notNull(),
    authorId: integer().notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.adId, t.ruleId, t.quote).nullsNotDistinct()],
);

export const alerts = pgTable(
  "alerts",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    adId: integer().notNull().references(() => ads.id),
    latestScanId: integer().notNull().references(() => pageScans.id),
    color: alertColorEnum().notNull(),
    resolution: text(),
    openedAt: createdAt(),
    closedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex("one_open_alert_per_ad").on(t.adId).where(isNull(t.closedAt))],
);

export const events = pgTable("events", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  adId: integer().references(() => ads.id),
  actorId: integer().references(() => users.id),
  action: text().notNull(),
  details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

export const outbox = pgTable("outbox", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  to: text().notNull(),
  cc: text(),
  subject: text().notNull(),
  body: text().notNull(),
  adId: integer().references(() => ads.id),
  createdAt: createdAt(),
});
