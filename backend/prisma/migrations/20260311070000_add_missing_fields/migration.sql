-- AlterTable
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "eta_updated_at" TIMESTAMP(3);
