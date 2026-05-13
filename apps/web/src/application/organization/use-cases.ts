import type {
  OrganizationSnapshot,
  OrganizationUnitInput,
  OrganizationUnitSummary,
  UserInput,
  UserSummary,
} from "@/application/organization/types";

export type OrganizationRepository = {
  getOrganizationSnapshot: (tenantCode?: string) => Promise<OrganizationSnapshot>;
  createOrganizationUnit: (
    input: OrganizationUnitInput,
    tenantCode?: string,
  ) => Promise<OrganizationUnitSummary>;
  updateOrganizationUnit: (
    unitId: string,
    input: OrganizationUnitInput,
    tenantCode?: string,
  ) => Promise<OrganizationUnitSummary>;
  deleteOrganizationUnit: (unitId: string, tenantCode?: string) => Promise<void>;
  createUser: (input: UserInput, tenantCode?: string) => Promise<UserSummary>;
  updateUser: (
    userId: string,
    input: UserInput,
    tenantCode?: string,
  ) => Promise<UserSummary>;
  deleteOrSuspendUser: (
    userId: string,
    tenantCode?: string,
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
