/** Data processing agreement (UK GDPR Article 28). Placeholders are filled from the operator's settings (lib/legal.ts). */
export default `
*Last updated {{updated}}*

This agreement applies when an organisation (the **controller**, "you") uses Mossline at {{site}}, provided by {{legal}} (the **processor**, "we"), to keep or publish information about people. It forms part of the [terms of service](/legal/terms). If the two conflict on how personal data is handled, this agreement wins.

If your organisation needs a signed copy, email {{email}}.

## 1. What we process

| | |
| --- | --- |
| **Subject matter** | Personal data in maps your organisation keeps, shares or publishes in Mossline, and in the changes people make to them |
| **Duration** | For as long as your organisation uses Mossline, then until deletion under section 9 |
| **Nature and purpose** | Storing, showing, syncing and publishing maps for your organisation and the people it shares them with; backups; keeping the service secure |
| **Types of personal data** | Whatever your organisation puts in maps, typically names, roles, contact details, organisations people are connected to, places, and notes. Also the names and email addresses of people in your organisation and those it shares maps with |
| **Categories of people** | People and contacts at organisations named in your maps; people in your organisation; people your maps are shared with |
| **Special category data** | Not expected. If you put it in, you're responsible for having a lawful basis and condition for it, and you mustn't publish it |

## 2. Your instructions

We process your personal data only on your documented instructions, unless UK law requires otherwise; if it does, we'll tell you first unless the law forbids it. Your instructions are:

- these terms;
- what your organisation's people do in Mossline, such as saving, sharing, publishing and deleting;
- anything else you agree with us in writing.

We'll tell you if we think an instruction breaks data protection law.

## 3. Confidentiality

Everyone we allow to process your data is bound by a duty of confidence.

## 4. Security

We take appropriate technical and organisational measures, set out in the annex, to keep your data secure.

## 5. Sub-processors

You give general authorisation for the providers listed on [who else handles data](/legal/subprocessors). We'll tell your organisation's admins by email at least 30 days before adding or replacing one, so you can object. If you object on reasonable data protection grounds and we can't resolve it, you can end the agreement and we'll refund the unused part of the year.

We put data protection terms with each sub-processor that are at least as protective as these, and we remain responsible to you for them.

## 6. Helping you with people's rights

Most requests you can handle yourself in Mossline: finding, correcting, exporting and deleting records and maps. Where you can't, we'll help you respond to requests from people exercising their data protection rights, taking into account the nature of the processing.

## 7. Helping you with security, breaches and assessments

We'll help you meet your obligations on security, breach notification, data protection impact assessments and consulting the Information Commissioner, taking into account the nature of the processing and the information we have.

If we become aware of a personal data breach affecting your data, we'll tell your organisation's admins without undue delay, and within 48 hours. We'll say what we know, what we're doing, and update you as we learn more.

## 8. International transfers

We transfer personal data outside the UK only as set out on [who else handles data](/legal/subprocessors), and only with the safeguards UK law requires.

## 9. At the end

When your organisation stops using Mossline, you can export its maps first. On your request, or 30 days after the organisation is closed, we'll delete the personal data we hold for you, unless UK law requires us to keep it. Backups expire within a further 30 days.

## 10. Showing compliance

We'll make available the information you reasonably need to show we meet Article 28 of the UK GDPR, and allow for and contribute to audits, including inspections, by you or an auditor you appoint. This is limited to once a year unless a breach or a regulator requires more. You give reasonable notice, and you cover your own costs.

## Annex: security measures

- **Collecting little.** We collect as little as possible. Accounts hold a name and email address only. We don't keep passwords, sign-in providers' access tokens, profile photos, or network addresses and browser details on sessions.
- **Encryption.** Connections to Mossline use HTTPS (TLS). Data is encrypted at rest by our database and hosting providers.
- **Sign-in.** One-time sign-in links are stored scrambled and expire after 10 minutes. Sessions expire after 30 days. Sign-in attempts are rate-limited.
- **Access.** Every request checks the signed-in account and its role on the map or organisation. Changes are accepted only from Mossline's own pages.
- **Changes.** People's changes to a map are kept as a separate list beside the original records, each with who made it and when, so they can be traced and undone.
- **People with access.** Only our named people can reach the production database, with individual accounts and strong authentication.
- **Backups.** Our database provider takes backups, kept for up to 30 days.
- **Software.** Mossline's code is open for review. Changes are checked by automated tests before release, and we keep our dependencies up to date.
`;
