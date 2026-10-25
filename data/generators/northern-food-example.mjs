// Generates data/northern-food-example.json: a fictional network used as the
// Field Atlas worked example. Deterministic (seeded) and dependency-free.
//
//   node data/generators/northern-food-example.mjs
//
// Every organisation, project, funder, person and grant is invented. Town names
// and coordinates are real places, used only to position fictional records.
import fs from "node:fs";

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = mulberry32(7027);
const pick = a => a[Math.floor(r() * a.length)];
const gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const round4 = n => Math.round(n * 10000) / 10000;

const THEMES = ["Regenerative farming", "Farmer wellbeing", "Land access", "Community growing",
  "Food education", "Food justice", "Local supply chains"];
const PLACES = [
  ["Hexham", 54.971, -2.101, "North East"], ["Newcastle", 54.978, -1.617, "North East"],
  ["Durham", 54.776, -1.575, "North East"], ["Sunderland", 54.906, -1.381, "North East"],
  ["Middlesbrough", 54.574, -1.235, "North East"], ["Alnwick", 55.413, -1.706, "North East"],
  ["Carlisle", 54.892, -2.932, "North West"], ["Kendal", 54.328, -2.746, "North West"],
  ["Lancaster", 54.047, -2.801, "North West"], ["Manchester", 53.48, -2.242, "North West"],
  ["Liverpool", 53.408, -2.991, "North West"], ["York", 53.96, -1.087, "Yorkshire and the Humber"],
  ["Leeds", 53.8, -1.549, "Yorkshire and the Humber"], ["Sheffield", 53.381, -1.47, "Yorkshire and the Humber"],
  ["Hull", 53.745, -0.336, "Yorkshire and the Humber"], ["Skipton", 53.962, -2.017, "Yorkshire and the Humber"],
  ["Lincoln", 53.23, -0.54, "East Midlands"], ["Nottingham", 52.954, -1.158, "East Midlands"],
  ["Birmingham", 52.486, -1.89, "West Midlands"], ["Hereford", 52.056, -2.716, "West Midlands"],
  ["Norwich", 52.63, 1.297, "East of England"], ["Cambridge", 52.205, 0.122, "East of England"],
  ["London", 51.507, -0.128, "London"], ["Brighton", 50.822, -0.137, "South East"],
  ["Oxford", 51.752, -1.258, "South East"], ["Bristol", 51.455, -2.588, "South West"],
  ["Totnes", 50.432, -3.685, "South West"], ["Truro", 50.263, -5.051, "South West"],
  ["Cardiff", 51.481, -3.179, "Wales"], ["Machynlleth", 52.59, -3.851, "Wales"],
  ["Glasgow", 55.864, -4.252, "Scotland"], ["Edinburgh", 55.953, -3.188, "Scotland"],
  ["Dundee", 56.462, -2.971, "Scotland"], ["Inverness", 57.478, -4.224, "Scotland"],
  ["Belfast", 54.597, -5.93, "Northern Ireland"]
];
const PLACE_WEIGHT = { "North East": 5, "North West": 2.4, "Yorkshire and the Humber": 2.6, "Scotland": 1.6,
  "East Midlands": 1, "West Midlands": .9, "East of England": .8, "London": .9, "South East": .7,
  "South West": 1.1, "Wales": 1, "Northern Ireland": .5 };
const weightedPlace = () => {
  const total = PLACES.reduce((s, p) => s + PLACE_WEIGHT[p[3]], 0);
  let x = r() * total;
  for (const p of PLACES) { x -= PLACE_WEIGHT[p[3]]; if (x <= 0) return p; }
  return PLACES[0];
};
const PREFIX = ["Larkhope", "Fernside", "Coldwell", "Thornhope", "Rookhill", "Hazelgill", "Elderburn",
  "Brambleigh", "Ashholme", "Cragend", "Hartwick", "Sallowmere", "Heatherdale", "Birchside", "Wrenfield",
  "Moorgate", "Hollinbank", "Greystone", "Kestrel", "Willowburn", "Fallowfield", "Oakhurst", "Linthorpe",
  "Brackenside", "Mossgill", "Fellgate", "Tarnside", "Stonecroft", "Ravensdale", "Bilberry", "Copsewood",
  "Harebell", "Lapwing", "Curlew", "Teasel", "Yarrow", "Sorrel", "Burdock"];
const ORG_PATTERNS = {
  "Regenerative farming": ["{p} Farm", "{p} Soil Network", "{p} Grazing Co-op", "{p} Agroforestry"],
  "Farmer wellbeing": ["{p} Farmer Network", "{p} Rural Support", "{p} Farming Help"],
  "Land access": ["{p} Land Trust", "{p} Farm Start", "{p} Commons"],
  "Community growing": ["{p} Community Growers", "{p} Allotment Society", "{p} Orchard Group", "Grow {p}"],
  "Food education": ["{p} Kitchen School", "{p} Growing Schools", "{p} Cookery Club"],
  "Food justice": ["{p} Food Partnership", "{p} Pantry", "{p} Community Kitchen", "{p} Food Alliance"],
  "Local supply chains": ["{p} Veg Box Co-op", "{p} Food Hub", "{p} Market Collective", "{p} Mill"]
};
const ORG_DESCRIPTIONS = {
  "Regenerative farming": "A fictional farm-led group trialling practices that rebuild soil and biodiversity.",
  "Farmer wellbeing": "A fictional network offering peer support and practical help to farming families.",
  "Land access": "A fictional organisation helping new growers find secure, affordable land.",
  "Community growing": "A fictional volunteer-run group growing food together in shared spaces.",
  "Food education": "A fictional organisation teaching cooking and growing skills to children and adults.",
  "Food justice": "A fictional community organisation working on fair access to good food.",
  "Local supply chains": "A fictional enterprise shortening the route from local growers to local eaters."
};
const PROJECTS = {
  "Regenerative farming": ["Soil health pilot", "Mob grazing trial", "Hedgerow restoration", "Heritage grain trial", "Cover crop network", "Agroforestry demonstration"],
  "Farmer wellbeing": ["Peer support circles", "Farm succession clinic", "Rural isolation outreach", "Farmer mental health first aid"],
  "Land access": ["Land matching service", "Starter farm plots", "Community land purchase", "County farms campaign"],
  "Community growing": ["Community orchard", "Seed saving circle", "Estate growing beds", "Green prescribing garden"],
  "Food education": ["School kitchen gardens", "Cooking on a budget", "Farm visits for schools", "Youth food leaders"],
  "Food justice": ["Pay-as-you-feel café", "Community fridge", "Holiday food programme", "Food poverty mapping"],
  "Local supply chains": ["Fair veg box", "Shared food hub logistics", "Public sector local sourcing", "Micro-mill launch", "Market garden cluster"]
};
const FUNDERS = [
  ["Fellside Fund", "York", ["Local supply chains", "Land access", "Regenerative farming", "Community growing"]],
  ["Wren Foundation", "London", ["Food justice", "Food education"]],
  ["Coldwater Trust", "Newcastle", ["Community growing", "Food justice", "Farmer wellbeing"]],
  ["Hartmoor Foundation", "Edinburgh", ["Regenerative farming", "Farmer wellbeing"]],
  ["Sallowfield Trust", "Bristol", ["Land access", "Regenerative farming"]],
  ["Brackenbury Fund", "Manchester", ["Food justice", "Local supply chains"]],
  ["Greyhaven Trust", "Leeds", ["Food education", "Community growing"]],
  ["Common Furrow Fund", "Cardiff", ["Regenerative farming", "Land access", "Local supply chains"]],
  ["Northlight Foundation", "Durham", ["Farmer wellbeing", "Food justice", "Community growing"]]
];
const FIRST = ["Amira", "Ben", "Chloe", "Dev", "Ewan", "Fran", "Gita", "Hamish", "Iona", "Jas", "Kemi", "Lewis",
  "Maya", "Niall", "Orla", "Priya", "Rory", "Sana", "Tam", "Una", "Vik", "Wes", "Yara", "Zoe"];
const LAST = ["Okafor", "Bell", "Hughes", "Patel", "Reid", "Armstrong", "Khan", "Nicholson", "Doyle", "Fraser",
  "Iqbal", "Robson", "Whyte", "Shah", "Charlton", "Graham"];

const nodes = [], edges = [], byId = new Map();
const rows = { "organisations.csv": 1, "projects.csv": 1, "people.csv": 1, "partnerships.csv": 1, "places.csv": 1, "funders.csv": 1 };
const nextRow = file => { rows[file] = (rows[file] ?? 1) + 1; return rows[file]; };
const add = n => { nodes.push(n); byId.set(n.id, n); return n; };
let edgeNumber = 0;
const link = (source, target, type, fileName, properties = {}) => {
  const recordNumber = nextRow(fileName);
  edges.push({ id: "rel-" + (++edgeNumber), source, target, type,
    origin: { system: "csv", recordId: fileName.replace(/\.csv$/, "") + "-" + recordNumber, fileName, recordNumber },
    properties });
};
const located = (lat, lon) => ({ Latitude: round4(lat), Longitude: round4(lon) });

for (const [name, lat, lon, region] of PLACES) {
  const recordNumber = nextRow("places.csv");
  add({ id: "place-" + name.toLowerCase(), label: name, type: "place", region, tags: [],
    origin: { system: "csv", recordId: "PLACE-" + recordNumber, fileName: "places.csv", recordNumber },
    properties: located(lat, lon) });
}
const placeOf = name => PLACES.find(p => p[0] === name);
for (const [name, hq, prefs] of FUNDERS) {
  const [, lat, lon, region] = placeOf(hq);
  const recordNumber = nextRow("funders.csv");
  add({ id: "funder-" + name.toLowerCase().replace(/\W+/g, "-"), label: name, type: "funder", region,
    description: "A fictional funder based in " + hq + ", supporting " + prefs.slice(0, 2).join(" and ").toLowerCase() + ".",
    tags: prefs.slice(0, 2),
    origin: { system: "csv", recordId: "FUNDER-" + recordNumber, fileName: "funders.csv", recordNumber },
    properties: { ...located(lat, lon), "Head office": hq } });
}
const funderId = name => "funder-" + name.toLowerCase().replace(/\W+/g, "-");

const used = new Set(), orgsByTheme = Object.fromEntries(THEMES.map(t => [t, []]));
const THEME_COUNT = { "Regenerative farming": 20, "Farmer wellbeing": 12, "Land access": 14, "Community growing": 24,
  "Food education": 16, "Food justice": 22, "Local supply chains": 22 };
function addOrg(label, theme, place, opts = {}) {
  const [pname, lat, lon, region] = place;
  const recordNumber = nextRow("organisations.csv");
  const tags = opts.tags ?? (r() < 0.3 ? [theme, pick(THEMES.filter(t => t !== theme))] : [theme]);
  const hasLocation = opts.located ?? r() > 0.07;
  const n = add({ id: "org-" + label.toLowerCase().replace(/\W+/g, "-"), label, type: "organisation",
    ...(hasLocation ? { region } : {}), description: ORG_DESCRIPTIONS[theme], tags,
    origin: { system: "csv", recordId: "ORG-" + recordNumber, fileName: "organisations.csv", recordNumber },
    properties: hasLocation ? { ...located(lat + (opts.exact ? 0 : gauss() * 0.09), lon + (opts.exact ? 0 : gauss() * 0.14)), Town: pname } : {} });
  n._theme = theme; n._place = pname; n._lat = hasLocation ? n.properties.Latitude : null; n._lon = hasLocation ? n.properties.Longitude : null;
  orgsByTheme[theme].push(n);
  used.add(label);
  return n;
}
const lark = addOrg("Larkhope Food Partnership", "Local supply chains", placeOf("Hexham"),
  { tags: ["Local supply chains", "Food justice", "Community growing"], located: true, exact: true });
lark.description = "A fictional partnership running a veg box scheme and a shared food hub for growers in the Tyne valley.";
const crag = addOrg("Cragend Land Trust", "Land access", placeOf("Kendal"), { tags: ["Land access"], located: true });
for (const theme of THEMES) {
  for (let i = 0; i < THEME_COUNT[theme]; i++) {
    let label; do { label = pick(ORG_PATTERNS[theme]).replace("{p}", pick(PREFIX)); } while (used.has(label));
    addOrg(label, theme, weightedPlace());
  }
}

for (let i = 0; i < 24; i++) {
  const theme = pick(THEMES), org = pick(orgsByTheme[theme]);
  const recordNumber = nextRow("people.csv");
  const p = add({ id: "person-" + (i + 1), label: FIRST[i] + " " + pick(LAST), type: "person", tags: [],
    description: "A fictional person connected to " + org.label + ".",
    origin: { system: "csv", recordId: "PERSON-" + recordNumber, fileName: "people.csv", recordNumber } });
  link(p.id, org.id, "works with", "people.csv", { "Start Date": String(2018 + Math.floor(r() * 8)) });
}

let projectCount = 0;
const projects = [];
const PROJECT_COUNT = { "Regenerative farming": 28, "Farmer wellbeing": 16, "Land access": 18, "Community growing": 32,
  "Food education": 22, "Food justice": 30, "Local supply chains": 30 };
const monthDay = () => String(1 + Math.floor(r() * 12)).padStart(2, "0") + "-" + String(1 + Math.floor(r() * 28)).padStart(2, "0");
function grant(funder, project, amount, year) {
  link(funderId(funder), project.id, "funds", "grants-" + year + ".csv",
    { "Award Date": year + "-" + monthDay(), "Amount Awarded": amount, "Currency": "GBP", "Programme": funder.split(" ")[0] + " open grants" });
}
function addProject(label, theme, lead, year, place) {
  const recordNumber = nextRow("projects.csv");
  const lat = place ? place[1] : lead._lat, lon = place ? place[2] : lead._lon;
  const region = place ? place[3] : lead.region;
  const pr = add({ id: "project-" + (++projectCount), label, type: "project", ...(region ? { region } : {}),
    description: "A fictional " + theme.toLowerCase() + " project led by " + lead.label + ".",
    tags: [theme],
    origin: { system: "csv", recordId: "PROJECT-" + recordNumber, fileName: "projects.csv", recordNumber },
    properties: lat != null ? { ...located(lat + gauss() * 0.05, lon + gauss() * 0.07), "Start Date": String(year) } : { "Start Date": String(year) } });
  pr._theme = theme; pr._year = year; pr._place = place ? place[0] : lead._place;
  projects.push(pr);
  link(lead.id, pr.id, "delivers", "projects.csv", { "Start Date": String(year) });
  return pr;
}
for (const theme of THEMES) {
  for (let i = 0; i < PROJECT_COUNT[theme]; i++) {
    const lead = pick(orgsByTheme[theme]);
    const year = 2015 + Math.floor(Math.pow(r(), 0.7) * 11.8);
    const pr = addProject(pick(PROJECTS[theme]) + " · " + lead.label.split(" ")[0], theme, lead, year);
    if (r() < 0.38) {
      const other = r() < 0.75 ? pick(orgsByTheme[theme]) : pick(orgsByTheme[pick(THEMES)]);
      if (other !== lead) link(other.id, pr.id, "delivers", "projects.csv", { "Start Date": String(year) });
    }
    const candidates = FUNDERS.filter(f => f[2].includes(theme));
    const count = r() < 0.3 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const f = r() < 0.88 && candidates.length ? pick(candidates) : pick(FUNDERS);
      const amount = Math.min(Math.max(Math.round(Math.exp(9.4 + gauss() * 0.85) / 500) * 500, 2000), 400000);
      grant(f[0], pr, amount, year);
    }
    if (r() < 0.55 && pr._place) link(pr.id, "place-" + pr._place.toLowerCase(), "located in", "projects.csv", { "Start Date": String(year) });
  }
}
// Larkhope is a busy hub, with a documented route to Cragend through one funder.
const hexham = placeOf("Hexham");
const larkProjects = [["Fair veg box · Larkhope", "Local supply chains", 2022], ["Shared food hub logistics · Tynedale", "Local supply chains", 2021],
  ["Community fridge · Hexham", "Food justice", 2025], ["Pay-as-you-feel café · Prudhoe", "Food justice", 2017],
  ["Community orchard · Haltwhistle", "Community growing", 2023], ["Public sector local sourcing · Northumberland", "Local supply chains", 2024]];
const larkMade = larkProjects.map(([label, theme, year]) => addProject(label, theme, lark, year, hexham));
grant("Fellside Fund", larkMade[0], 48000, 2022);
grant("Coldwater Trust", larkMade[1], 24500, 2021);
grant("Northlight Foundation", larkMade[2], 12000, 2025);
grant("Brackenbury Fund", larkMade[3], 7500, 2017);
grant("Coldwater Trust", larkMade[4], 9000, 2023);
grant("Common Furrow Fund", larkMade[5], 31000, 2024);
const cumbria = placeOf("Kendal");
const matching = addProject("Land matching service · Cumbria", "Land access", crag, 2023, cumbria);
grant("Fellside Fund", matching, 62500, 2023);
for (const p of larkMade.slice(0, 3)) link(p.id, "place-hexham", "located in", "projects.csv", { "Start Date": String(p._year) });

// Recorded partnerships between organisations.
const partnered = new Set();
const partner = (a, b, year) => {
  const key = [a.id, b.id].sort().join("|");
  if (a === b || partnered.has(key)) return;
  partnered.add(key);
  link(a.id, b.id, "partners with", "partnerships.csv", { "Date": String(year) });
};
for (let i = 0; i < 70; i++) {
  const t = pick(THEMES), a = pick(orgsByTheme[t]);
  const b = r() < 0.7 ? pick(orgsByTheme[t]) : pick(orgsByTheme[pick(THEMES)]);
  partner(a, b, 2016 + Math.floor(r() * 10));
}
partner(lark, orgsByTheme["Food justice"][1], 2020);
partner(lark, orgsByTheme["Community growing"][1], 2020);
partner(lark, orgsByTheme["Local supply chains"][2], 2019);

for (const n of nodes) for (const key of Object.keys(n)) if (key.startsWith("_")) delete n[key];
const graph = {
  version: 1,
  title: "Northern food & farming network — fictional example",
  description: "A fictional network of organisations, projects, funders, people and places working on food and farming, mostly in the North of England. Every record is invented; town coordinates are real.",
  nodes, edges
};
fs.writeFileSync(new URL("../northern-food-example.json", import.meta.url), JSON.stringify(graph) + "\n");
const count = {}; for (const n of nodes) count[n.type] = (count[n.type] ?? 0) + 1;
console.log("nodes", nodes.length, count, "edges", edges.length,
  "funds", edges.filter(e => e.type === "funds").length,
  "unlocated orgs/projects", nodes.filter(n => (n.type === "organisation" || n.type === "project") && !n.properties?.Latitude).length);
