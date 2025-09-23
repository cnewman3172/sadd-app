-- Add Setting.activeSince to record manual activation time
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "activeSince" TIMESTAMPTZ;

