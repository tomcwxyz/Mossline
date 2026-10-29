# Shared maps

**Status: off by default.** With shared maps on, someone can save a map to
their account, open it on any device, and invite people to work on it with
them. Maps nobody saves stay in the browser, exactly as before.

Shared maps need hosted publishing and accounts set up first
([HOSTED_PUBLISHING.md](HOSTED_PUBLISHING.md)), then:

1. Apply `apps/web/migrations/20261029_shared_maps.sql` by hand.
2. Set `MOSSLINE_SHARED_MAPS_ENABLED=true`.

## What it does

- **Save to your account** (atlas: map menu → *Save to your account…*). Only
  people on `MOSSLINE_PUBLISHERS` can. Mossline says exactly what is copied
  and asks the person to confirm they're allowed to keep it on the server.
- **Invite people** by email, to view and edit, or view only. An invitation
  lets that address sign in, even if it isn't on the publishers list; invited
  people can't publish, save maps of their own or invite others. When the
  deployment can send email, the invitation goes by email; otherwise the owner
  copies the link (`/?map=<id>`) and sends it.
- **Work together.** Each change (a record, a link, a new value) goes to the
  server as it's made and reaches everyone else within about ten seconds,
  sooner when they come back to the tab. Undo and redo reach everyone too. The
  server stamps each change with the account that made it and the time, so
  the change list and receipts say who really did what.
- **Add data.** Adding data to a shared map replaces its imported records for
  everyone; their changes stay, applied over the new records. If someone else
  added data first, Mossline says so rather than overwrite theirs. People
  with the map open are told and can pull the new data in.
- **Offline.** Each browser keeps a copy of the map and its changes. Changes
  made offline are sent when Mossline can be reached again.
- **Stop sharing** (owner) deletes the map from the server, with everyone's
  access. **Leave** (member) removes you. Either way, copies in browsers stay,
  with the changes they had.

## How it's stored

| Table | Holds |
| --- | --- |
| `mossline_maps` | The imported records, one gzip-compressed JSON document per map; title; counts; source version |
| `mossline_map_members` | Invited email addresses and their role |
| `mossline_map_edits` | Every change, one row each, in the order the server received them; undone or not |

Changes are never written into the imported records (AGENTS.md rule 9). Every
browser applies the same changes in the server's order, so everyone's map
comes out the same. Two people changing the same value at the same moment:
the one the server received last wins, and both changes stay in the list with
their names, so either can be undone.

**Deleting an account** deletes the maps it owns (with their changes and
invitations) and its invitations to other people's maps. Changes it made to
other people's maps stay in those maps, with the name they were made under.

## Limits

- One upload, compressed, up to 4 MB (about what a serverless request can
  carry). Maps compress well: tens of thousands of records fit. A bigger map
  is refused with its size, and stays in the browser.
- A large funding dataset is shared as its complete records; it opens on
  other devices as an ordinary map, without the funding workbench's analysis.
- Reviews (confirmed suggestions) and saved views are not shared yet; they
  stay in each browser.
- Changes arrive by polling every ten seconds, not instantly.

## Plans and policies

Where plans are on, the free and organisation limits apply here too: see [PLANS.md](PLANS.md). Running a public Mossline: [OPERATING.md](OPERATING.md).
