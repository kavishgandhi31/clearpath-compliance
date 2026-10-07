import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { ads, outbox } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

function Linkified({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words">
      {text.split(/(https?:\/\/\S+)/).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} className="underline underline-offset-3">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export default async function OutboxPage() {
  await requireUser();
  const emails = await db
    .select({ email: outbox, adTitle: ads.title })
    .from(outbox)
    .leftJoin(ads, eq(ads.id, outbox.adId))
    .orderBy(desc(outbox.id));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold">Outbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every email ClearPath Review would have sent. This demo doesn&apos;t send real email, so every email shows up
          here for every role, including ones to affiliates, who don&apos;t sign in to the app.
        </p>
      </div>

      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground">No emails yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {emails.map(({ email, adTitle }) => (
            <li key={email.id} className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{email.subject}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(email.createdAt)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                To: {email.to}
                {email.adId !== null && (
                  <>
                    {" · Ad: "}
                    <Link href={`/ads/${email.adId}`} className="underline underline-offset-3">
                      {adTitle}
                    </Link>
                  </>
                )}
              </p>
              <Linkified text={email.body} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
