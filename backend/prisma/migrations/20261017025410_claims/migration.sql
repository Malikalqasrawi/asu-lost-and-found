-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'CLOSED');

-- AlterEnum
ALTER TYPE "PostStatus" ADD VALUE 'CLAIMED';

-- CreateTable
CREATE TABLE "post_secrets" (
    "post_id" UUID NOT NULL,
    "private_notes" TEXT NOT NULL DEFAULT '',
    "serial_hash" TEXT,

    CONSTRAINT "post_secrets_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "claim_questions" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "claim_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "claimant_id" UUID NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL DEFAULT '',
    "serial_matches" BOOLEAN,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_answers" (
    "claim_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "claim_answers_pkey" PRIMARY KEY ("claim_id","question_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "claim_questions_post_id_position_key" ON "claim_questions"("post_id", "position");

-- CreateIndex
CREATE INDEX "claims_post_id_status_idx" ON "claims"("post_id", "status");

-- CreateIndex
CREATE INDEX "claims_claimant_id_created_at_idx" ON "claims"("claimant_id", "created_at");

-- AddForeignKey
ALTER TABLE "post_secrets" ADD CONSTRAINT "post_secrets_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_questions" ADD CONSTRAINT "claim_questions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_answers" ADD CONSTRAINT "claim_answers_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_answers" ADD CONSTRAINT "claim_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "claim_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The API checks these too; the database keeps them true whatever writes to it.
ALTER TABLE "post_secrets" ADD CONSTRAINT "post_secrets_notes_length" CHECK (char_length("private_notes") <= 1000);
ALTER TABLE "claim_questions" ADD CONSTRAINT "claim_questions_text_length" CHECK (char_length("text") BETWEEN 5 AND 200);
ALTER TABLE "claim_questions" ADD CONSTRAINT "claim_questions_position_range" CHECK ("position" BETWEEN 0 AND 2);
ALTER TABLE "claims" ADD CONSTRAINT "claims_message_length" CHECK (char_length("message") <= 1000);
ALTER TABLE "claim_answers" ADD CONSTRAINT "claim_answers_answer_length" CHECK (char_length("answer") BETWEEN 1 AND 300);

-- A student has at most one claim waiting on an item, and an item has at most
-- one accepted claim, even when two requests arrive at the same moment.
CREATE UNIQUE INDEX "claims_one_pending_per_claimant" ON "claims" ("post_id", "claimant_id") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "claims_one_accepted_per_post" ON "claims" ("post_id") WHERE "status" = 'ACCEPTED';
