# Mossline model-assisted funding discovery

## Where this fits

Alpha 2 is a **human-reviewed candidate finder**, not an automatic grant
ontology or an AI claiming to discover verified partnerships. The ordinary
funding import, explicit source-theme matching and phrase rules work entirely
in the browser and need no model or account.

The optional remote stages are:
1. An OpenAI-compatible `POST /v1/embeddings` endpoint returning `data`
   records with `index` and numeric `embedding`.
2. An optional OpenAI-compatible `POST /v1/chat/completions` text-model
   endpoint for explaining *one selected pair*, grounded solely in their
   two supplied grant excerpts.

All provider URLs are controlled by **server-only** configuration.
No client can choose or override the provider destination, model or API key.

## Environment settings (server-only)

- `MOSSLINE_DISCOVERY_BASE_URL`: HTTPS OpenAI-compatible base URL,
  for example `https://api.openai.com/v1`. For Ollama, use a
  TLS-protected remote Ollama service exposing its OpenAI-compatible
  `/v1` endpoint. Vercel cannot call your laptop's localhost.
- `MOSSLINE_DISCOVERY_EMBEDDING_MODEL`: a model identifier that the configured
  provider actually serves, with vector embeddings enabled.
- `MOSSLINE_DISCOVERY_CHAT_MODEL`: optional chat/completions model;
  leave unset to disable LLM explanation.
- `MOSSLINE_DISCOVERY_API_KEY`: the provider's server-side credential.
- `MOSSLINE_DISCOVERY_ACCESS_KEY`: independent, random key of at least
  32 characters. Only approved testers should receive it.

No deployment change or Neon migration is needed to release the
**local** reviewer. The remote model features remain off until these values
are set in the Vercel Production environment and the deployment is rebuilt.

Check `GET /api/discovery/status` for `embeddings` and `explanations`.
This endpoint reports *configuration*, not remote provider health.
The public reviewer works whether these flags are true or false.

## Consent and data minimisation

- Grant text is transmitted **only** after the author clicks the
  opt-in checkbox and explicitly chooses to run semantic discovery.
- A maximum of 48 grant snippets, each at most 850 characters, is submitted
  per invocation. Grants with uninformative text are excluded; source rows
  marked non-public were already excluded by the funding importer.
- Only grant identifier and cleaned title, description, theme and programme
  text is transmitted. No database, source record properties, grant amounts
  or organisation contacts. This is not a DLP guarantee: titles and
  descriptions themselves can contain sensitive personal information.
- Operators should publish an appropriate data-use notice and avoid
  submitting private/confidential information to external providers.
- Credentials live in React component state only, not localStorage or
  public URLs. The server validates and bounds bodies, keeps endpoint
  configuration fixed and denies calls without the strong access key.
- Returned vectors are used only for **temporary browser-side ranking**;
  they are not stored by Mossline's server or in the original graph.
- No automatic graph mutation, publication or adjudication. A recorded
  funding link remains distinct from suggested thematic association.

## Interpretation and limitations

Cosine similarity is **not calibrated confidence** or a partnership
probability. The initial 0.67 threshold is an explicit provisional
ranking gate, not a recommendation that these organisations collaborate.
Generic programme boilerplate, text duplication, poor record quality,
missing descriptions and bias in training data can all distort matches.

The LLM summariser is asked to cite both grant identifiers and highlight an
uncertainty. Its output should still be checked against the two source
excerpts. We do not treat source text as prompt instructions or add AI
claims to the graph.

A valid model service may support a different protocol or dimensions; the
adapter deliberately rejects incompatible payloads rather than quietly
assigning vectors to the wrong grant records. Embedding indices are
verified before local ranking.

## Production alpha smoke test

1. Keep model env vars unset first. Confirm status returns
   `embeddings:false`; import the synthetic funding CSV and review local
   candidates without the network.
2. Configure an approved **test** provider and access key, redeploy, then
   confirm status says embeddings enabled.
3. Tick consent, supply the access key and send the synthetic dataset.
   Check model name, grant identity alignment and evidence display.
4. Mark a pair worth exploring, dismiss another, reload, and verify review
   state survives **without** creating any graph edge. Export the shortlist.
5. Run one grounded LLM explanation (if configured). Confirm the text is
   distinguishable from a recorded relationship.
6. Verify wrong access key, oversize uploads, invalid embeddings, provider
   outage and malformed responses fail safely.
7. For a public self-service tool, add per-user usage quotas/authentication,
   budget alarms, audit logging and consent records before allowing
   unrestricted AI calls. The access code is for a small alpha cohort only.
