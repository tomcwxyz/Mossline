import { parseGraphDocument } from "@mossline/graph-core";

/**
 * Entirely synthetic network solely for visual smoke testing.
 * Entity labels/links are examples, not records from PFT's real spreadsheet.
 * IDs intentionally match artwork filenames so the external pack is exercised.
 */
const entries = [
  ["org-meadow-commons","Meadow Commons","organisation"],
  ["org-fieldroots","Fieldroots","organisation"],
  ["org-soillink","SoilLink","organisation"],
  ["org-northern-soils","Northern Soils","organisation"],
  ["org-orchard-circle","Orchard Circle","organisation"],
  ["org-agroforestry-exchange","Agroforestry Exchange","organisation"],
  ["org-scottish-field-lab","Scottish Field Lab","organisation"],
  ["org-welsh-land-network","Welsh Land Network","organisation"],
  ["org-farm-evidence-lab","Farm Evidence Lab","organisation"],
  ["org-rural-knowledge","Rural Knowledge","organisation"],
  ["proj-006","Illustrated project 06","project"],
  ["proj-010","Illustrated project 10","project"],
  ["proj-013","Illustrated project 13","project"],
  ["proj-019","Illustrated project 19","project"],
  ["fund-green-horizon","Green Horizon","funder"],
  ["fund-celtic-land","Celtic Land","funder"],
  ["fund-northern-landscapes","Northern Landscapes","funder"],
  ["topic-soil","Soil health","topic"],
  ["topic-agroforestry","Agroforestry","topic"],
  ["geo-wales","Wales","place"]
] as const;
const pairs: [number,number][] = [
  [0,10],[1,10],[2,10],[3,11],[4,11],[5,12],[6,12],[7,13],[8,13],[9,12],
  [10,14],[11,16],[12,14],[13,15],[10,17],[12,18],[13,19],[11,17],[8,11],[6,19]
];

export const PFT_VISUAL_EXAMPLE=parseGraphDocument({
  version:1,
  title:"PFT illustrated artwork — visual example",
  description:"Visual demonstration only. These links are fabricated layout examples, NOT relationships or evidence from the PFT spreadsheet. Import the real PFT tables to explore the real source records.",
  nodes: entries.map(([id,label,type])=>({
    id,label,type,tags:["Visual example only"],
    description:"Illustration preview. This is not a verified record from the PFT directory.",
    properties:{"Data status":"Illustrative mock-up, not PFT source"}
  })),
  // Inferred-only so the route finder cannot present fabricated examples as recorded evidence.
  edges: pairs.map(([a,b],index)=>({
    id:"visual-only:"+index,
    source:entries[a][0],target:entries[b][0],
    type:"visual link — NOT source data",
    description:"Synthetic relationship drawn only to demonstrate the visual network.",
    inferred:true,direction:"undirected" as const
  }))
});
