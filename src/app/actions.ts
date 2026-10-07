"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events } from "@/db/schema";
import { resetAndSeed } from "@/db/seed";
import { requireUser, USER_COOKIE } from "@/lib/auth";

export async function resetDemo() {
  const user = await requireUser();
  if (process.env.DEMO_MODE !== "true") throw new Error("Reset is only available in demo mode.");

  await resetAndSeed(db);
  // The reset recreated the users table, so the old user ID may no longer mean the same person. Record who by name instead.
  await db.insert(events).values({ action: "demo_reset", details: { by: user.name } });
  (await cookies()).delete(USER_COOKIE);
  redirect("/login");
}
