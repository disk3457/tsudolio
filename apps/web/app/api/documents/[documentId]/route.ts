import { createDocumentUseCases } from "@/application/documents/use-cases";
import { parseDocumentInput } from "@/application/documents/document-validation";
import { prismaDocumentRepository } from "@/infrastructure/prisma/document-repository";
import {
  applicationErrorResponse,
  dataResponse,
  readRequestJson,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const documentUseCases = createDocumentUseCases(prismaDocumentRepository);

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const input = parseDocumentInput(
      await readRequestJson(request, "文書データのJSONを読み取れませんでした。"),
    );
    const document = await documentUseCases.updateDocument(documentId, input);

    return dataResponse(document);
  } catch (error) {
    return documentErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    await documentUseCases.deleteDocument(documentId);

    return dataResponse({
      id: documentId,
      deleted: true,
    });
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
