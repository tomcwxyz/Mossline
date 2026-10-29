-- Accounts for publishing. Apply after 20261021_hosted_publications.sql,
-- on a development database first. Tables follow Better Auth's schema
-- (better-auth 1.7), renamed with the mossline_ prefix and snake_case columns.
-- Kept: name and email. Not kept: provider tokens, photos, IP addresses,
-- browser details (Mossline blanks them before they are written).
BEGIN;

CREATE TABLE IF NOT EXISTS mossline_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mossline_sessions (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES mossline_users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS mossline_sessions_user_id_idx ON mossline_sessions (user_id);

CREATE TABLE IF NOT EXISTS mossline_accounts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES mossline_users (id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS mossline_accounts_user_id_idx ON mossline_accounts (user_id);

CREATE TABLE IF NOT EXISTS mossline_verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS mossline_verifications_identifier_idx ON mossline_verifications (identifier);

CREATE TABLE IF NOT EXISTS mossline_auth_rate_limits (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL,
  last_request BIGINT NOT NULL
);

-- Publications now belong to an account. Deleting an account deletes its
-- publications. Older publications keep their management-key hash until
-- their author claims them into an account; claiming clears it.
ALTER TABLE mossline_publications
  ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES mossline_users (id) ON DELETE CASCADE,
  ALTER COLUMN management_hash DROP NOT NULL;
ALTER TABLE mossline_publications DROP CONSTRAINT IF EXISTS mossline_publication_controlled;
ALTER TABLE mossline_publications ADD CONSTRAINT mossline_publication_controlled
  CHECK (owner_id IS NOT NULL OR management_hash IS NOT NULL);
CREATE INDEX IF NOT EXISTS mossline_publications_owner_idx
  ON mossline_publications (owner_id, created_at DESC);

COMMIT;
