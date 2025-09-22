-- Add VOLUNTEER to ShiftRole enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ShiftRole' AND e.enumlabel = 'VOLUNTEER'
  ) THEN
    ALTER TYPE "ShiftRole" ADD VALUE 'VOLUNTEER';
  END IF;
END
$$;

