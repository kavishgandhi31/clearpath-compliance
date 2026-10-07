import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export async function TopBar() {
  const user = await getCurrentUser();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold">
          ClearPath Review
        </Link>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.name}</span>
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Switch role</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
