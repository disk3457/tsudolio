import { permissions } from "@/application/security/permissions";
import { createWorkflowUseCases } from "@/application/workflows/use-cases";
import { requirePermission } from "@/app/api/_shared/request-context";
import { prismaWorkflowRepository } from "@/infrastructure/prisma/workflow-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workflowUseCases = createWorkflowUseCases(prismaWorkflowRepository);

export async function GET(request: Request) {
  try {
    const currentUser = await requirePermission(
      request,
      permissions.approveWorkflow,
    );
    const snapshot = await workflowUseCases.getWorkflowSnapshot(currentUser);

    return dataResponse(snapshot);
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
