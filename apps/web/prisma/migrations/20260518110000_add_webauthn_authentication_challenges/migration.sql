CREATE TABLE "webauthn_authentication_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_hash" VARCHAR(96) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_authentication_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webauthn_authentication_challenges_tenant_id_user_id_expires_at_idx"
    ON "webauthn_authentication_challenges"("tenant_id", "user_id", "expires_at");

ALTER TABLE "webauthn_authentication_challenges"
    ADD CONSTRAINT "webauthn_authentication_challenges_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webauthn_authentication_challenges"
    ADD CONSTRAINT "webauthn_authentication_challenges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
