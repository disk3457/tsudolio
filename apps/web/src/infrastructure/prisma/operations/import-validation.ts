import type {
  OperationImportIssue,
  OperationImportTableSummary,
  OperationsBackupDataKey,
  OperationsImportCandidate,
  OperationsImportValidationReport,
} from "@/application/operations/types";
import { operationsBackupDataSetDefinitions } from "@/application/operations/types";
import type { MutationContext } from "@/application/security/types";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import { getCurrentBackupTableCounts } from "@/infrastructure/prisma/operations/backup-counts";
import { getTenantByCodeOrThrow } from "@/infrastructure/prisma/operations/tenant";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { AuditSeverity } from "@generated/prisma/enums";

export async function validateOperationsImportCandidate(
  input: OperationsImportCandidate,
  context: MutationContext,
): Promise<OperationsImportValidationReport> {
  const tenant = await getTenantByCodeOrThrow(context.tenantCode);
  const currentCounts = await getCurrentBackupTableCounts(tenant.id);
  const issues: OperationImportIssue[] = [...input.validationIssues];

  if (input.tenant.code && input.tenant.code !== tenant.code) {
    issues.push({
      detail: `バックアップのテナントコード ${input.tenant.code} は現在のテナント ${tenant.code} と一致しません。`,
      key: "tenant-code-mismatch",
      label: "Tenant code",
      severity: "ERROR",
    });
  }

  if (
    input.tenant.name &&
    input.tenant.code === tenant.code &&
    input.tenant.name !== tenant.name
  ) {
    issues.push({
      detail: `バックアップ名 ${input.tenant.name} と現在名 ${tenant.name} が異なります。`,
      key: "tenant-name-differs",
      label: "Tenant name",
      severity: "INFO",
    });
  }

  const backupTenantIds = collectBackupTenantIds(input.data);

  if (backupTenantIds.size > 1) {
    issues.push({
      detail: `バックアップ内に複数の tenantId が含まれています: ${Array.from(
        backupTenantIds,
      ).join(", ")}`,
      key: "multiple-row-tenant-ids",
      label: "Tenant id",
      severity: "ERROR",
    });
  } else if (
    backupTenantIds.size === 1 &&
    !backupTenantIds.has(tenant.id) &&
    input.tenant.code === tenant.code
  ) {
    issues.push({
      detail:
        "バックアップ内の行 tenantId は現在の tenantId と異なります。別環境からの復元ではIDの再マッピングが必要です。",
      key: "row-tenant-id-differs",
      label: "Tenant id",
      severity: "WARNING",
    });
  }

  const tables = buildImportTableSummaries(input, currentCounts);
  const totalIncomingRecords = tables.reduce(
    (total, table) => total + table.incomingCount,
    0,
  );
  const totalCurrentRecords = tables.reduce(
    (total, table) => total + table.currentCount,
    0,
  );
  const status = getImportValidationStatus(issues);
  const report = {
    currentTenant: {
      code: tenant.code,
      name: tenant.displayName ?? tenant.name,
    },
    exportedAt: input.exportedAt,
    generatedAt: new Date().toISOString(),
    issues,
    schemaVersion: input.schemaVersion,
    status,
    tables,
    tenant: input.tenant,
    totalCurrentRecords,
    totalIncomingRecords,
  } satisfies OperationsImportValidationReport;

  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "運用バックアップのインポート検証",
      targetType: "operations-import",
      targetId: input.tenant.code ?? tenant.code,
      severity:
        status === "BLOCKED" ? AuditSeverity.WARNING : AuditSeverity.NOTICE,
      metadata: {
        exportedAt: input.exportedAt,
        importedTenantCode: input.tenant.code,
        issueCount: issues.length,
        schemaVersion: input.schemaVersion,
        status,
        totalCurrentRecords,
        totalIncomingRecords,
      },
    });
  });

  return report;
}

function buildImportTableSummaries(
  input: OperationsImportCandidate,
  currentCounts: Record<OperationsBackupDataKey, number>,
): OperationImportTableSummary[] {
  return operationsBackupDataSetDefinitions.map((definition) => {
    const incomingCount = input.data[definition.key]?.length ?? 0;
    const currentCount = currentCounts[definition.key];
    const declaredCount = input.counts[definition.key] ?? null;

    return {
      currentCount,
      declaredCount,
      incomingCount,
      key: definition.key,
      label: definition.label,
      status:
        declaredCount === null
          ? "MISSING"
          : incomingCount === currentCount
            ? "MATCH"
            : "CHANGED",
    };
  });
}

function getImportValidationStatus(issues: OperationImportIssue[]) {
  if (issues.some((issue) => issue.severity === "ERROR")) {
    return "BLOCKED";
  }

  if (issues.some((issue) => issue.severity === "WARNING")) {
    return "WARNING";
  }

  return "READY";
}

function collectBackupTenantIds(data: Record<string, unknown[]>) {
  const tenantIds = new Set<string>();

  for (const rows of Object.values(data)) {
    for (const row of rows) {
      if (!isRecord(row)) {
        continue;
      }

      const tenantId = row.tenantId;

      if (typeof tenantId === "string" && tenantId.trim()) {
        tenantIds.add(tenantId);
      }
    }
  }

  return tenantIds;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
