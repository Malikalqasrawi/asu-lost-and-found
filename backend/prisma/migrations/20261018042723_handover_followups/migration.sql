-- Follow-ups to the handovers migration: a finished state for desk items, the
-- activity time the Messages list is sorted by, and handovers for claims that
-- were accepted before handovers existed.

-- AlterEnum
ALTER TYPE "DeskStatus" ADD VALUE 'PICKED_UP';

-- DropIndex
DROP INDEX "messages_handover_id_created_at_idx";

-- AlterTable
ALTER TABLE "handovers" ADD COLUMN     "last_activity_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "messages_handover_id_created_at_id_idx" ON "messages"("handover_id", "created_at", "id");

UPDATE "handovers" h SET "last_activity_at" = COALESCE(
  (SELECT max(m."created_at") FROM "messages" m WHERE m."handover_id" = h."claim_id"),
  h."created_at"
);

-- Picked-up items keep who received them at the desk.
ALTER TABLE "desk_items" DROP CONSTRAINT "desk_items_received_matches_status";
ALTER TABLE "desk_items" ADD CONSTRAINT "desk_items_received_matches_status" CHECK (("status" <> 'ON_THE_WAY') = ("received_at" IS NOT NULL) AND ("received_at" IS NULL) = ("received_by_id" IS NULL));

-- Every accepted claim gets a handover with a random 6-digit pickup code.
INSERT INTO "handovers" ("claim_id", "post_id", "finder_id", "owner_id", "pickup_code")
SELECT c."id", c."post_id", p."author_id", c."claimant_id",
       lpad(((('x' || left(replace(gen_random_uuid()::text, '-', ''), 8))::bit(32)::bigint) % 1000000)::text, 6, '0')
FROM "claims" c
JOIN "posts" p ON p."id" = c."post_id"
WHERE c."status" = 'ACCEPTED'
  AND NOT EXISTS (SELECT 1 FROM "handovers" h WHERE h."claim_id" = c."id");
