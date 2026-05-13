import { createDocumentUseCases } from "@/application/documents/use-cases";
import { parseDocumentInput } from "@/application/documents/document-validation";
import { prismaDocumentRepository } from "@/infrastructure/prisma/document-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";
import {
  getTenantCodeFromRequest,
  requireMutationContext,
} from "@/app/api/_shared/request-context";
import { permissions } from "@/application/security/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const documentUseCases = createDocumentUseCases(prismaDocumentRepository);

export async function GET(request: Request) {
  try {
    const snapshot = await documentUseCases.getDocumentSnapshot(
      getTenantCodeFromRequest(request) ?? undefined,
    );

    return dataResponse(snapshot);
  } catch (error) {
    return documentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireMutationContext(
      request,
      permissions.manageDocuments,
    );
    const input = parseDocumentInput(
      await readRequestJson(request, "文書データのJSONを読み取れませんでした。"),
    );
    const document = await documentUseCases.createDocument(input, context);

    return dataResponse(document, 201);
  } catch (error) {
    return documentErrorResponse(error);
  }
}

function documentErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "DOCUMENT_DATA_UNAVAILABLE",
    "文書データを処理できませんでした。",
  );
}
