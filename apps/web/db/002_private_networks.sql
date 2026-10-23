-- Private networks are NOT publications. Apply separately after Neon Auth setup.
-- PostgreSQL 17 / Neon. Do not grant public or anonymous access to these tables.
CREATE TABLE IF NOT EXISTS mossline_private_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL CHECK (length(owner_user_id) BETWEEN 6 AND 256),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_user_id)
);
CREATE INDEX IF NOT EXISTS mossline_private_networks_owner_idx
  ON mossline_private_networks (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS mossline_private_network_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL,
  owner_user_id text NOT NULL,
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  graph jsonb NOT NULL CHECK (
    jsonb_typeof(graph) = 'object'
    AND jsonb_typeof(graph->'nodes') = 'array'
    AND jsonb_typeof(graph->'edges') = 'array'
  ),
  nodes_count integer NOT NULL CHECK (nodes_count BETWEEN 0 AND 50000),
  edges_count integer NOT NULL CHECK (edges_count BETWEEN 0 AND 100000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network_id, content_sha256),
  UNIQUE (id, network_id, owner_user_id),
  FOREIGN KEY (network_id, owner_user_id)
    REFERENCES mossline_private_networks (id, owner_user_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS mossline_private_network_versions_network_idx
  ON mossline_private_network_versions (network_id, created_at DESC);

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mossline_private_networks_current_version_fk'
  ) THEN
    ALTER TABLE mossline_private_networks
      ADD CONSTRAINT mossline_private_networks_current_version_fk
      FOREIGN KEY (current_version_id, id, owner_user_id)
      REFERENCES mossline_private_network_versions (id, network_id, owner_user_id);
  END IF;
END $;

-- Defence in depth. App server uses direct SQL with explicit owner predicates.
-- RLS remains enabled even if a future Data API integration is introduced.
ALTER TABLE mossline_private_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mossline_private_network_versions ENABLE ROW LEVEL SECURITY;
-- No anonymous/authenticated Data API policies are created in this alpha.
-- Dedicated server owner role accesses through SQL and checks session + ownership.
