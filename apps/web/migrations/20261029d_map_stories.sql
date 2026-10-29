-- Stories kept with shared maps. Apply after 20261029c_account_care.sql.
-- A story is written by the people who can change the map, and read by
-- everyone who can open it. Each save moves its version on, so two people
-- saving at once can't silently overwrite each other.
BEGIN;

CREATE TABLE IF NOT EXISTS mossline_map_stories (
  map_id TEXT NOT NULL REFERENCES mossline_maps (id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  steps INTEGER NOT NULL,
  -- The whole story, including its pictures (as data URLs).
  story JSONB NOT NULL CHECK (jsonb_typeof(story) = 'object'),
  bytes INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT REFERENCES mossline_users (id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES mossline_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (map_id, id)
);

COMMIT;
