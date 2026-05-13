import type {
  OrganizationSnapshot,
  OrganizationUnitInput,
  OrganizationUnitSummary,
  UserInput,
  UserSummary,
} from "@/application/organization/types";
import type { MutationContext } from "@/application/security/types";

export type OrganizationRepository = {
  getOrganizationSnapshot: (tenantCode?: string) => Promise<OrganizationSnapshot>;
  createOrganizationUnit: (
    input: OrganizationUnitInput,
    context: MutationContext,
  ) => Promise<OrganizationUnitSummary>;
  updateOrganizationUnit: (
    unitId: string,
    input: OrganizationUnitInput,
    context: MutationContext,
  ) => Promise<OrganizationUnitSummary>;
  deleteOrganizationUnit: (
    unitId: string,
    context: MutationContext,
  ) => Promise<void>;
  createUser: (
    input: UserInput,
    context: MutationContext,
  ) => Promise<UserSummary>;
  updateUser: (
    userId: string,
    input: UserInput,
    context: MutationContext,
  ) => Promise<UserSummary>;
  deleteOrSuspendUser: (
    userId: string,
    context: MutationContext,
  ) => Promise<{ id: string; deleted: boolean; suspended?: boolean }>;
};

export function createOrganizationUseCases(repository: OrganizationRepository) {
  return {
    getOrganizationSnapshot: repository.getOrganizationSnapshot,
    createOrganizationUnit: repository.createOrganizationUnit,
    updateOrganizationUnit: repository.updateOrganizationUnit,
    deleteOrganizationUnit: repository.deleteOrganizationUnit,
    createUser: repository.createUser,
    updateUser: repository.updateUser,
    deleteOrSuspendUser: repository.deleteOrSuspendUser,
  };
}
