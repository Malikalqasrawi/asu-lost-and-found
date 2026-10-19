-- Changing the email, deleting the account, and signing in with Microsoft
-- (accounts made that way have no password of their own).

ALTER TYPE "EmailCodePurpose" ADD VALUE 'CONFIRM_ACCOUNT';
ALTER TYPE "EmailCodePurpose" ADD VALUE 'CHANGE_EMAIL';

ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "erased_email_hash" TEXT,
ADD COLUMN     "microsoft_id" TEXT,
ADD COLUMN     "pending_email" TEXT,
ALTER COLUMN "password_hash" DROP NOT NULL;

CREATE UNIQUE INDEX "users_microsoft_id_key" ON "users"("microsoft_id");

CREATE INDEX "users_erased_email_hash_idx" ON "users"("erased_email_hash");

-- A deleted account keeps no way to sign in or to take an email.
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_cannot_sign_in" CHECK ("deleted_at" IS NULL OR ("email_verified_at" IS NULL AND "password_hash" IS NULL AND "microsoft_id" IS NULL AND "pending_email" IS NULL));

-- Only a deleted account keeps the hash of its old email.
ALTER TABLE "users" ADD CONSTRAINT "users_erased_email_hash_only_when_deleted" CHECK ("erased_email_hash" IS NULL OR "deleted_at" IS NOT NULL);

-- The pending email becomes the email, which must be lowercase too.
ALTER TABLE "users" ADD CONSTRAINT "users_pending_email_lowercase" CHECK ("pending_email" = lower("pending_email"));

CREATE TABLE "sign_in_nonces" (
    "id" UUID NOT NULL,
    "nonce_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_in_nonces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sign_in_nonces_nonce_hash_key" ON "sign_in_nonces"("nonce_hash");

CREATE INDEX "sign_in_nonces_expires_at_idx" ON "sign_in_nonces"("expires_at");
