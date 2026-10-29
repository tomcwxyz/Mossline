# Running a public Mossline

What the operator of a hosted Mossline (one that takes sign-ups or payments) needs in place, and how to handle the things that come up. The policies themselves are pages in the app, under `/legal`; their text is in `apps/web/src/content/legal/` and is filled in from the settings below.

**These policies are a solid starting point, not legal advice.** Have them read by someone qualified before taking payments, and again when the service changes.

## Before launch

### Who you are

These fill in the policies. Anything unset shows on the page as a visible blank, never as a guess.

| Setting | Example |
| --- | --- |
| `MOSSLINE_OPERATOR_NAME` | The Good Ship |
| `MOSSLINE_OPERATOR_LEGAL_NAME` | Your legal name, or the registered company name |
| `MOSSLINE_OPERATOR_ADDRESS` | A postal address for notices and complaints |
| `MOSSLINE_OPERATOR_EMAIL` | The address people write to about privacy, complaints, reports and billing |
| `MOSSLINE_OPERATOR_COMPANY_NUMBER` | If a company |
| `MOSSLINE_OPERATOR_ICO_NUMBER` | Once registered (below) |
| `MOSSLINE_OPERATOR_VAT_NUMBER` | Only once registered for VAT |

### Who else handles data

The sub-processors page reads these. Use the providers' legal entity names and where the data is held.

| Setting | Example |
| --- | --- |
| `MOSSLINE_HOSTING_PROVIDER` | Vercel Inc. |
| `MOSSLINE_DATABASE_PROVIDER` | Neon Inc. (Databricks) |
| `MOSSLINE_DATA_REGION` | Your database region, e.g. "London, UK" or "Frankfurt, EU" |
| `MOSSLINE_EMAIL_PROVIDER` | Whoever sends mail through `MOSSLINE_SMTP_URL` |

### Checklist

- [ ] **Register with the ICO** and pay the data protection fee. Most sole traders and micro organisations are tier 1: £52 a year, or £47 by direct debit (rates checked July 2026). Then set `MOSSLINE_OPERATOR_ICO_NUMBER`.
- [ ] **Choose a database region**, UK or EU if you can, and set its backup retention to 30 days or less. The privacy notice and data processing agreement say backups expire within 30 days.
- [ ] **Sign data processing terms with each provider.** Vercel, Neon, Stripe and the major email providers include them in their standard terms. Keep a copy of each.
- [ ] **Limit access to the production database** to named people, each with their own account and two-factor sign-in. The data processing agreement promises this.
- [ ] **Write a short data protection impact assessment.** Organisations' maps can name many people, so it's worth recording the risks and the safeguards (most of them are already in `docs/HOSTED_PUBLISHING.md` and `docs/SHARED_MAPS.md`).
- [ ] **Keep a record of processing.** The privacy notice's table is most of it.
- [ ] **Test payments end to end** in Stripe's test mode (`docs/PLANS.md`).
- [ ] **Run the database migrations** with `npm run db:migrate`, and schedule housekeeping (below).
- [ ] **Set up the health check and alerts** (below).
- [ ] **Have the policies reviewed.** Then set `TERMS_VERSION` in `apps/web/src/lib/legal.ts` to the date they take effect.

## Handling things

### Complaints about data protection

Required from 19 June 2026 under the Data (Use and Access) Act 2025. Accept complaints however they arrive: email, post or social media.

- **Within 30 days:** acknowledge the complaint. The clock starts the day after it arrives.
- **Without undue delay:** look into it, in proportion to the complaint, and keep the person told about progress and any delay.
- **At the end:** tell them the outcome. Remind them they can go to the ICO.

Keep a simple log: date received, acknowledged, what was done, outcome.

### Requests about someone's own information

Access, correction, deletion and objection requests get a reply within one month. Most people can help themselves on **Your account**:

- downloading everything held about them;
- changing their name or email address;
- unpublishing and deleting maps;
- deleting the account.

Someone named *in* someone else's map: pass the request to the map's owner or organisation. You process those maps for them under the data processing agreement, and you help them respond.

### Reports about published maps

Follow `/legal/acceptable-use`:

1. Acknowledge the report within two working days.
2. Take the map down straight away if it's clearly unlawful or puts someone at risk (**/admin → Take down**).
3. Otherwise contact the publisher first.
4. Tell both sides the outcome.

### Breaches

If personal data is lost, exposed or changed without permission:

- **Contain it.** For example, rotate `MOSSLINE_AUTH_SECRET` to sign everyone out, or revoke keys. Someone worried about their own account can use **Sign out everywhere**.
- **Tell the ICO within 72 hours** unless it's unlikely to put anyone at risk.
- **Tell the people affected** if it's likely to put them at high risk.
- **Tell affected organisations' admins within 48 hours**, as the data processing agreement promises.

Record every breach, even ones you don't report.

### Changing a provider

Email every organisation's admins at least 30 days before adding or replacing a sub-processor, then update the settings above.

### Changing the policies

- **Changes that matter:** email people at least 30 days before they apply, and bump `TERMS_VERSION`.
- **Price changes:** tell paying organisations at least 30 days before their renewal.

### Keeping to the retention promises

`/api/cron/housekeeping` does this every day once scheduled:

- clears expired sessions, sign-in links, email-change links and rate-limit records;
- forgets payment events after 90 days;
- emails accounts unused for three years, then deletes them 30 days later if they still haven't signed in.

What they made for an organisation passes to another of its admins. Without email set up, nobody can be warned, so nobody is deleted.

**Schedule it.** Set `MOSSLINE_CRON_SECRET` (or Vercel's `CRON_SECRET`) to a long random value, then either:

- **on Vercel,** add a cron job for `/api/cron/housekeeping`, e.g. daily at 03:17. Vercel sends the secret itself;
- **anywhere else,** run daily: `curl -fsS -H "Authorization: Bearer $MOSSLINE_CRON_SECRET" https://<site>/api/cron/housekeeping`.

By hand:

- [ ] **Each year:** delete support emails more than two years after the conversation ended.
- [ ] **Keep payment records for six years**, for HMRC. Stripe keeps its own copy.

## Watching it

- **Health check.** Point an uptime monitor at `/api/health`. It returns 200 when Mossline can reach its database and the migrations are up to date, and 503 otherwise.
- **Alerts.** Set `MOSSLINE_ALERT_WEBHOOK` to a Slack, Discord or ntfy webhook to hear about server errors: failed payments handling, database trouble, housekeeping failures. At most one alert per kind of failure every ten minutes. Errors are also written to the server log as one JSON line each.
- **Restoring from a backup.** Rehearse it once before launch and once a year:
  1. Restore yesterday's backup into a new branch or database.
  2. Point a preview deployment at it.
  3. Sign in and open a shared map.
  4. Note how long it took.

  The privacy notice promises backups, so check they actually come back.

## Releasing a new version

1. Run `npm run db:migrate` against the live database **before** the new code goes live. Migrations only add things, so the old code keeps working meanwhile.
2. Deploy.
3. Check `/api/health`.

## VAT

You must register once taxable turnover passes £90,000 in any rolling 12 months; it's £90,000 in 2026. Until then the terms say no VAT is charged. Selling to organisations in other countries, and especially to individuals in the EU, has its own rules: check with an accountant before selling abroad at any volume.
