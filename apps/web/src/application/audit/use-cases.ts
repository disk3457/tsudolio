import type {
  AuditEventExportSnapshot,
  AuditEventFilterState,
  AuditEventSnapshot,
  AuditLogRetentionDays,
  AuditRetentionPolicy,
} from "@/application/audit/types";
import type { CurrentUserContext } from "@/application/security/types";

export type AuditEventRepository = {
  getAuditEventSnapshot: (
    tenantCode: string,
    filters: AuditEventFilterState,
  ) => Promise<AuditEventSnapshot>;
  getAuditEventExportSnapshot: (
    tenantCode: string,
    filters: AuditEventFilterState,
  ) => Promise<AuditEventExportSnapshot>;
  getAuditRetentionPolicy: (
    currentUser: CurrentUserContext,
  ) => Promise<AuditRetentionPolicy>;
  updateAuditRetentionPolicy: (input: {
    currentUser: CurrentUserContext;
    ipAddress?: string | null;
    retentionDays: AuditLogRetentionDays;
  }) => Promise<AuditRetentionPolicy>;
};

export function createAuditUseCases(repository: AuditEventRepository) {
  return {
    getAuditEventExportSnapshot: repository.getAuditEventExportSnapshot,
    getAuditEventSnapshot: repository.getAuditEventSnapshot,
    getAuditRetentionPolicy: repository.getAuditRetentionPolicy,
    updateAuditRetentionPolicy: repository.updateAuditRetentionPolicy,
  };
}
