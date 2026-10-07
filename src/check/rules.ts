import { and, arrayContains, asc } from "drizzle-orm";
import { db } from "../db";
import { rules } from "../db/schema";
import type { AdContext, RuleSnapshot } from "./types";

// Loads the rules that apply to an ad's product, channel and source.
export function loadApplicableRules(ad: AdContext): Promise<RuleSnapshot[]> {
  return db
    .select()
    .from(rules)
    .where(
      and(
        arrayContains(rules.products, [ad.product]),
        arrayContains(rules.channels, [ad.channel]),
        arrayContains(rules.sources, [ad.source]),
      ),
    )
    .orderBy(asc(rules.id));
}
