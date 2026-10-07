import { asc, eq } from "drizzle-orm";
import { AdForm } from "@/components/ad-form";
import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export default async function NewAdPage() {
  const user = await requireUser("submitter");
  const myAffiliates = await db
    .select({ id: affiliates.id, name: affiliates.name })
    .from(affiliates)
    .where(eq(affiliates.ownerId, user.id))
    .orderBy(asc(affiliates.name));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold">New ad</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save it as a draft, then run the check and fix any flags before you submit.
        </p>
      </div>
      <AdForm
        initial={{ title: "", product: "", source: "", affiliateId: "", channel: "", subject: "", text: "", url: "" }}
        affiliates={myAffiliates}
        locked={false}
      />
    </main>
  );
}
