import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "ok",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database health check failed";

    return NextResponse.json(
      {
        status: "degraded",
        database: "unavailable",
        message,
      },
      {
        status: 503,
      },
    );
  }
}
