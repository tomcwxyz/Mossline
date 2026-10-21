# Browser backup and recovery — Alpha 2.4

Mossline's maps and complete funding imports use **separate browser stores**.
The app has no user accounts or server-side recovery for these local sources.
The read-only public sharing/publishing features are *not* backups.

## Create a complete local backup

Visit `/recover`. You do **not** need to open the map canvas.

1. Select **Download map-library backup** to save your named maps, selected
   network projections and their IDs from localStorage.
2. Select **Download all full funding datasets** to save the complete
   organisation-only funding graph(s) stored in IndexedDB.
3. Check that **both** files exist and store them securely. They may contain
   confidential organisational information, even when public sharing has
   stripped source properties.

The two files must be kept together. If you have only ordinary maps and no
large funding imports, the second file is not needed. The legacy map key is
preserved in the first backup when present.

## Recover on the same or a new browser

1. Open `/recover`, then use **Restore funding backup** to import the complete
   dataset(s). Dataset IDs are preserved so map references remain valid.
2. Use **Restore map-library backup** to restore maps and selected views.
   **This replaces the receiving browser's map-library data**, so export its
   maps before proceeding. It does not replace separately stored datasets.
3. Return to the Mossline studio and confirm that the funding explorer can
   retrieve awards outside the initial 75-grant canvas selection.

Funding dataset import is deliberately **add-only and atomic**. If a restored
dataset ID already exists, no datasets from that import are written. Back up
and explicitly remove unwanted unreferenced datasets before retrying. No
automatic destructive merge is attempted.

## Removing damaged or unwanted maps

The recovery page deliberately avoids mounting Cytoscape or the map studio.
Maps are inspected in a background worker. You can remove one map and retain
others or clear the map library after acknowledging that you have downloaded
and checked its backup. Removing a map does not automatically delete any
IndexedDB dataset it referenced. The dataset recovery panel allows explicit
deletion of unreferenced datasets, but blocks deletion when a saved map
references one or when saved maps could not be inspected.

## Important limits

- Complete funding backup/export is JSON and is **not streaming**. Very large
  collections may exceed browser memory; import files have a 256 MB backup
  restore limit. The underlying CSV importer itself is currently capped at
  60 MB and is not yet an incremental/streaming importer.
- Existing older maps created before Alpha 2.3 may have a reduced graph but no
  IndexedDB dataset: they need re-importing from their source CSV to enable
  complete funding exploration.
- Local storage, browser clearing, incognito mode, device loss or another
  browser profile can still remove local data. Regular offline exports are
  essential.
- Backups are not encrypted, anonymised or cleared for public sharing.
- This feature does not touch hosted publications or a Neon database.
- Saved perspectives and artwork metadata currently have separate browser
  storage; they are **not yet included** in these two recovery downloads.
  Complete workspace portability remains future work.
