import { parseAuditEventExportQuery } from "@/application/audit/audit-query";
import { formatAuditEventsCsv } from "@/application/audit/audit-export";
import { createAuditUseCases } from "@/application/audit/use-cases";
import { permissions } from "@/application/security/permissions";
import { requirePermission } from "@/app/api/_shared/request-context";
import { prismaAuditEventRepository } from "@/infrastructure/prisma/audit-event-repository";
import { applicationErrorResponse } from "@/presentation/http/json-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const auditUseCases = createAuditUseCases(prismaAuditEventRepository);

export async function GET(request: Request) {
  try {
    const currentUser = await requirePermission(request, permissions.manageTenant);
    const url = new URL(request.url);
    const snapshot = await auditUseCases.getAuditEventExportSnapshot(
      currentUser.tenantCode,
      parseAuditEventExportQuery(url.searchParams),
    );

    return new Response(formatAuditEventsCsv(snapshot), {
      headers: {
        "Content-Disposition": `attachment; filename="${snapshot.filename}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return applicationErrorResponse(
      error,
      "AUDIT_EVENTS_EXPORT_UNAVAILABLE",
      "監査イベントをエクスポートできませんでした。",
    );
  }
}
