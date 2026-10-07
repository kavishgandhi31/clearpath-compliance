import { asc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { roleLabels } from "@/lib/labels";
import { signIn } from "./actions";

export default async function LoginPage() {
  const [currentUser, allUsers] = await Promise.all([
    getCurrentUser(),
    db.select().from(users).orderBy(asc(users.id)),
  ]);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Sign in as</CardTitle>
          <CardDescription>Pick a role. This demo has no passwords.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {allUsers.map((user) => (
            <form key={user.id} action={signIn}>
              <input type="hidden" name="userId" value={user.id} />
              <Button
                type="submit"
                variant={user.id === currentUser?.id ? "default" : "outline"}
                size="lg"
                className="w-full justify-between"
              >
                {user.name}
                <span className="text-xs opacity-70">{roleLabels[user.role]}</span>
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
