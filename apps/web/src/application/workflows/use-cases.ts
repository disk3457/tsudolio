import type {
  WorkflowDecisionInput,
  WorkflowRequestSummary,
  WorkflowSnapshot,
} from "@/application/workflows/types";
import type {
  CurrentUserContext,
  MutationContext,
} from "@/application/security/types";

export type WorkflowRepository = {
  getWorkflowSnapshot: (
    currentUser: CurrentUserContext,
  ) => Promise<WorkflowSnapshot>;
  updateWorkflowRequestStatus: (
    requestId: string,
    input: WorkflowDecisionInput,
    context: MutationContext,
  ) => Promise<WorkflowRequestSummary>;
};

export function createWorkflowUseCases(repository: WorkflowRepository) {
  return {
    getWorkflowSnapshot: repository.getWorkflowSnapshot,
    updateWorkflowRequestStatus: repository.updateWorkflowRequestStatus,
  };
}
