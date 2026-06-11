import type {
  OperationImportIssue,
  OperationImportTableSummary,
  OperationRestorePlan,
  OperationRestorePlanAction,
  OperationRestorePlanStep,
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
  const restorePlan = buildRestorePlan({
    issues,
    status,
    tables,
    totalCurrentRecords,
    totalIncomingRecords,
  });
  const report = {
    currentTenant: {
      code: tenant.code,
      name: tenant.displayName ?? tenant.name,
    },
    exportedAt: input.exportedAt,
    generatedAt: new Date().toISOString(),
    issues,
    restorePlan,
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
        restorePlanStatus: restorePlan.status,
        schemaVersion: input.schemaVersion,
        status,
        totalCurrentRecords,
        totalIncomingRecords,
      },
    });
  });

  return report;
}

function buildRestorePlan(input: {
  issues: OperationImportIssue[];
  status: OperationsImportValidationReport["status"];
  tables: OperationImportTableSummary[];
  totalCurrentRecords: number;
  totalIncomingRecords: number;
}): OperationRestorePlan {
  const hasBlockingIssue = input.status === "BLOCKED";
  const blockedReason =
    input.issues.find((issue) => issue.severity === "ERROR")?.detail ?? null;
  const destructive = input.tables.some(
    (table) => table.currentCount > 0 && table.incomingCount > 0,
  );
  const steps: OperationRestorePlanStep[] = [
    {
      action: hasBlockingIssue ? "REVIEW" : "SKIP",
      detail: hasBlockingIssue
        ? "ERROR項目を解消するまで復元処理は開始できません。"
        : "スキーマ、テナント、件数、tenantId の検査は完了しています。",
      key: "precheck",
      label: "復元前検査",
      phase: "PRECHECK",
      recordCount: input.totalIncomingRecords,
      status: hasBlockingIssue ? "BLOCKED" : "READY",
      tableKey: null,
    },
    {
      action: "SKIP",
      detail:
        "実復元の前に現在の運用エクスポートを取得し、ロールバック用に保管します。",
      key: "current-backup",
      label: "現行バックアップ取得",
      phase: "PREPARE",
      recordCount: input.totalCurrentRecords,
      status: hasBlockingIssue ? "BLOCKED" : "READY",
      tableKey: null,
    },
    ...input.tables.map((table, index) =>
      buildRestoreTableStep(table, index, hasBlockingIssue),
    ),
    {
      action: "SKIP",
      detail:
        "復元後に件数、権限、監査イベント、主要画面のスモークチェックを実施します。",
      key: "post-restore-verification",
      label: "復元後検証",
      phase: "VERIFY",
      recordCount: input.totalIncomingRecords,
      status: hasBlockingIssue ? "BLOCKED" : "READY",
      tableKey: null,
    },
  ];
  const reviewCount = steps.filter(
    (step) => step.status === "REVIEW_REQUIRED",
  ).length;

  return {
    blockedReason,
    canRestore: !hasBlockingIssue,
    destructive,
    estimatedRecordCount: input.totalIncomingRecords,
    status: input.status,
    steps,
    summary: getRestorePlanSummary({
      destructive,
      hasBlockingIssue,
      reviewCount,
      totalIncomingRecords: input.totalIncomingRecords,
    }),
  };
}

function buildRestoreTableStep(
  table: OperationImportTableSummary,
  index: number,
  hasBlockingIssue: boolean,
): OperationRestorePlanStep {
  const action = getRestoreTableAction(table);
  const requiresReview = table.status === "MISSING" || action === "REPLACE";

  return {
    action,
    detail: getRestoreTableDetail(table, action),
    key: `restore-${index + 1}-${table.key}`,
    label: table.label,
    phase: "RESTORE",
    recordCount: table.incomingCount,
    status: hasBlockingIssue
      ? "BLOCKED"
      : requiresReview
        ? "REVIEW_REQUIRED"
        : "READY",
    tableKey: table.key,
  };
}

function getRestoreTableAction(
  table: OperationImportTableSummary,
): OperationRestorePlanAction {
  if (table.declaredCount === null || table.status === "MISSING") {
    return "REVIEW";
  }

  if (table.incomingCount === 0) {
    return "SKIP";
  }

  if (table.currentCount === 0) {
    return "UPSERT";
  }

  if (table.incomingCount === table.currentCount) {
    return "UPSERT";
  }

  return "REPLACE";
}

function getRestoreTableDetail(
  table: OperationImportTableSummary,
  action: OperationRestorePlanAction,
) {
  if (action === "SKIP") {
    return "バックアップに対象レコードがないため、このデータセットは復元対象外です。";
  }

  if (action === "REVIEW") {
    return "バックアップの宣言件数が不足しています。データセットの完全性を確認してください。";
  }

  if (action === "REPLACE") {
    return `現在${table.currentCount}件をバックアップ${table.incomingCount}件に置き換える計画です。`;
  }

  return `バックアップ${table.incomingCount}件を同じIDで反映する計画です。`;
}

function getRestorePlanSummary(input: {
  destructive: boolean;
  hasBlockingIssue: boolean;
  reviewCount: number;
  totalIncomingRecords: number;
}) {
  if (input.hasBlockingIssue) {
    return "ブロック項目があるため、復元計画は実行不可です。";
  }

  if (input.reviewCount > 0) {
    return `${input.reviewCount}件の確認対象があります。復元前に置換範囲を確認してください。`;
  }

  if (input.destructive) {
    return `${input.totalIncomingRecords}件を既存データへ反映する復元計画です。事前バックアップが必要です。`;
  }

  return `${input.totalIncomingRecords}件を新規環境へ反映できる復元計画です。`;
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
