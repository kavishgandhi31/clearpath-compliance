"use client";

import { useState, useTransition } from "react";
import { rescan } from "@/app/alerts/actions";
import { Button } from "@/components/ui/button";

export function RescanButton({ adId }: { adId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await rescan(adId);
      setError(result.error ?? null);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={pending}>
        {pending ? "Scanning…" : "Re-scan now"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
