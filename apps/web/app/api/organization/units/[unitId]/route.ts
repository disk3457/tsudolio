import { NextResponse } from "next/server";
import {
  deleteOrganizationUnit,
  OrganizationDataError,
  updateOrganizationUnit,
} from "@/lib/organization-data";
import { parseOrganizationUnitInput } from "@/lib/organization-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    unitId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { unitId } = await context.params;
    const input = parseOrganizationUnitInput(await readJson(request));
    const unit = await updateOrganizationUnit(unitId, input);

    return NextResponse.json({
      data: unit,
      source: "database",
    });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { unitId } = await context.params;
    await deleteOrganizationUnit(unitId);

    return NextResponse.json({
      data: {
        id: unitId,
        deleted: true,
      },
      source: "database",
    });
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
