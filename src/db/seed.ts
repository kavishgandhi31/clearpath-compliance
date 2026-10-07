import { sql } from "drizzle-orm";
import type { Db } from "./index";
import {
  adVersions,
  ads,
  affiliates,
  alerts,
  approvedTexts,
  checks,
  decisions,
  demoPages,
  events,
  flagNotes,
  outbox,
  pageScans,
  rules,
  users,
} from "./schema";
import { seedApprovedTexts, seedRules, seedUsers } from "./seed-data";

const allTables = [
  users,
  approvedTexts,
  rules,
  affiliates,
  demoPages,
  ads,
  adVersions,
  decisions,
  pageScans,
  checks,
  flagNotes,
  alerts,
  events,
  outbox,
];

// Wipes every table and refills it with the starting data. Uses TRUNCATE because the events trigger rejects DELETE.
export async function resetAndSeed(db: Db) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE ${sql.join(allTables, sql`, `)} RESTART IDENTITY CASCADE`);
    await tx.insert(users).values(seedUsers);
    await tx.insert(approvedTexts).values(seedApprovedTexts);
    await tx.insert(rules).values(seedRules);
  });
}
