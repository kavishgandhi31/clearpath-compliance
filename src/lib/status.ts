import type { decisionEnum } from "@/db/schema";

export type Decision = (typeof decisionEnum.enumValues)[number];
export type AdStatus = "draft" | "awaiting_review" | Decision;

type VersionRow = { id: number; number: number; createdAt: Date };
type DecisionRow = { id: number; versionId: number; decision: Decision; createdAt: Date };

export type DerivedStatus<V extends VersionRow, D extends DecisionRow> = {
  status: AdStatus;
  latestVersion: V | null;
  // The newest decision on latestVersion, if any.
  latestDecision: D | null;
  lastApprovedVersion: V | null;
};

// status and lastApprovedVersion are never stored. Deriving them from versions + decisions on every read means they can't drift.
export function deriveStatus<V extends VersionRow, D extends DecisionRow>(
  versions: V[],
  decisions: D[],
): DerivedStatus<V, D> {
  const newestFirst = [...versions].sort((a, b) => b.number - a.number);
  const latestVersion = newestFirst[0] ?? null;
  if (!latestVersion) {
    return { status: "draft", latestVersion: null, latestDecision: null, lastApprovedVersion: null };
  }

  const latestDecision =
    decisions.filter((d) => d.versionId === latestVersion.id).sort((a, b) => b.id - a.id)[0] ?? null;
  const approvedVersionIds = new Set(decisions.filter((d) => d.decision === "approved").map((d) => d.versionId));

  return {
    status: latestDecision?.decision ?? "awaiting_review",
    latestVersion,
    latestDecision,
    lastApprovedVersion: newestFirst.find((v) => approvedVersionIds.has(v.id)) ?? null,
  };
}
