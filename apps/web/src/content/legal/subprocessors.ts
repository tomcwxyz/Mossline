/** Sub-processors. Placeholders are filled from the operator's settings (lib/legal.ts). */
export default `
*Last updated {{updated}}*

These are the providers that handle personal information so we can run Mossline. Organisations are told by email at least 30 days before we add or replace one (see the [data processing agreement](/legal/data-processing)).

| Provider | What they do | Where |
| --- | --- | --- |
| {{hosting}} | Hosts the Mossline service | See their terms; transfers safeguarded as below |
| {{database}} | Stores accounts, published and shared maps, and backups | {{region}} |
| {{email_provider}} | Sends sign-in links and invitations | See their terms |
| Stripe Payments UK Ltd and Stripe, Inc. | Takes card payments and handles billing for the organisation plan | UK, EU and USA |

**Only if you choose them:**

| Provider | When | What they receive |
| --- | --- | --- |
| Microsoft | You sign in with Microsoft | Microsoft confirms your name and email address to us. Microsoft acts for itself, not for us |
| Google | You sign in with Google | As for Microsoft |
| postcodes.io (Ideal Postcodes) | You agree to look up postcodes when adding data | The postcodes only, sent from your browser |

Where a provider processes information outside the UK, we rely on:

- UK adequacy regulations, including the UK Extension to the EU–US Data Privacy Framework for certified US providers; or
- the Information Commissioner's International Data Transfer Agreement or Addendum.
`;
