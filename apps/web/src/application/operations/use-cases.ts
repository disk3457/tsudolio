import type {
  OperationsImportCandidate,
  OperationsBackupSnapshot,
  OperationsImportValidationReport,
  OperationsRestoreDryRunInput,
  OperationsRestoreDryRunReport,
  OperationsRestoreReport,
  OperationsRestoreRequestInput,
  OperationsSnapshot,
  TenantProfileInput,
} from "@/application/operations/types";
import type {
  CurrentUserContext,
  MutationContext,
} from "@/application/security/types";

export type OperationsRepository = {
  getOperationsSnapshot: (
    currentUser: CurrentUserContext,
  ) => Promise<OperationsSnapshot>;
  updateTenantProfile: (
    input: TenantProfileInput,
    context: MutationContext,
  ) => Promise<OperationsSnapshot>;
  getOperationsBackupSnapshot: (
    currentUser: CurrentUserContext,
  ) => Promise<OperationsBackupSnapshot>;
  validateOperationsImportCandidate: (
    input: OperationsImportCandidate,
    context: MutationContext,
  ) => Promise<OperationsImportValidationReport>;
  previewOperationsRestore: (
    input: OperationsRestoreDryRunInput,
    context: MutationContext,
  ) => Promise<OperationsRestoreDryRunReport>;
  processOperationsRestore: (
    input: OperationsRestoreRequestInput,
    context: MutationContext,
  ) => Promise<OperationsRestoreReport>;
};

export function createOperationsUseCases(repository: OperationsRepository) {
  return {
    getOperationsBackupSnapshot: repository.getOperationsBackupSnapshot,
    getOperationsSnapshot: repository.getOperationsSnapshot,
    updateTenantProfile: repository.updateTenantProfile,
    validateOperationsImportCandidate:
      repository.validateOperationsImportCandidate,
    previewOperationsRestore: repository.previewOperationsRestore,
    processOperationsRestore: repository.processOperationsRestore,
  };
}
