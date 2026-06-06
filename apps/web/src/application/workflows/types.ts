export type WorkflowStatusValue =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "RETURNED"
  | "CANCELED";

export type WorkflowPriorityValue = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type WorkflowStatusTone =
  | "draft"
  | "wait"
  | "done"
  | "danger"
  | "returned";

export type WorkflowOption = {
  id: string;
  name: string;
};

export type WorkflowRequestSummary = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  status: WorkflowStatusValue;
  statusLabel: string;
  tone: WorkflowStatusTone;
  priority: WorkflowPriorityValue;
  priorityLabel: string;
  requester: WorkflowOption;
  organizationUnit: WorkflowOption | null;
  dueAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
};

export type WorkflowSnapshot = {
  tenant: {
    code: string;
    name: string;
    timezone: string;
  };
  canApprove: boolean;
  categories: string[];
  organizationUnits: WorkflowOption[];
  pendingRequests: WorkflowRequestSummary[];
  recentRequests: WorkflowRequestSummary[];
  myRequests: WorkflowRequestSummary[];
  stats: {
    pending: number;
    overdue: number;
    highPriority: number;
    decidedToday: number;
    myDrafts: number;
  };
};

export type WorkflowDecisionInput = {
  status: "APPROVED" | "REJECTED" | "RETURNED";
};

export type WorkflowRequestInput = {
  title: string;
  category: string;
  description: string | null;
  organizationUnitId: string | null;
  priority: WorkflowPriorityValue;
  dueAt: string | null;
  action: "DRAFT" | "SUBMIT";
};

export type WorkflowsApiResponse =
  | {
      data: WorkflowSnapshot;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type WorkflowMutationResponse =
  | {
      data: WorkflowRequestSummary;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };
