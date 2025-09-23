-- Add Setting.scheduleSince to anchor auto-disable start window
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "scheduleSince" TIMESTAMPTZ;

