-- Create enum for TC transfer workflow
CREATE TYPE "TransferStatus" AS ENUM ('PENDING','ACCEPTED','DECLINED','CANCELLED');

-- Create table to track transfer requests between truck commanders
CREATE TABLE "TcTransfer" (
    "id" TEXT NOT NULL,
    "vanId" TEXT NOT NULL,
    "fromTcId" TEXT NOT NULL,
    "toTcId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "TcTransfer_pkey" PRIMARY KEY ("id")
);

-- Helpful index for looking up active/pending transfers per van
CREATE INDEX "TcTransfer_vanId_status_idx" ON "TcTransfer"("vanId", "status");

-- Foreign key constraints
ALTER TABLE "TcTransfer"
  ADD CONSTRAINT "TcTransfer_vanId_fkey" FOREIGN KEY ("vanId") REFERENCES "Van"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TcTransfer"
  ADD CONSTRAINT "TcTransfer_fromTcId_fkey" FOREIGN KEY ("fromTcId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TcTransfer"
  ADD CONSTRAINT "TcTransfer_toTcId_fkey" FOREIGN KEY ("toTcId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
