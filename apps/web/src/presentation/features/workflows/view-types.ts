import type { WorkflowSnapshot } from "@/application/workflows/types";

export type WorkflowLoadState = {
  snapshot: WorkflowSnapshot | null;
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

export type WorkflowTab = "pending" | "recent";
