import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { type Role, users } from "@/db/schema";

export const USER_COOKIE = "clearpath_user_id";

export async function getCurrentUser() {
  const id = Number((await cookies()).get(USER_COOKIE)?.value);
  if (!Number.isInteger(id)) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

// Call at the top of every page and Server Action. Hiding a button is not a permission check.
export async function requireUser(role?: Role) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) throw new Error(`Only a ${role} can do this.`);
  return user;
}
