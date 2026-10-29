/** Cookies and browser storage. Placeholders are filled from the operator's settings (lib/legal.ts). */
export default `
*Last updated {{updated}}*

Mossline uses only what it needs to work. There are no analytics, advertising or tracking cookies, so there's nothing to accept or turn off.

## Cookies

| Name | What it's for | How long |
| --- | --- | --- |
| \`mossline.session_token\` | Keeps you signed in, if you sign in | 30 days, or until you sign out |
| \`mossline.state\` and similar short-lived \`mossline.*\` cookies | Make sure a Microsoft or Google sign-in finishes where it started | A few minutes |

You only get these cookies if you sign in. They're strictly necessary for the service you've asked for, so the law doesn't require consent for them.

## Your browser's own storage

Mossline keeps the maps you work on in your browser's local storage and IndexedDB, on your device. These are never sent to us unless you publish a map or save it to your account. Your browser storage holds:

- your maps, their changes and your reviews;
- your saved views;
- your stories, with their pictures;
- your choice of day or night colours;
- the name you put on changes.

You can clear all of this by clearing site data for {{site}} in your browser settings. Export anything you want to keep first.

## Payments

If you pay by card, you do so on our payment provider Stripe's own pages, which set their own cookies for security and fraud prevention. See [Stripe's cookie policy](https://stripe.com/cookies-policy/legal).
`;
