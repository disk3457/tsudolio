import type {
  OperationRestorePlanStep,
  OperationsBackupDataKey,
  OperationsImportValidationReport,
  OperationsRestoreExecutionCompletedReport,
} from "@/application/operations/types";
import { operationsBackupDataSetDefinitions } from "@/application/operations/types";
import {
  supportedOperationsRestoreDataSetKeys,
  type SupportedOperationsRestoreDataSetKey,
} from "@/infrastructure/prisma/operations/restore-executor/types";

const supportedDataSetKeySet = new Set<OperationsBackupDataKey>(
  supportedOperationsRestoreDataSetKeys,
);

export function buildOperationsRestoreAppliedDataSets(
  restore: OperationsImportValidationReport,
): OperationsRestoreExecutionCompletedReport["appliedDataSets"] {
  return supportedOperationsRestoreDataSetKeys
    .map((key) => {
      const step = getRestoreStep(restore, key);

      if (!step || step.action !== "UPSERT" || step.recordCount === 0) {
        return null;
      }

      return {
        key,
        label: getDataSetLabel(key),
        recordCount: step.recordCount,
      };
    })
    .filter((dataSet) => dataSet !== null);
}

export function getRestoreStep(
  restore: OperationsImportValidationReport,
  key: OperationsBackupDataKey,
): OperationRestorePlanStep | undefined {
  return restore.restorePlan.steps.find((step) => step.tableKey === key);
}

export function isRestoreDataSetSupported(
  key: OperationsBackupDataKey,
): key is SupportedOperationsRestoreDataSetKey {
  return supportedDataSetKeySet.has(key);
}

export function getDataSetLabel(key: OperationsBackupDataKey) {
  return (
    operationsBackupDataSetDefinitions.find(
      (definition) => definition.key === key,
    )?.label ?? key
  );
}
