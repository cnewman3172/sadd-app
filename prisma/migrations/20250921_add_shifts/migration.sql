-- Create Shift and ShiftSignup tables
CREATE TYPE "ShiftRole" AS ENUM ('COORDINATOR');

-- Use TEXT ids to match existing User.id type (TEXT)
CREATE TABLE "Shift" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "role" "ShiftRole" NOT NULL DEFAULT 'COORDINATOR',
  "startsAt" TIMESTAMPTZ NOT NULL,
  "endsAt" TIMESTAMPTZ NOT NULL,
  "needed" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "Shift_startsAt_idx" ON "Shift" ("startsAt");

CREATE TABLE "ShiftSignup" (
  "id" TEXT PRIMARY KEY,
  "shiftId" TEXT NOT NULL REFERENCES "Shift"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ShiftSignup_shift_user_unique" UNIQUE ("shiftId","userId")
);

-- Trigger to update updatedAt on Shift
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_shift_updated BEFORE UPDATE ON "Shift"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
