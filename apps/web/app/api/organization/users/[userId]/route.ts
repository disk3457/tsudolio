import { NextResponse } from "next/server";
import {
  deleteOrSuspendUser,
  OrganizationDataError,
  updateUser,
} from "@/features/organization/server/organization-data";
import { parseUserInput } from "@/features/organization/server/organization-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const input = parseUserInput(await readJson(request));
    const user = await updateUser(userId, input);

    return NextResponse.json({
      data: user,
      source: "database",
    });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const result = await deleteOrSuspendUser(userId);

    return NextResponse.json({
      data: result,
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
      "利用者データのJSONを読み取れませんでした。",
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
    error instanceof Error ? error.message : "利用者データを処理できませんでした。";

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
