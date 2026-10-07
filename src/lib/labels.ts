import type { Role } from "@/db/schema";

export const roleLabels: Record<Role, string> = {
  submitter: "Submitter",
  reviewer: "Reviewer",
};
