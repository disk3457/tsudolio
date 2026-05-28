ALTER TABLE "tenants"
    ADD COLUMN "audit_log_retention_days" INTEGER NOT NULL DEFAULT 365;

ALTER TABLE "tenants"
    ADD CONSTRAINT "tenants_audit_log_retention_days_check"
    CHECK ("audit_log_retention_days" IN (90, 180, 365, 1095, 2555));
