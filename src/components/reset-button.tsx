"use client";

import { useTransition } from "react";
import { resetDemo } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function ResetButton() {
  const [pending, startTransition] = useTransition();

  function reset() {
    if (!confirm("Reset the demo? This deletes every ad, decision and email and reloads the starting data.")) return;
    startTransition(() => resetDemo());
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={reset} disabled={pending}>
      {pending ? "Resetting…" : "Reset"}
    </Button>
  );
}
