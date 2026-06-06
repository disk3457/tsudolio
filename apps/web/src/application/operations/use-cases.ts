import type {
  OperationsBackupSnapshot,
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
};

export function createOperationsUseCases(repository: OperationsRepository) {
  return {
    getOperationsBackupSnapshot: repository.getOperationsBackupSnapshot,
    getOperationsSnapshot: repository.getOperationsSnapshot,
    updateTenantProfile: repository.updateTenantProfile,
  };
}
