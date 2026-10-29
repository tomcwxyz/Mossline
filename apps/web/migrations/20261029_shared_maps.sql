-- Shared maps. Apply after 20261027_accounts.sql, on a development database first.
-- A shared map is a copy of someone's map kept on this server so that they and
-- the people they invite can open it anywhere and edit it together.
-- The imported records are stored as one gzip-compressed JSON document; the
-- changes people make are stored one per row, exactly as in the browser's
-- change list, so the imported records are never rewritten.
BEGIN;

CREATE TABLE IF NOT EXISTS mossline_maps (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES mossline_users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  -- The imported records: gzip-compressed GraphDocument JSON.
  source BYTEA NOT NULL,
  source_nodes INTEGER NOT NULL,
  source_edges INTEGER NOT NULL,
  source_version INTEGER NOT NULL DEFAULT 1 CHECK (source_version > 0),
  source_updated_by TEXT REFERENCES mossline_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mossline_maps_owner_idx ON mossline_maps (owner_id, updated_at DESC);

-- People invited to a map, by email address, so an invitation works before
-- they have signed in for the first time.
CREATE TABLE IF NOT EXISTS mossline_map_members (
  map_id TEXT NOT NULL REFERENCES mossline_maps (id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(email)),
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  invited_by TEXT REFERENCES mossline_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (map_id, email)
);
CREATE INDEX IF NOT EXISTS mossline_map_members_email_idx ON mossline_map_members (email);

-- Every change anyone makes, in the order the server received them (seq).
-- version moves on every insert and every undo/redo, so a browser can ask
-- for "everything since version N".
CREATE SEQUENCE IF NOT EXISTS mossline_map_edit_seq;
CREATE TABLE IF NOT EXISTS mossline_map_edits (
  map_id TEXT NOT NULL REFERENCES mossline_maps (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  seq BIGINT NOT NULL DEFAULT nextval('mossline_map_edit_seq'),
  version BIGINT NOT NULL DEFAULT nextval('mossline_map_edit_seq'),
  author_id TEXT REFERENCES mossline_users (id) ON DELETE SET NULL,
  entry JSONB NOT NULL CHECK (jsonb_typeof(entry) = 'object'),
  undone BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (map_id, id)
);
CREATE INDEX IF NOT EXISTS mossline_map_edits_version_idx ON mossline_map_edits (map_id, version);

COMMIT;
