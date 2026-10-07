import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoPageForm } from "@/components/demo-page-form";
import { db } from "@/db";
import { ads, affiliates, demoPages } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export default async function EditDemoPage(props: PageProps<"/demo/[slug]/edit">) {
  await requireUser();
  const { slug } = await props.params;
  const path = `/demo/${slug}`;
  const [[page], [ad]] = await Promise.all([
    db.select().from(demoPages).where(eq(demoPages.slug, slug)),
    db
      .select({ id: ads.id, affiliateName: affiliates.name })
      .from(ads)
      .leftJoin(affiliates, eq(affiliates.id, ads.affiliateId))
      .where(eq(ads.draftUrl, path))
      .orderBy(asc(ads.id))
      .limit(1),
  ]);
  if (!page) notFound();
  const site = ad?.affiliateName ? `${ad.affiliateName}'s` : "the affiliate's";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Edit demo page</h1>
        <div className="ml-auto flex gap-4 text-sm">
          <a href={path} target="_blank" rel="noopener noreferrer" className="underline underline-offset-3">
            View page
          </a>
          {ad && (
            <Link href={`/ads/${ad.id}`} className="underline underline-offset-3">
              Back to the ad
            </Link>
          )}
        </div>
      </div>
      <div className="rounded-lg border bg-muted px-4 py-3 text-sm">
        This stands in for {site} own website. Saving changes the live page at {path} right away. ClearPath only notices
        on the next Re-scan.
      </div>
      <DemoPageForm
        slug={slug}
        initial={{ headline: page.headline, body: page.body, showDisclosure: page.showDisclosure, hiddenText: page.hiddenText }}
      />
    </main>
  );
}
