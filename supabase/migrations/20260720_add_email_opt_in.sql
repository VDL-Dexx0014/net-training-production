-- Add email_opt_in column to profiles
-- Clients can opt in to email marketing/communications
-- Default false; populated during client import runs for production

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_opt_in boolean NOT NULL DEFAULT false;
