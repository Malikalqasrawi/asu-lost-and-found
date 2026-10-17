-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('LOST', 'FOUND');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('OPEN', 'RETURNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('PHONE', 'LAPTOP', 'WALLET', 'KEYS', 'BAG', 'ID_CARD', 'BOOKS', 'CLOTHING', 'ELECTRONICS', 'JEWELRY', 'OTHER');

-- CreateTable
CREATE TABLE "campus_places" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campus_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "type" "PostType" NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" "Category" NOT NULL,
    "place_id" UUID NOT NULL,
    "place_details" TEXT,
    "happened_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_photos" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "original_key" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campus_places_name_key" ON "campus_places"("name");

-- CreateIndex
CREATE INDEX "posts_status_type_created_at_idx" ON "posts"("status", "type", "created_at");

-- CreateIndex
CREATE INDEX "posts_author_id_created_at_idx" ON "posts"("author_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "post_photos_original_key_key" ON "post_photos"("original_key");

-- CreateIndex
CREATE UNIQUE INDEX "post_photos_public_key_key" ON "post_photos"("public_key");

-- CreateIndex
CREATE UNIQUE INDEX "post_photos_post_id_position_key" ON "post_photos"("post_id", "position");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "campus_places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_photos" ADD CONSTRAINT "post_photos_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The API checks these too; the database keeps them true whatever writes to it.
ALTER TABLE "posts" ADD CONSTRAINT "posts_title_length" CHECK (char_length("title") BETWEEN 3 AND 80);
ALTER TABLE "posts" ADD CONSTRAINT "posts_description_length" CHECK (char_length("description") <= 1000);
ALTER TABLE "posts" ADD CONSTRAINT "posts_place_details_length" CHECK (char_length("place_details") <= 120);
ALTER TABLE "post_photos" ADD CONSTRAINT "post_photos_position_range" CHECK ("position" BETWEEN 0 AND 3);

-- A starting list; rename these to the real buildings later.
INSERT INTO "campus_places" ("id", "name", "sort_order") VALUES
    (gen_random_uuid(), 'Main gate', 1),
    (gen_random_uuid(), 'Library', 2),
    (gen_random_uuid(), 'Faculty of Information Technology', 3),
    (gen_random_uuid(), 'Faculty of Engineering', 4),
    (gen_random_uuid(), 'Cafeteria', 5),
    (gen_random_uuid(), 'Mosque', 6),
    (gen_random_uuid(), 'Sports hall', 7),
    (gen_random_uuid(), 'Parking', 8),
    (gen_random_uuid(), 'Somewhere else on campus', 99);
