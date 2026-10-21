# Mossline Alpha 1.8: controlled hosted publishing

**Status: built behind a disabled-by-default feature flag.** Unlike Alpha 1.7 URL-fragment links, Alpha 1.8 stores a deliberately reduced public snapshot behind a stable URL. This is not a private workspace or user-account system.

## Isolated development rollout

1. Provision a new Neon development project or branch for Mossline. Do not use an existing production database.
2. Review and apply `apps/web/migrations/20261021_hosted_publications.sql` on that development database only. This creates a new table and index; it never changes source-map tables. Confirm the application role has the intended read and write grants.
3. Create an authorisation secret with at least 32 characters/bytes of strong randomness, for example `openssl rand -base64 48`.
4. Configure `MOSSLINE_DATABASE_URL`, `MOSSLINE_PUBLISH_ADMIN_KEY`, and `MOSSLINE_HOSTED_PUBLISHING_ENABLED=true` as **server-only**, scoped to the feature-branch preview deployment. Keep production disabled. Redeploy the preview.
5. Check `GET /api/publications/status` returns `{"enabled":true}`. Use the **Publish online** panel on a fictional, rights-cleared network. Inspect every disclosed entity and relationship.
6. Save the returned management key in a password manager. Test opening `/p/<slug>` in another browser, update the same URL with a new snapshot and valid owner key, reject a wrong key or stale revision, then unpublish. Both page and GET API must return 404 after withdrawal.
7. Test invalid/oversized snapshots and missing credentials. Confirm only the reduced snapshot and SHA-256 hash of the owner key are stored.
8. Before exposing public publishers, add operational rate limits, abuse handling, monitoring, access logs and retention policy. Production rollout and migration require separate review.

## API model

- `POST /api/publications`: server-authorised publisher key required; creates a reviewed, minimal snapshot and returns a random public slug plus a different random **management key once**.
- `GET /api/publications/<slug>` and `GET /p/<slug>`: public, current read-only snapshot only; no-store and noindex.
- `PATCH /api/publications/<slug>`: owner management key and current revision required. Atomic compare-and-swap update; returns a new revision.
- `DELETE /api/publications/<slug>`: owner management key required; makes future reads return 404.

Management keys are never saved to browser localStorage, never placed in public URLs, and only their SHA-256 hashes are retained server-side. Losing the key means the author cannot self-manage the publication; administrator intervention would be required. Publishing authorisation is shared-secret based rather than user-account based.

**Anyone with a public URL can read all its content.** This is not private sharing, invitation access or a permissions framework. The publishing schema excludes imported raw custom fields, provenance, source URLs, evidence detail and unapproved descriptions or images. Entity IDs, labels, relationship assertions and, for UK atlas views, source coordinates *are public* and must be reviewed.

**Unpublishing cannot retract copies already downloaded, screenshotted, cached or redistributed.** Updates replace only the server's current copy. External pictures contact their hosting services when displayed.

The current Vercel project has SSO protection on preview URLs, so anonymous users may be blocked even if the publication API works. This is a separate deployment-protection consideration.

No migrations run automatically at build or deployment. Hosted publishing stays disabled without all three environment settings. `GET /api/publications/status` reports enabled configuration, not confirmation that migrations have been applied.
