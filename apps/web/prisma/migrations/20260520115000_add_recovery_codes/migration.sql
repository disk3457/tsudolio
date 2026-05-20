-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(96) NOT NULL,
    "code_suffix" VARCHAR(12) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recovery_codes_tenant_id_code_hash_key" ON "recovery_codes"("tenant_id", "code_hash");

-- CreateIndex
CREATE INDEX "recovery_codes_tenant_id_user_id_created_at_idx" ON "recovery_codes"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "recovery_codes_tenant_id_user_id_used_at_revoked_at_idx" ON "recovery_codes"("tenant_id", "user_id", "used_at", "revoked_at");

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
