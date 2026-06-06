import { NextResponse } from "next/server";
import { requirePermission } from "@/app/api/_shared/request-context";
import { createOperationsUseCases } from "@/application/operations/use-cases";
import { permissions } from "@/application/security/permissions";
import { prismaOperationsRepository } from "@/infrastructure/prisma/operations-repository";
import { applicationErrorResponse } from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const operationsUseCases = createOperationsUseCases(
  prismaOperationsRepository,
);

export async function GET(request: Request) {
  try {
    const currentUser = await requirePermission(
      request,
      permissions.manageTenant,
    );
    const snapshot =
      await operationsUseCases.getOperationsBackupSnapshot(currentUser);
    const filename = `${snapshot.tenant.code}-operations-${snapshot.exportedAt
      .slice(0, 10)
      .replaceAll("-", "")}.json`;

    return NextResponse.json(snapshot, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return applicationErrorResponse(
      error,
      "OPERATIONS_EXPORT_UNAVAILABLE",
      "運用エクスポートを作成できませんでした。",
    );
  }
}
