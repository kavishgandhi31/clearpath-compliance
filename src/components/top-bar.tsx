import { count, isNull } from "drizzle-orm";
import Link from "next/link";
import { ResetButton } from "@/components/reset-button";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function TopBar() {
  const user = await getCurrentUser();
  const [openAlerts] =
    user?.role === "reviewer" ? await db.select({ n: count() }).from(alerts).where(isNull(alerts.closedAt)) : [];

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold">
            ClearPath Review
          </Link>
          {user && (
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              {user.role === "submitter" ? (
                <Link href="/ads" className="hover:text-foreground">
                  My ads
                </Link>
              ) : (
                <>
                  <Link href="/review" className="hover:text-foreground">
                    Review queue
                  </Link>
                  <Link href="/alerts" className="hover:text-foreground">
                    Alerts ({openAlerts?.n ?? 0})
                  </Link>
                </>
              )}
              <Link href="/rules" className="hover:text-foreground">
                Rules
              </Link>
              <Link href="/outbox" className="hover:text-foreground">
                Outbox
              </Link>
            </nav>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.name}</span>
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Switch role</Link>
            </Button>
            {process.env.DEMO_MODE === "true" && <ResetButton />}
          </div>
        )}
      </div>
    </header>
  );
}
