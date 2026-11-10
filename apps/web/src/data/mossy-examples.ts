/** Fictional, curated examples. All names, figures and relationships are invented. */
export const MOSSY_EXAMPLES = [
  {
    "id": "village-web",
    "title": "The Village Web",
    "tag": "Connections",
    "subtitle": "A small place with a surprisingly large network of care.",
    "focus": "Who holds a community together?",
    "lens": "network",
    "colour": "sage",
    "url": "/examples/village-web.json"
  },
  {
    "id": "follow-the-money",
    "title": "Follow the Money",
    "tag": "Funding",
    "subtitle": "Grants across organisations, places and changing priorities.",
    "focus": "Who gets funded, and what gets missed?",
    "lens": "funding",
    "colour": "ochre",
    "url": "/examples/follow-the-money.json"
  },
  {
    "id": "after-dark",
    "title": "After Dark",
    "tag": "Places",
    "subtitle": "A fictional city's venues, artists and creative collaborations.",
    "focus": "Where does a city's creative energy gather?",
    "lens": "map",
    "colour": "cobalt",
    "url": "/examples/after-dark.json"
  },
  {
    "id": "the-ripple-effect",
    "title": "The Ripple Effect",
    "tag": "Systems",
    "subtitle": "A neighbourhood's housing, health and transport feedback loops.",
    "focus": "What changes when one thing changes?",
    "lens": "network",
    "colour": "rust",
    "url": "/examples/the-ripple-effect.json"
  },
  {
    "id": "changing-tides",
    "title": "Changing Tides",
    "tag": "Time",
    "subtitle": "How community services shift, close and reappear over a decade.",
    "focus": "How does a place change over time?",
    "lens": "timeline",
    "colour": "sea",
    "url": "/examples/changing-tides.json"
  }
] as const;
export type MossyExampleId = typeof MOSSY_EXAMPLES[number]["id"];
export function isMossyExample(value:string):value is MossyExampleId{return MOSSY_EXAMPLES.some(item=>item.id===value);}
