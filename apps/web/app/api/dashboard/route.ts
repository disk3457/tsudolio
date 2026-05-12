import { NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/features/dashboard/server/dashboard-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getDashboardSnapshot();

    return NextResponse.json({
      data: snapshot,
      source: "database",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard data";

    return NextResponse.json(
      {
        error: "DASHBOARD_DATA_UNAVAILABLE",
        message,
      },
      {
        status: 503,
      },
    );
  }
}
