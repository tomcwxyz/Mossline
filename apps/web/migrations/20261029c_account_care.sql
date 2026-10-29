-- Looking after accounts: when they were last used, email changes, and a
-- record of sign-in link requests per address (scrambled) to stop flooding.
BEGIN;

ALTER TABLE mossline_users
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inactivity_warned_at TIMESTAMPTZ;
UPDATE mossline_users SET last_active_at = coalesce(last_active_at, updated_at, created_at);

CREATE TABLE IF NOT EXISTS mossline_email_changes (
  token_hash CHAR(64) PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES mossline_users (id) ON DELETE CASCADE,
  new_email TEXT NOT NULL CHECK (new_email = lower(new_email)),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Only a SHA-256 of the address is kept, for at most a day.
CREATE TABLE IF NOT EXISTS mossline_signin_requests (
  email_hash CHAR(64) NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mossline_signin_requests_idx ON mossline_signin_requests (email_hash, requested_at);

COMMIT;
