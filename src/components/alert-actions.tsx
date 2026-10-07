"use client";

import { useState, useTransition } from "react";
import { approveAsIs, requestFix } from "@/app/alerts/actions";
import { RescanButton } from "@/components/rescan-button";
import { Button } from "@/components/ui/button";
import { suspiciousApproveMessage } from "@/lib/labels";

type Props = { alertId: number; adId: number; scanId: number; flagCount: number; suspicious: boolean };

export function AlertActions({ alertId, adId, scanId, flagCount, suspicious }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    if (flagCount > 0 && !confirm(`The live text has ${flagCount === 1 ? "1 flag" : `${flagCount} flags`}. Approve it anyway?`)) {
      return;
    }
    startTransition(async () => setError((await approveAsIs(alertId, scanId)).error ?? null));
  }

  function fix() {
    startTransition(async () => setError((await requestFix(alertId)).error ?? null));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start gap-2">
        <Button type="button" size="sm" onClick={approve} disabled={pending || suspicious}>
          Approve as-is
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={fix} disabled={pending}>
          Request fix
        </Button>
        <RescanButton adId={adId} />
      </div>
      {suspicious && <p className="text-sm text-muted-foreground">{suspiciousApproveMessage}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
