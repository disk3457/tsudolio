ALTER TABLE "tenants"
    ADD COLUMN "require_passkey_for_privileged_users" BOOLEAN NOT NULL DEFAULT false;
