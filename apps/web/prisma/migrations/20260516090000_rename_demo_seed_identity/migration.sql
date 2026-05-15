UPDATE "tenants"
SET
    "code" = 'tsudolio-local',
    "name" = 'つどりお総合病院',
    "display_name" = 'つどりお総合病院',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'demo-city-hospital';

UPDATE "users"
SET "email" = 'admin@tsudolio.local'
WHERE
    "email" = 'admin@example.local'
    AND "tenant_id" IN (
        SELECT "id" FROM "tenants" WHERE "code" = 'tsudolio-local'
    );

UPDATE "users"
SET "email" = 'approver@tsudolio.local'
WHERE
    "email" = 'approver@example.local'
    AND "tenant_id" IN (
        SELECT "id" FROM "tenants" WHERE "code" = 'tsudolio-local'
    );

UPDATE "users"
SET "email" = 'requester@tsudolio.local'
WHERE
    "email" = 'requester@example.local'
    AND "tenant_id" IN (
        SELECT "id" FROM "tenants" WHERE "code" = 'tsudolio-local'
    );
