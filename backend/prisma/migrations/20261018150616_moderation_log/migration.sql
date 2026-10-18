-- A record of what each admin did, so moderation decisions can be traced.

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('HIDE_POST', 'RESTORE_POST', 'REMOVE_MESSAGE', 'DISMISS_REPORTS', 'BAN', 'UNBAN');

-- CreateTable
CREATE TABLE "moderation_log" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "post_id" UUID,
    "message_id" UUID,
    "student_id" UUID,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_log_created_at_idx" ON "moderation_log"("created_at");

-- CreateIndex
CREATE INDEX "moderation_log_admin_id_idx" ON "moderation_log"("admin_id");

-- CreateIndex
CREATE INDEX "moderation_log_post_id_idx" ON "moderation_log"("post_id");

-- CreateIndex
CREATE INDEX "moderation_log_message_id_idx" ON "moderation_log"("message_id");

-- CreateIndex
CREATE INDEX "moderation_log_student_id_idx" ON "moderation_log"("student_id");

-- AddForeignKey
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Each entry is about exactly one post, message or student, and only bans carry a note.
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_one_target" CHECK (num_nonnulls("post_id", "message_id", "student_id") = 1);
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_note_length" CHECK (char_length("note") <= 500);
