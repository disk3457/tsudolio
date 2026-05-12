import { NextResponse } from "next/server";
import {
  getOrganizationSnapshot,
  OrganizationDataError,
} from "@/features/organization/server/organization-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getOrganizationSnapshot();

    return NextResponse.json({
      data: snapshot,
      source: "database",
    });
  } catch (error) {
    return organizationErrorResponse(error);
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
