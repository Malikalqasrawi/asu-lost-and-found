-- CreateEnum
CREATE TYPE "DeskStatus" AS ENUM ('ON_THE_WAY', 'AT_DESK');

-- CreateTable
CREATE TABLE "desk_items" (
    "post_id" UUID NOT NULL,
    "status" "DeskStatus" NOT NULL DEFAULT 'ON_THE_WAY',
    "received_by_id" UUID,
    "received_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "desk_items_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "handovers" (
    "claim_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "finder_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "pickup_code" TEXT NOT NULL,
    "wrong_codes" INTEGER NOT NULL DEFAULT 0,
    "finder_read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "owner_read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finder_emailed_at" TIMESTAMPTZ(3),
    "owner_emailed_at" TIMESTAMPTZ(3),
    "returned_at" TIMESTAMPTZ(3),
    "returned_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handovers_pkey" PRIMARY KEY ("claim_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "handover_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "desk_items_status_created_at_idx" ON "desk_items"("status", "created_at");

-- CreateIndex
CREATE INDEX "desk_items_received_by_id_idx" ON "desk_items"("received_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "handovers_post_id_key" ON "handovers"("post_id");

-- CreateIndex
CREATE INDEX "handovers_finder_id_idx" ON "handovers"("finder_id");

-- CreateIndex
CREATE INDEX "handovers_owner_id_idx" ON "handovers"("owner_id");

-- CreateIndex
CREATE INDEX "handovers_returned_by_id_idx" ON "handovers"("returned_by_id");

-- CreateIndex
CREATE INDEX "messages_handover_id_created_at_idx" ON "messages"("handover_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- AddForeignKey
ALTER TABLE "desk_items" ADD CONSTRAINT "desk_items_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desk_items" ADD CONSTRAINT "desk_items_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_finder_id_fkey" FOREIGN KEY ("finder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "handovers"("claim_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The API checks these too; the database keeps them true whatever writes to it.
ALTER TABLE "messages" ADD CONSTRAINT "messages_text_length" CHECK (char_length("text") BETWEEN 1 AND 1000);
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_pickup_code_format" CHECK ("pickup_code" ~ '^[0-9]{6}$');
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_wrong_codes_range" CHECK ("wrong_codes" BETWEEN 0 AND 5);
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_two_people" CHECK ("finder_id" <> "owner_id");
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_returned_by_whom" CHECK (("returned_at" IS NULL) = ("returned_by_id" IS NULL));
ALTER TABLE "desk_items" ADD CONSTRAINT "desk_items_received_matches_status" CHECK (("status" = 'AT_DESK') = ("received_at" IS NOT NULL) AND ("received_at" IS NULL) = ("received_by_id" IS NULL));
