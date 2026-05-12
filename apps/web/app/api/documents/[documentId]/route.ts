import { NextResponse } from "next/server";
import {
  deleteDocument,
  DocumentDataError,
  updateDocument,
} from "@/features/documents/server/document-data";
import { parseDocumentInput } from "@/features/documents/server/document-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    const input = parseDocumentInput(await readJson(request));
    const document = await updateDocument(documentId, input);

    return NextResponse.json({
      data: document,
      source: "database",
    });
  } catch (error) {
    return documentErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    await deleteDocument(documentId);

    return NextResponse.json({
      data: {
        id: documentId,
        deleted: true,
      },
      source: "database",
    });
  } catch (error) {
    return documentErrorResponse(error);
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new DocumentDataError(
      "INVALID_JSON",
      "文書データのJSONを読み取れませんでした。",
    );
  }
}

function documentErrorResponse(error: unknown) {
  if (error instanceof DocumentDataError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  const message =
    error instanceof Error ? error.message : "文書データを処理できませんでした。";

  return NextResponse.json(
    {
      error: "DOCUMENT_DATA_UNAVAILABLE",
      message,
    },
    {
      status: 503,
    },
  );
}
