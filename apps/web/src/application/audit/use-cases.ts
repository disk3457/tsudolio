import type {
  AuditEventFilterState,
  AuditEventSnapshot,
} from "@/application/audit/types";

export type AuditEventRepository = {
  getAuditEventSnapshot: (
    tenantCode: string,
    filters: AuditEventFilterState,
  ) => Promise<AuditEventSnapshot>;
};

export function createAuditUseCases(repository: AuditEventRepository) {
  return {
    getAuditEventSnapshot: repository.getAuditEventSnapshot,
  };
}
