# Plans, organisations and billing

**Status: off by default.** Everything in the browser is free and needs no account. Where a deployment turns plans on (as the hosted Mossline does), accounts get a free allowance, and organisations can pay for more. A Mossline anyone else runs has no limits and takes no payments unless they choose to.

## Plans

| | Free | Organisation |
| --- | --- | --- |
| Price | £0 | £49 a year for the whole organisation (`MOSSLINE_PLAN_PRICE` sets the wording) |
| Published maps | 3 | 100 |
| Maps kept in the account | 1 | 50 |
| People a map is shared with | 3 | 50 |
| Map size (compressed upload) | 1 MB | 4 MB |
| Everyone in the organisation can open and edit its maps | n/a | Yes |
| Anyone at the organisation's email domain may join | n/a | Yes |

The limits live in `apps/web/src/lib/plans.ts`. They're checked on the server when someone publishes, saves a map, invites someone to a map or uploads a map, never in the browser alone.

**Nothing is deleted when a limit is reached or a plan ends.** People just can't add more beyond the free limits; everything they have stays and can still be opened, changed, exported, unpublished and deleted.

## Who can sign up

- `MOSSLINE_OPEN_SIGNUP=true` lets anyone with an email address create a free account.
- Without it, only the addresses or domains in `MOSSLINE_PUBLISHERS` can.
- In both cases, people invited to an organisation or to a shared map can sign in. Members of an organisation can publish and keep maps under it, whoever let them in.

Accounts record which version of the terms they agreed to (`TERMS_VERSION` in `lib/legal.ts`) and when.

## Organisations

- **Joining.** Each person is in at most one organisation. Starting one makes you its admin, and moves what you'd already published or kept into it. Admins invite people by email. They can also let anyone who signs in with an address at their own domain join; shared mail services such as Gmail and Outlook can't be used for this.
- **Ownership.** Maps and published maps made by members belong to the organisation. When someone leaves or deletes their account, what they made passes to another admin. The last admin can't leave while others remain; if they delete their account, the longest-standing member becomes admin. The last person leaving closes the organisation, and its maps go back to their makers' own accounts.
- **Access.** Everyone in an organisation can open and edit its shared maps. Admins can also manage who else has them, and update or unpublish its published maps.

## Payment

Card payments go through Stripe, spoken to directly over its API (no SDK).

1. **Set up Stripe.** In Stripe, create a product ("Mossline organisation plan") with a yearly recurring price of £49. Turn on the customer portal (Settings → Billing → Customer portal), allowing cancellation and invoice history.
2. **Add the webhook.** Point an endpoint at `<MOSSLINE_BASE_URL>/api/billing/webhook` with these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. **Set the variables:**
   - `MOSSLINE_PLANS_ENABLED=true`
   - `MOSSLINE_STRIPE_SECRET_KEY` (a restricted key with Checkout, Billing portal, Customers and Subscriptions write access is enough)
   - `MOSSLINE_STRIPE_PRICE_ID`
   - `MOSSLINE_STRIPE_WEBHOOK_SECRET`
4. **Test first.** Use Stripe's test mode and the Stripe CLI (`stripe listen --forward-to …`) before switching to live keys.

How the plan follows the subscription:

- **Paid.** The plan runs to the end of the paid period. Renewals extend it.
- **Payment failing.** Two weeks' grace while Stripe retries.
- **Cancelled.** The plan runs until the end of what was paid for, then the free limits apply.
- **Duplicate events.** Each event is handled once (`mossline_billing_events`). An event that fails part-way is forgotten, so Stripe's retry is handled.

**Invoices.** For organisations paying by invoice, an operator (listed in `MOSSLINE_ADMINS`) opens `/admin` and puts the organisation on the plan, with or without an end date. The same page lists published maps and can take one down after a report under the acceptable use policy.

**VAT.** Set `MOSSLINE_OPERATOR_VAT_NUMBER` once registered; the terms then say prices exclude VAT. In Stripe, turn on Stripe Tax or add tax rates at the same time. While unregistered, the terms say no VAT is charged.

## Database

Run `npm run db:migrate` with `MOSSLINE_DATABASE_URL` set, on every deployment, whichever features it uses. It applies the files in `apps/web/migrations` that haven't run yet, in order, and records each one in `mossline_migrations`. `npm run db:migrate -- --check` lists what's pending, and exits with an error if anything is. Never edit a migration that has run: add a new one.
