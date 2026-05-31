ALTER TABLE "notices"
    ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "notice_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_acknowledgements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notice_acknowledgements_tenant_id_notice_id_user_id_key"
    ON "notice_acknowledgements"("tenant_id", "notice_id", "user_id");

CREATE INDEX "notice_acknowledgements_tenant_id_user_id_acknowledged_at_idx"
    ON "notice_acknowledgements"("tenant_id", "user_id", "acknowledged_at");

ALTER TABLE "notice_acknowledgements"
    ADD CONSTRAINT "notice_acknowledgements_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notice_acknowledgements"
    ADD CONSTRAINT "notice_acknowledgements_notice_id_fkey"
    FOREIGN KEY ("notice_id") REFERENCES "notices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notice_acknowledgements"
    ADD CONSTRAINT "notice_acknowledgements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "description")
VALUES (
    gen_random_uuid(),
    'notice.manage',
    '掲示・通知を管理',
    '掲示の作成、更新、削除と通知運用を行います。'
)
ON CONFLICT ("code") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description";

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT
    "roles"."id",
    "permissions"."id"
FROM "roles"
CROSS JOIN "permissions"
WHERE
    "roles"."code" = 'system-admin'
    AND "permissions"."code" = 'notice.manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
