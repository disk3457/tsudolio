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

export async function GET() {
  try {
    const snapshot = await documentUseCases.getDocumentSnapshot();

    return dataResponse(snapshot);
  } catch (error) {
    return documentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = parseDocumentInput(
      await readRequestJson(request, "文書データのJSONを読み取れませんでした。"),
    );
    const document = await documentUseCases.createDocument(input);

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
