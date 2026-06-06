import {
  getClientIpAddress,
  requirePermission,
} from "@/app/api/_shared/request-context";
import { parseTenantProfileInput } from "@/application/operations/operations-validation";
import { createOperationsUseCases } from "@/application/operations/use-cases";
import { permissions, toMutationContext } from "@/application/security/permissions";
import { prismaOperationsRepository } from "@/infrastructure/prisma/operations-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const operationsUseCases = createOperationsUseCases(
  prismaOperationsRepository,
);

export async function GET(request: Request) {
  try {
    const currentUser = await requirePermission(
      request,
      permissions.manageTenant,
    );

    return dataResponse(
      await operationsUseCases.getOperationsSnapshot(currentUser),
    );
  } catch (error) {
    return operationsErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await requirePermission(
      request,
      permissions.manageTenant,
    );
    const input = parseTenantProfileInput(
      await readRequestJson(
        request,
        "テナント設定データのJSONを読み取れませんでした。",
      ),
    );
    const snapshot = await operationsUseCases.updateTenantProfile(
      input,
      toMutationContext(currentUser, {
        ipAddress: getClientIpAddress(request),
      }),
    );

    return dataResponse(snapshot);
  } catch (error) {
    return operationsErrorResponse(error);
  }
}

function operationsErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "OPERATIONS_DATA_UNAVAILABLE",
    "運用管理データを処理できませんでした。",
  );
}
