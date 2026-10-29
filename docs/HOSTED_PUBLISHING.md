# Hosted publishing and accounts

**Status: off by default.** A deployment can let named people publish a reviewed
copy of a map at a stable link. Publishing needs an account; nothing else in
Mossline does. Maps people work on stay in their own browser.

## What an account is for

An account exists so a published map belongs to someone: they can update it,
unpublish it, and leave. There is no shared publisher key and no management key
to lose.

| Kept | Not kept |
| --- | --- |
| Name (when the sign-in provider gives one) and email address | Passwords (there are none) |
| A session cookie, in the browser and as a database row | Provider access, refresh or ID tokens (blanked before they are written) |
| The maps the account has published | Profile photos, IP addresses or browser details on sessions |

Sign-in rate limits key on the requester's IP address for about a minute, in
`mossline_auth_rate_limits`. Sign-in links are stored hashed and expire after
10 minutes.

**Who can sign in:** only the addresses and domains in `MOSSLINE_PUBLISHERS`.
Anyone else gets the same "check your email" reply and nothing is stored or
sent, so the form can't be used to find out who has an account. A provider
sign-in from an unlisted or unverified address is refused, and a provider
sign-in joins an existing account only when the provider has verified the address. Removing an address from the list
stops that account publishing at once; its maps stay up until unpublished.

**Leaving:** *Your account → Delete account* removes the person and everything
they published. Unpublishing a map deletes its stored copy.

To let people save maps to their accounts and work on them together, see
[SHARED_MAPS.md](SHARED_MAPS.md).

## Ways to sign in

Each is switched on by giving it credentials. Use at least one.

- **Microsoft** (work, school or personal accounts). Register an app in Microsoft
  Entra ID, add the redirect URI `<MOSSLINE_BASE_URL>/api/auth/callback/microsoft`,
  and set `MOSSLINE_MICROSOFT_CLIENT_ID` and `MOSSLINE_MICROSOFT_CLIENT_SECRET`.
  Under *Token configuration*, add the optional ID-token claims
  `verified_primary_email` and `verified_secondary_email`: Mossline only accepts
  an address the provider has verified, because the publishers list depends on it.
  `MOSSLINE_MICROSOFT_TENANT` is `common` by default; use `organizations` to
  exclude personal accounts, or a tenant ID for one organisation.
- **Google**. Create an OAuth client in Google Cloud with the redirect URI
  `<MOSSLINE_BASE_URL>/api/auth/callback/google`, and set
  `MOSSLINE_GOOGLE_CLIENT_ID` and `MOSSLINE_GOOGLE_CLIENT_SECRET`.
- **Email link**. Set `MOSSLINE_EMAIL_FROM` and `MOSSLINE_SMTP_URL` (any SMTP
  service, e.g. `smtps://user:password@smtp.example.org:465`). The link works
  once and lasts 10 minutes.

Accounts are handled by [Better Auth](https://better-auth.com) running inside
Mossline, against Mossline's own Postgres database. No sign-in service holds
the account list.

## Setting it up

1. Create a Postgres database (Neon, Supabase, or your own server; a UK or EU
   region keeps the data where your users expect it). Use a development
   database first.
2. Apply the migrations in order, by hand:
   `apps/web/migrations/20261021_hosted_publications.sql`, then
   `apps/web/migrations/20261027_accounts.sql`. Nothing runs automatically.
3. Set these **server-only** variables (never with a `NEXT_PUBLIC_` prefix):
   - `MOSSLINE_HOSTED_PUBLISHING_ENABLED=true`
   - `MOSSLINE_DATABASE_URL` (add `sslmode=require` for hosted databases)
   - `MOSSLINE_AUTH_SECRET`, at least 32 random characters: `openssl rand -base64 48`
   - `MOSSLINE_BASE_URL`, the address people use, e.g. `https://mossline.example.org`
   - `MOSSLINE_PUBLISHERS`, e.g. `tom@example.org, @example.net` (or `*` for anyone)
   - the credentials for at least one way to sign in (above)
   - optionally `MOSSLINE_PUBLISH_DAILY_LIMIT` (new maps per account per day, default 20)
4. Redeploy and check `GET /api/publications/status` returns `"enabled": true`.
5. In a map, choose **Share → Publish online…**, sign in, review, publish. Open the
   link in another browser. Update it, then unpublish it from *Your account* and
   check the link returns 404.

Without every required setting in step 3, publishing stays off and the Share
menu offers only the view link.

## What gets published

The Share menu publishes **what's drawn now**, recorded links only: names,
types, links between them (with their direction and any + / − sign) and, where
records have places, their locations. Descriptions and picture addresses only
when ticked. Never source files, tags, amounts, sources, notes, suggested links
or the list of changes.

A published copy can be a whole map: up to 20,000 records and 60,000 links, and
4 MB per upload (what one serverless request can carry). The link opens in the
same atlas, read-only: nothing is read from or saved to the visitor's browser.

(*Share → Copy view link* is different: it opens the view for someone who has
the same data in their own browser. The older `/share#…` links that carry a
small map inside the address itself are still limited to 150 records and 300
links, because an address can only be so long.)

**Anyone with the link can see it.** Unpublishing stops the link working but
cannot recall copies already downloaded, screenshotted or cached.

## API

- `GET /api/publications/status`: whether publishing is on, which sign-in methods, who is signed in.
- `GET /api/publications`: the signed-in account's maps.
- `POST /api/publications`: publish a reviewed snapshot as the signed-in account.
- `GET /api/publications/<slug>` and `/p/<slug>`: the public copy; no-store, noindex.
- `PATCH /api/publications/<slug>`: the owner replaces it, from the revision they last saw.
- `DELETE /api/publications/<slug>`: the owner unpublishes it; the stored copy is deleted.
- `POST /api/publications/claim`: moves a map published before accounts into the
  signed-in account, using its management key. The key stops working.
- `/api/auth/*`: sign-in, sign-out and account deletion (Better Auth).

Every change needs a signed-in account that is still on the publishers list, and
must come from Mossline's own pages (the `Origin` header is checked).

## Testing

`apps/web/e2e/accounts.spec.ts` runs the whole journey when the server has
publishing on and `MOSSLINE_TEST_MAIL_DIR` set: sign-in links are then written to
files in that folder instead of being emailed. **Never set it on a deployment
people use.** CI starts Postgres for this.

## Before opening publishing to the public

`MOSSLINE_PUBLISHERS=*` lets anyone with an email address publish. Before doing
that, add abuse reporting and takedown, monitoring, a published privacy notice
and retention policy, and terms of use.
