import { requireMutationContext } from "@/app/api/_shared/request-context";
import { parseOperationsRestoreDryRunInput } from "@/application/operations/operations-validation";
import { createOperationsUseCases } from "@/application/operations/use-cases";
import { permissions } from "@/application/security/permissions";
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

export async function POST(request: Request) {
  try {
    const context = await requireMutationContext(
      request,
      permissions.manageTenant,
    );
    const input = parseOperationsRestoreDryRunInput(
      await readRequestJson(
        request,
        "復元リクエストJSONを読み取れませんでした。",
      ),
    );
    const report = await operationsUseCases.previewOperationsRestore(
      input,
      context,
    );

    return dataResponse(report);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "OPERATIONS_RESTORE_DRY_RUN_UNAVAILABLE",
      "復元ドライランを実行できませんでした。",
    );
  }
}
