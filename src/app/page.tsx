import { requireUser } from "@/lib/auth";

export default async function Home() {
  const user = await requireUser();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-xl font-semibold">Home</h1>
      <p className="mt-1 text-sm text-muted-foreground">Signed in as {user.name}.</p>
    </main>
  );
}
