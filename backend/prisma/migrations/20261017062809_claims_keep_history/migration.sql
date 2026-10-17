-- Claims are the history the 3-claims limit and the admin review rely on, so a
-- user or post that has claims can't be deleted along with them.

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_claimant_id_fkey";

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_post_id_fkey";

-- CreateIndex
CREATE INDEX "claim_answers_question_id_idx" ON "claim_answers"("question_id");

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A claim has a decision time exactly when it has been decided.
ALTER TABLE "claims" ADD CONSTRAINT "claims_decided_at_matches_status" CHECK (("status" = 'PENDING') = ("decided_at" IS NULL));
