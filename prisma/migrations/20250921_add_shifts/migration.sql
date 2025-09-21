-- Create Shift and ShiftSignup tables
CREATE TYPE "ShiftRole" AS ENUM ('COORDINATOR');

CREATE TABLE "Shift" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT,
  "role" "ShiftRole" NOT NULL DEFAULT 'COORDINATOR',
  "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "endsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "needed" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "Shift_startsAt_idx" ON "Shift" ("startsAt");

CREATE TABLE "ShiftSignup" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shiftId" UUID NOT NULL REFERENCES "Shift"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
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

