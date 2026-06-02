import { permissions } from "@/application/security/permissions";
import { createWorkflowUseCases } from "@/application/workflows/use-cases";
import { parseWorkflowDecisionInput } from "@/application/workflows/workflow-validation";
import { requireMutationContext } from "@/app/api/_shared/request-context";
import { prismaWorkflowRepository } from "@/infrastructure/prisma/workflow-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workflowUseCases = createWorkflowUseCases(prismaWorkflowRepository);

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const mutationContext = await requireMutationContext(
      request,
      permissions.approveWorkflow,
    );
    const { requestId } = await context.params;
    const input = parseWorkflowDecisionInput(
      await readRequestJson(
        request,
        "申請決裁データのJSONを読み取れませんでした。",
      ),
    );
    const workflowRequest =
      await workflowUseCases.updateWorkflowRequestStatus(
        requestId,
        input,
        mutationContext,
      );

    return dataResponse(workflowRequest);
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

function workflowErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "WORKFLOW_DATA_UNAVAILABLE",
    "申請データを処理できませんでした。",
  );
}
