import type {
  WorkflowDecisionInput,
  WorkflowRequestInput,
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
  createWorkflowRequest: (
    input: WorkflowRequestInput,
    context: MutationContext,
  ) => Promise<WorkflowRequestSummary>;
};

export function createWorkflowUseCases(repository: WorkflowRepository) {
  return {
    createWorkflowRequest: repository.createWorkflowRequest,
    getWorkflowSnapshot: repository.getWorkflowSnapshot,
    updateWorkflowRequestStatus: repository.updateWorkflowRequestStatus,
  };
}
