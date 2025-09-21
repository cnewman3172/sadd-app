-- Add review fields to Ride
ALTER TABLE "Ride"
  ADD COLUMN IF NOT EXISTS "reviewComment" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewBypass" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reviewAt" TIMESTAMP(3);

