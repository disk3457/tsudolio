import { createDocumentUseCases } from "@/application/documents/use-cases";
import { permissions } from "@/application/security/permissions";
import { requireMutationContext } from "@/app/api/_shared/request-context";
import { prismaDocumentRepository } from "@/infrastructure/prisma/document-repository";
import {
  applicationErrorResponse,
  dataResponse,
} from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const documentUseCases = createDocumentUseCases(prismaDocumentRepository);

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const mutationContext = await requireMutationContext(
      request,
      permissions.readDocuments,
    );
    const { documentId } = await context.params;
    const access = await documentUseCases.accessDocument(
      documentId,
      mutationContext,
    );

    return dataResponse(access);
  } catch (error) {
    return documentErrorResponse(error);
  }
}

function documentErrorResponse(error: unknown) {
  return applicationErrorResponse(
    error,
    "DOCUMENT_ACCESS_UNAVAILABLE",
    "文書アクセスを記録できませんでした。",
  );
}
