-- Feature requests are not public until an operator approves them.
-- Removing a publication or deleting its owner automatically removes its showcase entry.
BEGIN;
CREATE TABLE IF NOT EXISTS mossline_showcase (
  slug VARCHAR(32) PRIMARY KEY REFERENCES mossline_publications(slug) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL REFERENCES mossline_users(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 30 AND 600),
  credit TEXT NOT NULL CHECK (char_length(credit) BETWEEN 2 AND 80),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by TEXT REFERENCES mossline_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS mossline_showcase_review_idx ON mossline_showcase(status,submitted_at DESC);
COMMIT;
