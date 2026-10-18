-- Trigram similarity compares titles by letter groups, so Arabic and English
-- titles both match and small typos still do.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "match_emailed_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "match_dismissals" (
    "lost_post_id" UUID NOT NULL,
    "found_post_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_dismissals_pkey" PRIMARY KEY ("lost_post_id","found_post_id")
);

-- CreateIndex
CREATE INDEX "match_dismissals_found_post_id_idx" ON "match_dismissals"("found_post_id");

-- CreateIndex
CREATE INDEX "posts_type_category_happened_on_idx" ON "posts"("type", "category", "happened_on");

-- AddForeignKey
ALTER TABLE "match_dismissals" ADD CONSTRAINT "match_dismissals_lost_post_id_fkey" FOREIGN KEY ("lost_post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_dismissals" ADD CONSTRAINT "match_dismissals_found_post_id_fkey" FOREIGN KEY ("found_post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
