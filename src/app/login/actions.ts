"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { USER_COOKIE } from "@/lib/auth";

export async function signIn(formData: FormData) {
  const id = Number(formData.get("userId"));
  if (!Number.isInteger(id)) throw new Error("Unknown user.");
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw new Error("Unknown user.");

  (await cookies()).set(USER_COOKIE, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/");
}
