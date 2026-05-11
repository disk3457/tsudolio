import { NextResponse } from "next/server";
import {
  createOrganizationUnit,
  OrganizationDataError,
} from "@/lib/organization-data";
import { parseOrganizationUnitInput } from "@/lib/organization-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = parseOrganizationUnitInput(await readJson(request));
    const unit = await createOrganizationUnit(input);

    return NextResponse.json(
      {
        data: unit,
        source: "database",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new OrganizationDataError(
      "INVALID_JSON",
      "組織データのJSONを読み取れませんでした。",
    );
  }
}

function organizationErrorResponse(error: unknown) {
  if (error instanceof OrganizationDataError) {
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
    error instanceof Error ? error.message : "組織データを処理できませんでした。";

  return NextResponse.json(
    {
      error: "ORGANIZATION_DATA_UNAVAILABLE",
      message,
    },
    {
      status: 503,
    },
  );
}
