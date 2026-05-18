CREATE TABLE "webauthn_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credential_id" VARCHAR(255) NOT NULL,
    "public_key" BYTEA NOT NULL,
    "sign_count" INTEGER NOT NULL DEFAULT 0,
    "device_type" VARCHAR(40) NOT NULL,
    "backed_up" BOOLEAN NOT NULL DEFAULT false,
    "transports" JSONB,
    "name" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webauthn_registration_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_hash" VARCHAR(96) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_registration_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webauthn_credentials_tenant_id_credential_id_key"
    ON "webauthn_credentials"("tenant_id", "credential_id");

CREATE INDEX "webauthn_credentials_tenant_id_user_id_created_at_idx"
    ON "webauthn_credentials"("tenant_id", "user_id", "created_at");

CREATE INDEX "webauthn_registration_challenges_tenant_id_user_id_expires_at_idx"
    ON "webauthn_registration_challenges"("tenant_id", "user_id", "expires_at");

ALTER TABLE "webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webauthn_registration_challenges"
    ADD CONSTRAINT "webauthn_registration_challenges_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webauthn_registration_challenges"
    ADD CONSTRAINT "webauthn_registration_challenges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
