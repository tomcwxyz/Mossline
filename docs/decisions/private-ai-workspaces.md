# Decision: local-first discovery, opt-in private hosted analysis

**Status:** Accepted design direction; hosted dataset storage not yet implemented  
**Scope:** Mossline network intelligence, dataset ownership, embeddings and reviewable hypotheses

## Decision

Do not require people to upload source data before exploring a graph or seeing
deterministic, source-derived signals. Keep import preview, map views, search,
source links, recorded connectivity, coverage and basic grouping local.

For durable, repeatable, expensive **AI analysis**, introduce an explicit
**Save privately & analyse** action to an authenticated workspace. This will
be the recommended route for larger networks and collaborative use. It must
be independent of the existing **Publish online** feature.

Existing browser-local, explicitly consented AI indexing remains an alpha
experiment rather than the assumed long-term production architecture.
Never silently upload a dataset or enable third-party model processing.

## Why

- Browser IndexedDB already stores complete imported networks and optional
  embedding batches, but that is **on this device**, not a multi-user server DB.
- A 5,876-entity dataset generates approximately 123 embedding requests at
  batch size 48. The observed free-tier DeepInfra model limit of five requests
  per minute cannot be solved by a database alone.
- A hosted job queue can pace requests and resume work even when the browser
  closes; dataset and version identities prevent stale suggestions from
  contaminating new imports.
- The current Neon table `mossline_publications` stores a small, stripped
  public snapshot; it cannot become the private analysis store. Public URLs
  and secret publication-management keys are not private workspace auth.

## User-facing flow

1. **Open or import**: local preview and consented mapping. No account or
   upload required.
2. **Explore**: source-backed signals, recorded connections, filters and graph
   layout work immediately, including offline.
3. **Save privately & analyse** (opt-in): authenticated workspace, data rights
   notice, explicit upload review, sensitive-field exclusion policy, provider
   consent and approximate cost/time limits.
4. **Analysis runs independently**: jobs index changed source descriptions,
   group themes, find candidate similarities and draft explainable highlights.
   Rate limits pause the job, not the person's graph interface.
5. **Review insights**: save for investigation, dismiss or annotate. No
   AI-suggested edge becomes a recorded relationship without an explicit,
   separate user-authored action and an attached evidence record.
6. **Present**: original graph, source-derived groupings and optional candidate
   overlays are visually and semantically distinct. Public publishing remains
   separate and additional.

For personal, deliberately temporary experiments, offer **Analyse in this
browser** behind its existing explicit consent and provider allowance,
without pretending work will survive a closed tab.

## Proposed private data model (not yet migrated)

- `workspaces`: owner/organisation, members, roles, lifecycle.
- `datasets`: workspace ID, title, owner, status, creation and deletion data.
- `dataset_versions`: immutable canonical graph snapshot or object-store
  pointer, content digest, import method, counts, uploader and timestamp.
- `analysis_runs`: workspace/version, approved model, prompt/algorithm
  version, status, cost accounting, consent version, progress, errors and
  retry-after window.
- `analysis_batches`: run, deterministic source range/hash, attempt count,
  provider rate limit window, vector references and completed status.
- `semantic_vectors`: version, source ID, model name/dimensions, content
  digest, embedding vector; reuse only when content + model match.
- `insight_candidates`: source version, type, source entity/edge IDs,
  evidence references, methodology, score where meaningful, review status.
- `insight_reviews`: workspace member, candidate, decision, timestamp,
  optional comments and provenance; kept outside canonical graph edges.
- `saved_perspectives`: reviewed display choices, thematic focus and
  candidate overlay settings, without rewrites of source records.

Use Neon Postgres, with pgvector if benchmarking supports query/index needs.
Store large raw files in private object storage if better than JSONB. Vector
indices and model migrations must be version-scoped. Model outputs are
untrusted data and must not be rendered as HTML or executed.

## Non-negotiable security boundaries

- Implement real accounts and workspace membership enforcement **before**
  permitting private dataset uploads or exposing private hosted analysis.
  Never use Vercel Preview protection or publication-management keys as a
  substitute for per-workspace authentication.
- Every dataset, run, batch, vector and insight read/write must verify
  ownership and scope, including background workers; test cross-tenant denial.
- Capture explicit, revocable permission to send chosen data to a provider;
  default to sending only bounded approved descriptions, not arbitrary CSV
  columns, contact details or all database fields.
- Do not infer that a record is public because its privacy flag is absent.
  Private analysis and public publishing have different allowed fields.
- API rate limits, tenant cost caps, queues, retry windows, audit trails and
  cancellation/deletion are required before multi-user AI is enabled.
- Deletion must remove original private graph, derived vectors, candidate
  insights and related cached data within a published retention policy.
- Export the canonical graph and review history; use stable source IDs and
  immutable dataset-version digests.

## Release sequence

1. **Alpha (under way)**: local signals and optional browser-based indexing;
   cache/retry recovery; version-bound local save/dismiss review.
2. **Next**: clear candidate-overlay styling and review controls on the graph,
   without editing renderer internals in the current concurrent WebGL branch.
3. **Hosted foundation**: workspace accounts/roles, private dataset upload,
   versioned immutable snapshots, retention and access tests. No automatic
   external AI requests on upload.
4. **Hosted analysis**: background job queue, rate-limit aware scheduler,
   incremental embedding and provenance-rich recommendations; monitor costs.
5. **Collaborative interpretation**: shared review queue, annotation audit,
   comparison of interpretations and a clear manual evidence acceptance flow.

## Explicitly rejected for now

- Forcing account signup or server upload just to view an imported network.
- Reusing public publication snapshots as private datasets.
- Treating a semantic similarity score or language-model answer as a graph
  relationship.
- Uploading automatically because an AI provider happens to be configured.
- Launching multi-user private AI features before scope and deletion controls.
