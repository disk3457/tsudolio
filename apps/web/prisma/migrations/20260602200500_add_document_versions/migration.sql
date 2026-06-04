-- EnableExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "organization_unit_id" UUID,
    "created_by_id" UUID NOT NULL,
    "title" VARCHAR(220) NOT NULL,
    "category" VARCHAR(120) NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "storage_key" VARCHAR(500) NOT NULL,
    "retention_until" TIMESTAMP(3),
    "change_note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_versions_tenant_id_document_id_created_at_idx" ON "document_versions"("tenant_id", "document_id", "created_at");

-- CreateIndex
CREATE INDEX "document_versions_tenant_id_status_idx" ON "document_versions"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_organization_unit_id_fkey" FOREIGN KEY ("organization_unit_id") REFERENCES "organization_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- BackfillData
INSERT INTO "document_versions" (
    "id",
    "tenant_id",
    "document_id",
    "organization_unit_id",
    "created_by_id",
    "title",
    "category",
    "version",
    "status",
    "storage_key",
    "retention_until",
    "change_note",
    "created_at"
)
SELECT
    gen_random_uuid(),
    "tenant_id",
    "id",
    "organization_unit_id",
    "uploaded_by_id",
    "title",
    "category",
    "version",
    "status",
    "storage_key",
    "retention_until",
    '既存文書の初期履歴を作成',
    "created_at"
FROM "documents";
