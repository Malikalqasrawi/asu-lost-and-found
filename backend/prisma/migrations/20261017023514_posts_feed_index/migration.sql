-- DropIndex
DROP INDEX "posts_status_type_created_at_idx";

-- CreateIndex
CREATE INDEX "posts_status_created_at_id_idx" ON "posts"("status", "created_at", "id");
