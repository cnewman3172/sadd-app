-- Migrate roles: remove VOLUNTEER, rename COORDINATOR->DISPATCHER, add DRIVER and SAFETY
-- Also update ShiftRole accordingly and remap existing rows.
BEGIN;

-- 1) Create new enums with desired values
CREATE TYPE "Role_new" AS ENUM ('ADMIN','DISPATCHER','TC','DRIVER','SAFETY','RIDER');
CREATE TYPE "ShiftRole_new" AS ENUM ('DISPATCHER','TC','DRIVER','SAFETY');

-- 2) Drop defaults that depend on old enum before type change
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Shift" ALTER COLUMN "role" DROP DEFAULT;

-- 3) Alter columns to use new enum types, remapping values
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE
      WHEN "role"::text = 'COORDINATOR' THEN 'DISPATCHER'::text
      WHEN "role"::text = 'VOLUNTEER' THEN 'DRIVER'::text
      ELSE "role"::text
    END
  )::"Role_new";

ALTER TABLE "Shift"
  ALTER COLUMN "role" TYPE "ShiftRole_new"
  USING (
    CASE
      WHEN "role"::text = 'COORDINATOR' THEN 'DISPATCHER'::text
      WHEN "role"::text = 'VOLUNTEER' THEN 'DRIVER'::text
      ELSE "role"::text
    END
  )::"ShiftRole_new";

-- 4) Restore defaults per updated schema
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'RIDER';
ALTER TABLE "Shift" ALTER COLUMN "role" SET DEFAULT 'DISPATCHER';

-- 5) Swap in the new enum types
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

DROP TYPE "ShiftRole";
ALTER TYPE "ShiftRole_new" RENAME TO "ShiftRole";

COMMIT;

