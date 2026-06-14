import type {
  OperationImportIssue,
  OperationImportTableSummary,
  OperationRestorePlan,
  OperationRestorePlanAction,
  OperationRestorePlanStep,
  OperationsBackupDataKey,
  OperationsImportCandidate,
  OperationsImportValidationReport,
  OperationsRestoreCurrentBackupCheck,
  OperationsRestoreDryRunInput,
  OperationsRestoreDryRunReport,
  OperationsRestoreExecutionGuardrails,
  OperationsRestoreExecutionReport,
  OperationsRestoreMode,
  OperationsRestoreReport,
  OperationsRestoreRequestInput,
} from "@/application/operations/types";
import { operationsBackupDataSetDefinitions } from "@/application/operations/types";
import { OperationsApplicationError } from "@/application/operations/errors";
import type { MutationContext } from "@/application/security/types";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import { getCurrentBackupTableCounts } from "@/infrastructure/prisma/operations/backup-counts";
import {
  buildOperationsRestoreAppliedDataSets,
  executeOperationsRestoreTransaction,
  getOperationsRestoreExecutorBlockedReason,
  supportedOperationsRestoreDataSetKeys,
} from "@/infrastructure/prisma/operations/restore-executor";
import { getTenantByCodeOrThrow } from "@/infrastructure/prisma/operations/tenant";
import { prisma } from "@/infrastructure/prisma/prisma-client";
import { AuditSeverity } from "@generated/prisma/enums";

export async function validateOperationsImportCandidate(
  input: OperationsImportCandidate,
  context: MutationContext,
): Promise<OperationsImportValidationReport> {
  const tenant = await getTenantByCodeOrThrow(context.tenantCode);
  const currentCounts = await getCurrentBackupTableCounts(tenant.id);
  const report = buildOperationsImportValidationReport(input, {
    currentCounts,
    generatedAt: new Date().toISOString(),
    tenant,
  });

  await recordOperationsImportValidationAudit({
    context,
    report,
    tenantId: tenant.id,
  });

  return report;
}

export async function previewOperationsRestore(
  input: OperationsRestoreDryRunInput,
  context: MutationContext,
): Promise<OperationsRestoreDryRunReport> {
  const restoreContext = await buildOperationsRestoreContext(input, context);
  const canProceed =
    restoreContext.restore.restorePlan.canRestore &&
    restoreContext.currentBackup.matchesCurrentState &&
    restoreContext.currentBackup.status !== "BLOCKED";
  const report = {
    canProceed,
    currentBackup: restoreContext.currentBackup,
    dryRun: true,
    generatedAt: restoreContext.generatedAt,
    guardrails: {
      confirmationTokenAccepted: true,
      currentBackupMatchesCurrentState:
        restoreContext.currentBackup.matchesCurrentState,
      currentBackupRequired: true,
      destructiveRestoreBlocked: true,
    },
    mode: "DRY_RUN",
    restore: restoreContext.restore,
  } satisfies OperationsRestoreDryRunReport;

  await recordOperationsRestoreDryRunAudit({
    context,
    report,
    tenantId: restoreContext.tenant.id,
  });

  return report;
}

export async function processOperationsRestore(
  input: OperationsRestoreRequestInput,
  context: MutationContext,
): Promise<OperationsRestoreReport> {
  if (input.mode === "DRY_RUN") {
    return previewOperationsRestore(input, context);
  }

  const restoreContext = await buildOperationsRestoreContext(input, context);
  const blockedReason = getOperationsRestoreExecutorBlockedReason({
    backup: restoreContext.restoreBackup,
    currentBackup: restoreContext.currentBackupCandidate,
    currentBackupCheck: restoreContext.currentBackup,
    restore: restoreContext.restore,
    tenant: restoreContext.tenant,
  });

  if (blockedReason) {
    return blockOperationsRestoreExecution({
      blockedReason,
      context,
      restoreContext,
    });
  }

  const appliedDataSets = buildOperationsRestoreAppliedDataSets(
    restoreContext.restore,
  );
  const report = {
    appliedDataSets,
    blockedReason: null,
    currentBackup: restoreContext.currentBackup,
    executed: true,
    generatedAt: restoreContext.generatedAt,
    guardrails: buildRestoreExecutionGuardrails({
      currentBackup: restoreContext.currentBackup,
      destructiveRestoreBlocked: false,
      transactionRestoreSupported: true,
    }),
    mode: "EXECUTE",
    restore: restoreContext.restore,
    restoredRecordCount: appliedDataSets.reduce(
      (total, dataSet) => total + dataSet.recordCount,
      0,
    ),
    status: "COMPLETED",
  } satisfies OperationsRestoreExecutionReport;

  await executeOperationsRestoreTransaction({
    backup: restoreContext.restoreBackup,
    context,
    currentBackup: restoreContext.currentBackupCandidate,
    currentBackupCheck: restoreContext.currentBackup,
    report,
    restore: restoreContext.restore,
    tenant: restoreContext.tenant,
  });

  return report;
}

async function blockOperationsRestoreExecution(
  input: {
    blockedReason: string;
    context: MutationContext;
    restoreContext: Awaited<ReturnType<typeof buildOperationsRestoreContext>>;
  },
): Promise<OperationsRestoreExecutionReport> {
  const report = {
    blockedReason: input.blockedReason,
    currentBackup: input.restoreContext.currentBackup,
    executed: false,
    generatedAt: input.restoreContext.generatedAt,
    guardrails: buildRestoreExecutionGuardrails({
      currentBackup: input.restoreContext.currentBackup,
      destructiveRestoreBlocked: true,
      transactionRestoreSupported: true,
    }),
    mode: "EXECUTE",
    restore: input.restoreContext.restore,
    status: "BLOCKED",
  } satisfies OperationsRestoreExecutionReport;

  await recordOperationsRestoreExecutionBlockedAudit({
    context: input.context,
    report,
    tenantId: input.restoreContext.tenant.id,
  });

  return report;
}

async function buildOperationsRestoreContext(
  input: OperationsRestoreRequestInput,
  context: MutationContext,
) {
  const tenant = await getTenantByCodeOrThrow(context.tenantCode);
  const currentCounts = await getCurrentBackupTableCounts(tenant.id);
  const generatedAt = new Date().toISOString();
  const restore = buildOperationsImportValidationReport(input.backup, {
    currentCounts,
    generatedAt,
    tenant,
  });

  await assertRestoreConfirmationToken({
    context,
    mode: input.mode,
    restore,
    tenant,
    token: input.confirmationToken,
  });

  const currentBackupReport = buildOperationsImportValidationReport(
    input.currentBackup,
    {
      currentCounts,
      generatedAt,
      tenant,
    },
  );

  return {
    currentBackupCandidate: input.currentBackup,
    currentBackup: buildCurrentBackupCheck(currentBackupReport),
    generatedAt,
    restore,
    restoreBackup: input.backup,
    tenant,
  };
}

function buildOperationsImportValidationReport(
  input: OperationsImportCandidate,
  options: {
    currentCounts: Record<OperationsBackupDataKey, number>;
    generatedAt: string;
    tenant: {
      code: string;
      displayName: string | null;
      id: string;
      name: string;
    };
  },
): OperationsImportValidationReport {
  const { currentCounts, generatedAt, tenant } = options;
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
    generatedAt,
    issues,
    restorePlan,
    schemaVersion: input.schemaVersion,
    status,
    tables,
    tenant: input.tenant,
    totalCurrentRecords,
    totalIncomingRecords,
  } satisfies OperationsImportValidationReport;

  return report;
}

async function assertRestoreConfirmationToken(input: {
  context: MutationContext;
  mode: OperationsRestoreMode;
  restore: OperationsImportValidationReport;
  tenant: { code: string; id: string };
  token: string;
}) {
  const expectedToken = createRestoreConfirmationToken(
    input.tenant.code,
    input.restore.exportedAt,
  );

  if (!expectedToken) {
    await recordRestoreRejectionAudit({
      context: input.context,
      mode: input.mode,
      reason: "missing-exported-at",
      restore: input.restore,
      tenantId: input.tenant.id,
    });
    throw new OperationsApplicationError(
      "RESTORE_CONFIRMATION_UNAVAILABLE",
      "バックアップの exportedAt が有効でないため確認トークンを検証できません。",
      409,
    );
  }

  if (input.token !== expectedToken) {
    await recordRestoreRejectionAudit({
      context: input.context,
      mode: input.mode,
      reason: "confirmation-token-mismatch",
      restore: input.restore,
      tenantId: input.tenant.id,
    });
    throw new OperationsApplicationError(
      "RESTORE_CONFIRMATION_TOKEN_MISMATCH",
      `確認トークンが一致しません。${expectedToken} を入力してください。`,
      409,
    );
  }
}

function createRestoreConfirmationToken(
  tenantCode: string,
  exportedAt: string | null,
) {
  if (!exportedAt) {
    return null;
  }

  const exportedDate = new Date(exportedAt);

  if (Number.isNaN(exportedDate.getTime())) {
    return null;
  }

  const dateToken = exportedDate.toISOString().slice(0, 10).replaceAll("-", "");

  return `RESTORE:${tenantCode}:${dateToken}`;
}

function buildRestoreExecutionGuardrails(input: {
  currentBackup: OperationsRestoreCurrentBackupCheck;
  destructiveRestoreBlocked: boolean;
  transactionRestoreSupported: boolean;
}): OperationsRestoreExecutionGuardrails {
  return {
    confirmationTokenAccepted: true,
    currentBackupMatchesCurrentState: input.currentBackup.matchesCurrentState,
    currentBackupRequired: true,
    destructiveRestoreBlocked: input.destructiveRestoreBlocked,
    replaceActionsBlocked: true,
    reviewRequiredBlocked: true,
    supportedDataSets: [...supportedOperationsRestoreDataSetKeys],
    transactionRestoreSupported: input.transactionRestoreSupported,
    unsupportedDataSetsBlocked: true,
  };
}

function buildCurrentBackupCheck(
  report: OperationsImportValidationReport,
): OperationsRestoreCurrentBackupCheck {
  const countMismatches = report.tables.filter(
    (table) =>
      table.incomingCount !== table.currentCount ||
      table.declaredCount !== table.currentCount,
  );
  const guardIssues: OperationImportIssue[] =
    countMismatches.length > 0
      ? [
          {
            detail: `現行バックアップと現在データの件数が一致しません: ${countMismatches
              .map((table) => table.label)
              .join(", ")}`,
            key: "current-backup-count-mismatch",
            label: "現行バックアップ",
            severity: "ERROR",
          },
        ]
      : [];
  const issues = [...report.issues, ...guardIssues];
  const status = getImportValidationStatus(issues);
  const matchesCurrentState =
    countMismatches.length === 0 &&
    !issues.some((issue) => issue.severity === "ERROR");

  return {
    exportedAt: report.exportedAt,
    issues,
    matchesCurrentState,
    status,
    totalRecords: report.totalIncomingRecords,
  };
}

async function recordOperationsImportValidationAudit(input: {
  context: MutationContext;
  report: OperationsImportValidationReport;
  tenantId: string;
}) {
  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(tx, {
      tenantId: input.tenantId,
      context: input.context,
      action: "運用バックアップのインポート検証",
      targetType: "operations-import",
      targetId: input.report.tenant.code ?? input.report.currentTenant.code,
      severity:
        input.report.status === "BLOCKED"
          ? AuditSeverity.WARNING
          : AuditSeverity.NOTICE,
      metadata: {
        exportedAt: input.report.exportedAt,
        importedTenantCode: input.report.tenant.code,
        issueCount: input.report.issues.length,
        restorePlanStatus: input.report.restorePlan.status,
        schemaVersion: input.report.schemaVersion,
        status: input.report.status,
        totalCurrentRecords: input.report.totalCurrentRecords,
        totalIncomingRecords: input.report.totalIncomingRecords,
      },
    });
  });
}

async function recordOperationsRestoreDryRunAudit(input: {
  context: MutationContext;
  report: OperationsRestoreDryRunReport;
  tenantId: string;
}) {
  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(tx, {
      tenantId: input.tenantId,
      context: input.context,
      action: "運用バックアップ復元のドライラン",
      targetType: "operations-restore",
      targetId:
        input.report.restore.tenant.code ??
        input.report.restore.currentTenant.code,
      severity: input.report.canProceed
        ? AuditSeverity.NOTICE
        : AuditSeverity.WARNING,
      metadata: {
        canProceed: input.report.canProceed,
        currentBackupExportedAt: input.report.currentBackup.exportedAt,
        currentBackupIssueCount: input.report.currentBackup.issues.length,
        currentBackupMatchesCurrentState:
          input.report.currentBackup.matchesCurrentState,
        destructive: input.report.restore.restorePlan.destructive,
        dryRun: true,
        exportedAt: input.report.restore.exportedAt,
        guardrails: input.report.guardrails,
        issueCount: input.report.restore.issues.length,
        restorePlanStatus: input.report.restore.restorePlan.status,
        schemaVersion: input.report.restore.schemaVersion,
        status: input.report.restore.status,
        totalIncomingRecords: input.report.restore.totalIncomingRecords,
      },
    });
  });
}

async function recordOperationsRestoreExecutionBlockedAudit(input: {
  context: MutationContext;
  report: OperationsRestoreExecutionReport;
  tenantId: string;
}) {
  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(tx, {
      tenantId: input.tenantId,
      context: input.context,
      action: "運用バックアップ復元の実行拒否",
      targetType: "operations-restore",
      targetId:
        input.report.restore.tenant.code ??
        input.report.restore.currentTenant.code,
      severity: AuditSeverity.WARNING,
      metadata: {
        blockedReason: input.report.blockedReason,
        currentBackupExportedAt: input.report.currentBackup.exportedAt,
        currentBackupIssueCount: input.report.currentBackup.issues.length,
        currentBackupMatchesCurrentState:
          input.report.currentBackup.matchesCurrentState,
        destructive: input.report.restore.restorePlan.destructive,
        dryRun: false,
        executed: false,
        exportedAt: input.report.restore.exportedAt,
        guardrails: input.report.guardrails,
        issueCount: input.report.restore.issues.length,
        mode: input.report.mode,
        restorePlanStatus: input.report.restore.restorePlan.status,
        schemaVersion: input.report.restore.schemaVersion,
        status: input.report.restore.status,
        totalIncomingRecords: input.report.restore.totalIncomingRecords,
      },
    });
  });
}

async function recordRestoreRejectionAudit(input: {
  context: MutationContext;
  mode: OperationsRestoreMode;
  reason: string;
  restore: OperationsImportValidationReport;
  tenantId: string;
}) {
  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(tx, {
      tenantId: input.tenantId,
      context: input.context,
      action:
        input.mode === "DRY_RUN"
          ? "運用バックアップ復元のドライラン拒否"
          : "運用バックアップ復元の実行拒否",
      targetType: "operations-restore",
      targetId: input.restore.tenant.code ?? input.restore.currentTenant.code,
      severity: AuditSeverity.WARNING,
      metadata: {
        dryRun: input.mode === "DRY_RUN",
        executed: false,
        exportedAt: input.restore.exportedAt,
        issueCount: input.restore.issues.length,
        mode: input.mode,
        reason: input.reason,
        restorePlanStatus: input.restore.restorePlan.status,
        schemaVersion: input.restore.schemaVersion,
        status: input.restore.status,
        totalIncomingRecords: input.restore.totalIncomingRecords,
      },
    });
  });
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
