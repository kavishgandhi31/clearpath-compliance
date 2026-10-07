"use client";

import { useState, useTransition } from "react";
import { decide } from "@/app/ads/[id]/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Decision } from "@/lib/status";

type Props = { adId: number; versionId: number; versionNumber: number };

export function DecisionPanel({ adId, versionId, versionNumber }: Props) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(decision: Decision) {
    if (decision !== "approved" && !comment.trim()) {
      setError("Add a comment so the Submitter knows what to fix.");
      return;
    }
    startTransition(async () => {
      const result = await decide(adId, versionId, decision, comment);
      setError(result.error ?? null);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-medium">Your decision on version {versionNumber}</h2>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comment">Comment</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Required for Request changes and Reject"
          rows={3}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => submit("approved")} disabled={pending}>
          Approve
        </Button>
        <Button type="button" variant="outline" onClick={() => submit("changes_requested")} disabled={pending}>
          Request changes
        </Button>
        <Button type="button" variant="destructive" onClick={() => submit("rejected")} disabled={pending}>
          Reject
        </Button>
      </div>
    </section>
  );
}
