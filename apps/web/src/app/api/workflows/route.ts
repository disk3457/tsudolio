import { toMutationContext } from "@/application/security/permissions";
import { createWorkflowUseCases } from "@/application/workflows/use-cases";
import { parseWorkflowRequestInput } from "@/application/workflows/workflow-validation";
import {
  getClientIpAddress,
  getCurrentUserFromRequest,
} from "@/app/api/_shared/request-context";
import { prismaWorkflowRepository } from "@/infrastructure/prisma/workflow-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workflowUseCases = createWorkflowUseCases(prismaWorkflowRepository);

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const snapshot = await workflowUseCases.getWorkflowSnapshot(currentUser);

    return dataResponse(snapshot);
  } catch (error) {
    return workflowErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    const context = toMutationContext(currentUser, {
      ipAddress: getClientIpAddress(request),
    });
    const input = parseWorkflowRequestInput(
      await readRequestJson(
        request,
        "申請データのJSONを読み取れませんでした。",
      ),
    );
    const workflowRequest = await workflowUseCases.createWorkflowRequest(
      input,
      context,
    );

    return dataResponse(workflowRequest, 201);
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
