import { NextResponse } from "next/server";
import {
  createDocument,
  DocumentDataError,
  getDocumentSnapshot,
} from "@/features/documents/server/document-data";
import { parseDocumentInput } from "@/features/documents/server/document-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getDocumentSnapshot();

    return NextResponse.json({
      data: snapshot,
      source: "database",
    });
  } catch (error) {
    return documentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = parseDocumentInput(await readJson(request));
    const document = await createDocument(input);

    return NextResponse.json(
      {
        data: document,
        source: "database",
      },
      {
        status: 201,
      },
    );
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
