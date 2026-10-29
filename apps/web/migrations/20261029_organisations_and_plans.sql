-- Organisations, plans and billing. Apply after 20261029_shared_maps.sql,
-- on a development database first.
BEGIN;

-- When someone agreed to the terms, and which version.
ALTER TABLE mossline_users
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS mossline_orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  -- 'organisation' while paid up (plan_until in the future, or no end date
  -- for plans the operator grants by hand); otherwise the free limits apply.
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'organisation')),
  plan_until TIMESTAMPTZ,
  plan_source TEXT CHECK (plan_source IN ('stripe', 'invoice', 'operator')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  -- People with a verified address at this domain may join without an invitation.
  join_domain TEXT CHECK (join_domain = lower(join_domain)),
  created_by TEXT REFERENCES mossline_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mossline_orgs_join_domain_idx ON mossline_orgs (join_domain) WHERE join_domain IS NOT NULL;

-- One organisation per person, for now.
CREATE TABLE IF NOT EXISTS mossline_org_members (
  org_id TEXT NOT NULL REFERENCES mossline_orgs (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE REFERENCES mossline_users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS mossline_org_invites (
  org_id TEXT NOT NULL REFERENCES mossline_orgs (id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(email)),
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by TEXT REFERENCES mossline_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, email)
);
CREATE INDEX IF NOT EXISTS mossline_org_invites_email_idx ON mossline_org_invites (email);

-- Maps and publications made by a member belong to their organisation, so
-- they stay when that person leaves.
ALTER TABLE mossline_maps ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES mossline_orgs (id) ON DELETE SET NULL;
ALTER TABLE mossline_publications ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES mossline_orgs (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS mossline_maps_org_idx ON mossline_maps (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mossline_publications_org_idx ON mossline_publications (org_id) WHERE org_id IS NOT NULL;

-- Payment events already handled, so a retried webhook does nothing twice.
CREATE TABLE IF NOT EXISTS mossline_billing_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
