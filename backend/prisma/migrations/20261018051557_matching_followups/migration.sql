-- "One match email a day" belongs to the student, not to each lost post: a
-- check on the student's own row holds when two found items arrive at once.
-- The column on posts only ever held times of local test emails.
ALTER TABLE "posts" DROP COLUMN "match_emailed_at";
ALTER TABLE "users" ADD COLUMN "match_emailed_at" TIMESTAMPTZ(3);

-- Matching only ever looks at open posts, so the index leaves the rest out.
DROP INDEX "posts_type_category_happened_on_idx";
CREATE INDEX "posts_open_type_category_happened_on_idx" ON "posts" ("type", "category", "happened_on") WHERE "status" = 'OPEN';
