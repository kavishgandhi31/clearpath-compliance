"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import type { DemoPageFields } from "@/check/demo-page";
import { db } from "@/db";
import { demoPages } from "@/db/schema";
import { requireUser } from "@/lib/auth";

// Not written to the audit log: this stands in for the affiliate editing their own website, which ClearPath can't see.
export async function saveDemoPage(slug: string, input: DemoPageFields): Promise<void> {
  await requireUser();
  const { headline, body, showDisclosure, hiddenText } = input;
  if (![headline, body, hiddenText].every((value) => typeof value === "string") || typeof showDisclosure !== "boolean") {
    throw new Error("Unknown fields.");
  }
  const [saved] = await db
    .update(demoPages)
    .set({ headline, body, showDisclosure, hiddenText })
    .where(eq(demoPages.slug, String(slug)))
    .returning({ slug: demoPages.slug });
  if (!saved) throw new Error("Unknown demo page.");
  refresh();
}
