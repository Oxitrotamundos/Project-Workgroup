-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('user', 'placeholder');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "resources" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "kind" "ResourceKind" NOT NULL DEFAULT 'placeholder',
    "status" "ResourceStatus" NOT NULL DEFAULT 'active',
    "user_id" BIGINT,
    "avatar_url" TEXT,
    "discipline" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resources_user_id_key" ON "resources"("user_id");

-- CreateIndex
CREATE INDEX "resources_kind_status_idx" ON "resources"("kind", "status");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
