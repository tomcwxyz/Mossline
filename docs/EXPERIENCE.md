# Mossline alpha 2.5 — entry and exploration

## One clear journey

**Start → Explore → Go deeper.**

Opening Mossline now shows a lightweight selection screen rather than a long dashboard
of every available feature. People can reopen an existing browser-local map, import a
general CSV/Kumu file, create a funding landscape or open an illustrative example.

A map opens in one primary network workspace. Its three views remain Network
(Landscape), Connections (Collaborations) and UK Atlas. The node inspector sits
beside the map. Search, region and recorded entity-type controls remain easily
available for regular maps; saved perspectives, styling, share/publish and path
tracing are discoverable expandable tools rather than permanent competing panels.
Additional analysis appears below the network in a closed disclosure.

Funding datasets with complete indexed records now open the **whole-network
explorer in the main canvas**. The initial 75-grant projection is retained only
for legacy advanced workflows, not positioned as the complete funding map.
The full funding view explicitly suppresses generic controls that apply only
to the detailed selection.

## Design principles

- Start with the task, not the technology or funding-specific terminology.
- Keep the map front and centre; provide context and evidence on demand.
- Make the same route work with generic organisations, people, projects and places.
- Preserve advanced features and their saved data without demanding that new users
  understand them during onboarding.
- Make browser-local persistence and portability limitations explicit.
- Prefer actions that preserve the current map; destructive imports require review.

## Acceptance checks still needed

- [ ] New browser → open fictional network → see a usable graph.
- [ ] CSV → discovery → mapping → create map → main workspace.
- [ ] Funding CSV → complete dataset → main whole-network overview; no
      misleading 75-grant counts on primary canvas.
- [ ] Existing saved maps load correctly from local browser storage.
- [ ] Save/reopen a perspective, follow a connection, configure artwork, share
      and publish from the expandable advanced tools.
- [ ] Back up a map and its complete indexed funding data via /recover.
- [ ] Narrow viewport and keyboard-only first-run and workspace navigation.
- [ ] Compare UI with real users; simplify the sidebar further where necessary.

## Important technical boundary

This refactor rearranges the existing React interface. It does not replace
Cytoscape/Canvas rendering with Sigma/WebGL, stream generic data imports,
add server-side workspaces or change database migrations. These are separate
planned improvements. Do not claim untested browser performance or a complete
production UX acceptance.
