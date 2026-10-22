/** Browser storage identifiers shared by the Mossline web UI.
 * These are persisted formats, not configuration defaults: changing a string
 * without an explicit migration would orphan someone's saved work.
 *
 * The map-library and legacy graph keys have their canonical definitions in
 * graph-core because the recovery worker also needs them.
 */
export {MAP_LIBRARY_STORAGE_KEY,LEGACY_GRAPH_STORAGE_KEY}
  from "@mossline/graph-core";

export const PERSPECTIVES_STORAGE_KEY="mossline-perspectives-v1";
export const ARTWORK_STORAGE_KEY="mossline-artwork-library-v1";
export const MAPPING_RECIPES_STORAGE_KEY="mossline-mapping-recipes-v1";
