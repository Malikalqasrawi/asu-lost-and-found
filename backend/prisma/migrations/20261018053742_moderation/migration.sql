-- CreateEnum
CREATE TYPE "HideCause" AS ENUM ('MODERATION', 'BAN');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'FAKE', 'OFFENSIVE', 'PERSONAL_DETAILS', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "EmailCodePurpose" ADD VALUE 'ADMIN_SIGN_IN';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "removed_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "hidden_at" TIMESTAMPTZ(3),
ADD COLUMN     "hide_cause" "HideCause";

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "admin_session" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ban_reason" TEXT,
ADD COLUMN     "banned_at" TIMESTAMPTZ(3),
ADD COLUMN     "banned_until" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "post_id" UUID,
    "message_id" UUID,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_post_id_idx" ON "reports"("post_id");

-- CreateIndex
CREATE INDEX "reports_message_id_idx" ON "reports"("message_id");

-- CreateIndex
CREATE INDEX "reports_resolved_by_id_idx" ON "reports"("resolved_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_id_post_id_key" ON "reports"("reporter_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_id_message_id_key" ON "reports"("reporter_id", "message_id");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The API checks these too; the database keeps them true whatever writes to it.
ALTER TABLE "reports" ADD CONSTRAINT "reports_one_target" CHECK (num_nonnulls("post_id", "message_id") = 1);
ALTER TABLE "reports" ADD CONSTRAINT "reports_details_length" CHECK (char_length("details") <= 500);
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_matches_status" CHECK (("status" = 'OPEN') = ("resolved_at" IS NULL) AND ("resolved_at" IS NULL) = ("resolved_by_id" IS NULL));
ALTER TABLE "posts" ADD CONSTRAINT "posts_hidden_with_cause" CHECK (("hidden_at" IS NULL) = ("hide_cause" IS NULL));
ALTER TABLE "users" ADD CONSTRAINT "users_ban_fields" CHECK ("banned_at" IS NOT NULL OR ("banned_until" IS NULL AND "ban_reason" IS NULL));
ALTER TABLE "users" ADD CONSTRAINT "users_ban_reason_length" CHECK (char_length("ban_reason") <= 500);
