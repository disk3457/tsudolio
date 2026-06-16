import { OperationsApplicationError } from "@/application/operations/errors";
import type { SupportedOperationsRestoreDataSetKey } from "@/infrastructure/prisma/operations/restore-executor/types";

export function createInvalidRestoreRowError(
  dataSet: SupportedOperationsRestoreDataSetKey,
  message: string,
) {
  return new OperationsApplicationError(
    `RESTORE_${dataSet}_ROW_INVALID`,
    message,
    409,
  );
}
