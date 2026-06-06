import type {
  WorkflowPriorityValue,
  WorkflowSnapshot,
} from "@/application/workflows/types";

export type WorkflowLoadState = {
  snapshot: WorkflowSnapshot | null;
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

export type WorkflowTab = "pending" | "mine" | "recent";

export type WorkflowFormState = {
  title: string;
  category: string;
  description: string;
  organizationUnitId: string;
  priority: WorkflowPriorityValue;
  dueAt: string;
};

export type WorkflowSaveAction = "DRAFT" | "SUBMIT";
