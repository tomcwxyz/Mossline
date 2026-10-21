-- Mossline Alpha 1.8: apply manually to an isolated Neon dev branch first.
-- Stores only previously reviewed, minimal public snapshots. NEVER source imports.
BEGIN;
CREATE TABLE IF NOT EXISTS mossline_publications (
  slug VARCHAR(32) PRIMARY KEY,
  management_hash CHAR(64) NOT NULL,
  snapshot JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mossline_snapshot_object CHECK (jsonb_typeof(snapshot) = 'object')
);
CREATE INDEX IF NOT EXISTS mossline_publications_active_idx
  ON mossline_publications (updated_at DESC) WHERE is_published = TRUE;
COMMIT;
