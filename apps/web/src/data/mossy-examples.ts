/** Five curated fictional datasets, each opening a distinct real Mossy lens. */
export const MOSSY_EXAMPLES = [
  {
    "id": "after-dark",
    "title": "After Dark",
    "tag": "Geography",
    "lensLabel": "Map",
    "subtitle": "A fictional creative scene spread across real northern cities.",
    "focus": "Where are the cultural hotspots — and who connects them?",
    "lens": "map",
    "colour": "cobalt",
    "facts": "122 mapped venues · 146 recorded links",
    "url": "/examples/after-dark.json"
  },
  {
    "id": "village-web",
    "title": "The Village Web",
    "tag": "Connections",
    "lensLabel": "Network",
    "subtitle": "An imaginary valley's people, projects and organisations.",
    "focus": "Which relationships hold a community together?",
    "lens": "network",
    "colour": "sage",
    "facts": "97 records · 207 recorded links",
    "url": "/examples/village-web.json"
  },
  {
    "id": "the-ripple-effect",
    "title": "Common Threads",
    "tag": "Themes",
    "lensLabel": "Themes",
    "subtitle": "Discover the overlap between different kinds of local work.",
    "focus": "Where do housing, culture, health and climate work meet?",
    "lens": "themes",
    "colour": "rust",
    "facts": "8 themes · 200 records",
    "url": "/examples/the-ripple-effect.json"
  },
  {
    "id": "follow-the-money",
    "title": "Follow the Money",
    "tag": "Funding",
    "lensLabel": "Funding",
    "subtitle": "Nine years of invented grants, recipients and shifting priorities.",
    "focus": "Where does the money flow, and what changes over time?",
    "lens": "funding",
    "colour": "ochre",
    "facts": "520 grants · 12 funders",
    "url": "/examples/follow-the-money.json"
  },
  {
    "id": "changing-tides",
    "title": "Changing Tides",
    "tag": "Time",
    "lensLabel": "Timeline",
    "subtitle": "How a fictional coastal area's services evolve over a decade.",
    "focus": "What opened, expanded or disappeared — and when?",
    "lens": "timeline",
    "colour": "sea",
    "facts": "301 dated events · 13 years",
    "url": "/examples/changing-tides.json"
  }
] as const;
export type MossyExampleId = typeof MOSSY_EXAMPLES[number]["id"];
export function isMossyExample(value:string):value is MossyExampleId{return MOSSY_EXAMPLES.some(item=>item.id===value);}
