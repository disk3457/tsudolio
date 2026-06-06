import { requireMutationContext } from "@/app/api/_shared/request-context";
import { parseOperationsImportCandidate } from "@/application/operations/operations-validation";
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
    const input = parseOperationsImportCandidate(
      await readRequestJson(
        request,
        "運用エクスポートJSONを読み取れませんでした。",
      ),
    );
    const report =
      await operationsUseCases.validateOperationsImportCandidate(
        input,
        context,
      );

    return dataResponse(report);
  } catch (error) {
    return applicationErrorResponse(
      error,
      "OPERATIONS_IMPORT_UNAVAILABLE",
      "運用エクスポートJSONを検査できませんでした。",
    );
  }
}
