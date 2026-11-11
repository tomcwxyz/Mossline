// Deterministic fictional dataset generator for Mossy's Throw Lab.
// Run: node data/throw-lab/generate-rich.mjs
// No external packages and no random seeds outside this file.
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
function generateRichLab(){
  let seed=11072026;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const num=(n)=>Math.floor(rnd()*n);
  const choose=(a)=>a[num(a.length)];
  const pad=(n)=>String(n).padStart(3,"0");
  const csv=(heads,rows)=>[heads,...rows].map(r=>r.map(v=>{const t=String(v??"");return /[",\n\r]/.test(t)?'"'+t.replaceAll('"','""')+'"':t}).join(",")).join("\n")+"\n";
  // City centres anchor synthetic positions: no venue, business or observation is real.
  const geographies={"uk":{"label":"UK-wide","places":[["Newcastle",54.9783,-1.6178,"United Kingdom"],["Edinburgh",55.9533,-3.1883,"United Kingdom"],["Glasgow",55.8642,-4.2518,"United Kingdom"],["Belfast",54.5973,-5.9301,"United Kingdom"],["Cardiff",51.4816,-3.1791,"United Kingdom"],["Bristol",51.4545,-2.5879,"United Kingdom"],["London",51.5074,-0.1278,"United Kingdom"],["Birmingham",52.4862,-1.8904,"United Kingdom"],["Manchester",53.4808,-2.2426,"United Kingdom"],["Leeds",53.8008,-1.5491,"United Kingdom"],["Sheffield",53.3811,-1.4701,"United Kingdom"],["Aberdeen",57.1497,-2.0943,"United Kingdom"],["Exeter",50.7184,-3.5339,"United Kingdom"],["Swansea",51.6214,-3.9436,"United Kingdom"]]},"europe":{"label":"Europe-wide","places":[["London",51.5074,-0.1278,"United Kingdom"],["Dublin",53.3498,-6.2603,"Ireland"],["Paris",48.8566,2.3522,"France"],["Berlin",52.52,13.405,"Germany"],["Amsterdam",52.3676,4.9041,"Netherlands"],["Copenhagen",55.6761,12.5683,"Denmark"],["Barcelona",41.3874,2.1686,"Spain"],["Lisbon",38.7223,-9.1393,"Portugal"],["Rome",41.9028,12.4964,"Italy"],["Warsaw",52.2297,21.0122,"Poland"],["Stockholm",59.3293,18.0686,"Sweden"],["Brussels",50.8503,4.3517,"Belgium"]]},"usa":{"label":"United States-wide","places":[["Seattle, WA",47.6062,-122.3321,"United States"],["Portland, OR",45.5152,-122.6784,"United States"],["San Francisco, CA",37.7749,-122.4194,"United States"],["Los Angeles, CA",34.0522,-118.2437,"United States"],["Denver, CO",39.7392,-104.9903,"United States"],["Chicago, IL",41.8781,-87.6298,"United States"],["Minneapolis, MN",44.9778,-93.265,"United States"],["Boston, MA",42.3601,-71.0589,"United States"],["New York, NY",40.7128,-74.006,"United States"],["Atlanta, GA",33.749,-84.388,"United States"],["Austin, TX",30.2672,-97.7431,"United States"],["Miami, FL",25.7617,-80.1918,"United States"]]},"northAmerica":{"label":"Canada, United States and Mexico","places":[["Vancouver",49.2827,-123.1207,"Canada"],["Toronto",43.6532,-79.3832,"Canada"],["Montreal",45.5017,-73.5673,"Canada"],["Calgary",51.0447,-114.0719,"Canada"],["Mexico City",19.4326,-99.1332,"Mexico"],["Monterrey",25.6866,-100.3161,"Mexico"],["Guadalajara",20.6597,-103.3496,"Mexico"],["Oaxaca",17.0732,-96.7266,"Mexico"],["Seattle, WA",47.6062,-122.3321,"United States"],["Chicago, IL",41.8781,-87.6298,"United States"],["Los Angeles, CA",34.0522,-118.2437,"United States"],["Austin, TX",30.2672,-97.7431,"United States"]]},"world":{"label":"Across continents","places":[["Bristol",51.4545,-2.5879,"United Kingdom"],["Galway",53.2707,-9.0568,"Ireland"],["Lyon",45.764,4.8357,"France"],["Accra",5.6037,-0.187,"Ghana"],["Nairobi",-1.2921,36.8219,"Kenya"],["Cape Town",-33.9249,18.4241,"South Africa"],["Bengaluru",12.9716,77.5946,"India"],["Kathmandu",27.7172,85.324,"Nepal"],["Kyoto",35.0116,135.7681,"Japan"],["Melbourne",-37.8136,144.9631,"Australia"],["Wellington",-41.2865,174.7767,"New Zealand"],["Portland, OR",45.5152,-122.6784,"United States"],["Vancouver",49.2827,-123.1207,"Canada"],["Manaus",-3.119,-60.0217,"Brazil"],["Bogotá",4.711,-74.0721,"Colombia"]]},"international":{"label":"International programmes","places":[["London",51.5074,-0.1278,"United Kingdom"],["Manchester",53.4808,-2.2426,"United Kingdom"],["Amsterdam",52.3676,4.9041,"Netherlands"],["Nairobi",-1.2921,36.8219,"Kenya"],["Kampala",0.3476,32.5825,"Uganda"],["Accra",5.6037,-0.187,"Ghana"],["Lagos",6.5244,3.3792,"Nigeria"],["Mumbai",19.076,72.8777,"India"],["Kathmandu",27.7172,85.324,"Nepal"],["Johannesburg",-26.2041,28.0473,"South Africa"],["Buenos Aires",-34.6037,-58.3816,"Argentina"],["Vancouver",49.2827,-123.1207,"Canada"],["Berlin",52.52,13.405,"Germany"],["Oslo",59.9139,10.7522,"Norway"]]}};
  let zones=geographies.uk.places;
  let geographyLabel=geographies.uk.label;
  const scope=key=>{zones=geographies[key].places;geographyLabel=geographies[key].label;};
  const regionOf=i=>{const p=zones[i%zones.length];return p[0]+", "+p[3];};
  const topics=["Food","Health","Housing","Nature","Transport","Culture","Young people","Energy","Community care","Learning"];
  const adjectives=["Bracken","Harbour","Mosaic","Beacon","Willow","Cornerstone","Bridgewater","Hearth","Meadow","Highfield","Lantern","Riverside","Northbank","Seedling","Cedar","Hilltop","Tideway","Foundry"];
  const loc=(i,spread=.045)=>{const z=zones[i%zones.length];return [regionOf(i),(z[1]+(rnd()-.5)*spread).toFixed(5),(z[2]+(rnd()-.5)*spread).toFixed(5)];};
  const files={};const rich=[];
  function add(id,title,group,description,idealFirstView,whatToTry,caveat,sourceFiles,expectedRecords,expectedLinks,stats,observations){
    const sources=sourceFiles.map(([name,content,rows])=>{
      const path="/throw-lab/"+id+"/"+name;
      files["apps/web/public"+path]=content;
      return {name,path,rows,bytes:content.length};
    });
    rich.push({id,title,group,description,idealFirstView,whatToTry,caveat,files:sources,expectedRecords,expectedLinks,stats,observations,geography:{label:geographyLabel,cities:zones.length,countries:[...new Set(zones.map(z=>z[3]))]}});
  }
  function entity(name,type,tag,i,desc=""){const [zone,lat,lon]=loc(i);return [name,type,tag,zone,lat,lon,desc,zones[i%zones.length][3]];}
  const head=["Name","Type","Tags","Region","Latitude","Longitude","Description","Country"];
  // 1. A relationship-rich community network, including distant bridge records and isolated records.
  {
    const org=Array.from({length:115},(_,i)=>`${zones[i%zones.length][0]} ${adjectives[i%adjectives.length]} ${i%3===0?"Co-operative":i%3===1?"Trust":"Group"} ${pad(i+1)}`);
    const projects=Array.from({length:62},(_,i)=>`${zones[i%zones.length][0]} ${topics[i%topics.length]} Programme ${pad(i+1)}`);
    const places=Array.from({length:14},(_,i)=>`${zones[i%zones.length][0]} Community Space ${pad(i+1)}`);
    const rows=[...org.map((n,i)=>entity(n,"organisation",[topics[i%10],topics[(i+3)%10]].join("|"),i,`Fictional organisation working with local ${topics[i%10].toLowerCase()} projects.`)),
    ...projects.map((n,i)=>entity(n,"project",topics[(i+2)%10],i,`Programme delivered in a fictional local network.`)),
    ...places.map((n,i)=>entity(n,"place","Community spaces",i,"Invented meeting point on a real city's geographic backdrop."))];
    const links=[];
    for(let i=0;i<62;i++){links.push([org[(i*3)%115],projects[i],"supports","directed",2022+i%4]);links.push([projects[i],org[(i*3+11)%115],"works alongside","mutual",2023+i%3]);}
    for(let i=0;i<160;i++){const a=org[i%100],b=org[(i*7+13)%110];links.push([a,b,i%5===0?"shares a venue with":"collaborates with","mutual",2020+i%6]);}
    for(let i=0;i<45;i++)links.push([org[i%90],places[i%14],"uses","directed",2022+i%4]);
    for(let i=0;i<21;i++)links.push([org[i%zones.length],org[80+i],"connects across areas","mutual",2024]);
    const records=csv(head,rows),rels=csv(["From","To","Relationship","Direction","Since"],links);
    add("neighbourhood-connections","The Neighbourhood Web","Relationships",
    "Fictional community organisations and shared projects spread across England, Scotland, Wales and Northern Ireland.",
    "network / map","Find organisations that bridge otherwise separate areas. Then look at the same recorded links geographically.",
    "Closeness on the diagram isn't proof of collaboration; the source only records the links in the table.",
    [["records.csv",records,rows.length],["relationships.csv",rels,links.length]],
    rows.length,links.length,`${rows.length} named records · ${links.length} recorded links · ${zones.length} UK cities`,
    ["Clusters around activities","A few bridges between distant areas","Some organisations are lightly connected"]);
  }
  // 2. Real geographic position for both endpoints of many explicit links.
  {scope("europe");
    const venues=Array.from({length:145},(_,i)=>`${zones[i%zones.length][0]} ${adjectives[i%18]} ${i%4===0?"Gallery":i%4===1?"Hall":i%4===2?"Venue":"Studio"} ${pad(i+1)}`);
    const promoters=Array.from({length:24},(_,i)=>`Fictional Arts Promoter ${pad(i+1)}`);
    const rows=[...venues.map((name,i)=>entity(name,"place",["Music","Theatre","Film","Visual arts"][i%4],i,"Invented cultural venue on a real city backdrop.")),...promoters.map((name,i)=>entity(name,"organisation","Culture",i,"Invented promoter or organiser."))];
    const links=[];
    for(let i=0;i<210;i++)links.push([venues[i%145],venues[(i*3+17)%145],i%3===0?"joint event":"shared programme","mutual",2021+i%5]);
    for(let i=0;i<120;i++)links.push([promoters[i%24],venues[(i*11+3)%145],"hosts activity at","directed",2021+i%5]);
    for(let i=0;i<28;i++)links.push([venues[i*4%145],venues[(i*4+54)%145],"touring route","directed",2024]);
    add("arts-across-places","After Hours: Culture Across Places","Geography",
      "Fictional cultural venues and recorded touring links between cities in twelve European countries.",
      "map / network","Switch between points and connected arcs; trace who bridges different towns.",
      "Venues and promoters are inventions. Their positions are illustrative offsets from real city centres.",
      [["venues.csv",csv(head,rows),rows.length],["cultural-links.csv",csv(["From","To","Relationship","Direction","Since"],links),links.length]],
      rows.length,links.length,`${rows.length} venues and promoters · ${links.length} links · ${zones.length} cities · 12 countries`,
      ["Dense local clusters","Cross-city touring links","Some promoters reach several areas"]);
  }
  // 3. An uneven award portfolio with recurring funders, winners, themed grants and dates.
  {scope("usa");
    const funders=Array.from({length:18},(_,i)=>`${adjectives[i%18]} Foundation ${pad(i+1)}`);
    const recipients=Array.from({length:125},(_,i)=>`${zones[i%zones.length][0]} ${adjectives[i%18]} Project Organisation ${pad(i+1)}`);
    const programmes=["Local food","Healthy neighbourhoods","Inclusive culture","Better homes","Young futures","Nature recovery","Community transport"];
    const rows=[];
    for(let i=0;i<720;i++){
      const funder=funders[i%10===0?num(18):[0,0,1,1,2,3,4,5,6,7,8,9][i%12]];
      const recipient=recipients[(i*17+num(15))%125];
      const year=2020+(i%6),month=1+(i*5%12),day=1+(i*7%27);
      const amount=i%17===0?75000+i*71:1200+(i*73%21000);
      rows.push([funder,recipient,`LAB-AWARD-${String(i+1).padStart(5,"0")}`,amount,`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`,programmes[(i+num(2))%7],"USD",regionOf(i),topics[(i+3)%10],zones[i%zones.length][3]]);
    }
    add("funding-in-motion","Six Years of Community Funding","Funding",
      "An invented US-wide grants portfolio with repeated awards, unequal funder reach and changing priorities.",
      "funding / timeline","Compare funders, award amounts, recipients and how the priorities move between years.",
      "Shared recipients or a common funder do not demonstrate organisations working together.",
      [["awards.csv",csv(["Funder","Recipient","Grant ID","Amount","Date","Programme","Currency","Region","Themes","Country"],rows),rows.length]],
      new Set(rows.map(r=>r[0])).size+new Set(rows.map(r=>r[1])).size+rows.length,rows.length*2,
      `${rows.length} grants · ${funders.length} funders · ${new Set(rows.map(r=>r[1])).size} recipients · 6 years`,
      ["A few large funders dominate","Repeat recipients over time","Small awards sit alongside major investments"]);
  }
  // 4. Actual producer/recipient links with plausible network bridges, plus positions.
  {scope("northAmerica");
    const producers=Array.from({length:95},(_,i)=>`${zones[i%zones.length][0]} ${adjectives[i%18]} Growers ${pad(i+1)}`);
    const buyers=Array.from({length:85},(_,i)=>`${zones[i%zones.length][0]} Community Kitchen ${pad(i+1)}`);
    const depots=Array.from({length:22},(_,i)=>`${zones[i%zones.length][0]} Food Hub ${pad(i+1)}`);
    const rows=[...producers.map((n,i)=>entity(n,"organisation","Growing|Food",i,"Fictional local food producer.")),
      ...buyers.map((n,i)=>entity(n,"organisation","Food|Community care",i,"Fictional buyer or community kitchen.")),
      ...depots.map((n,i)=>entity(n,"place","Distribution",i,"Invented distribution location."))];
    const links=[];
    for(let i=0;i<290;i++)links.push([producers[i%95],buyers[(i*13+num(7))%85],"supplies","directed",2022+i%4]);
    for(let i=0;i<160;i++)links.push([producers[(i*7)%95],depots[i%22],"delivers to","directed",2023+i%3]);
    for(let i=0;i<80;i++)links.push([depots[i%22],buyers[(i*9+2)%85],"distributes to","directed",2023+i%3]);
    add("food-supply-routes","How Food Moves","Supply chains",
      "A fictional supply chain with recorded distribution links across Canada, the United States and Mexico.",
      "network / map","Find fragile hubs, trace recorded routes and compare local clusters to cross-area deliveries.",
      "A source-recorded supply relationship isn't evidence of a quantity, value or successful delivery without those fields.",
      [["food-places.csv",csv(head,rows),rows.length],["supply-links.csv",csv(["From","To","Relationship","Direction","Since"],links),links.length]],
      rows.length,links.length,`${rows.length} food sites · ${links.length} recorded routes · 3 countries`,
      ["A handful of distribution hubs","Multi-hop supply chains","Connections between distinct areas"]);
  }
  // 5. Repeated dated events; explicit co-mention isn't a delivery/partnership claim.
  {scope("uk");
    const organisations=Array.from({length:42},(_,i)=>`${zones[i%zones.length][0]} ${adjectives[i%18]} Volunteering ${pad(i+1)}`);
    const rows=[];
    for(let i=0;i<320;i++){
      const year=2022+Math.floor(i/80),month=1+(i*7%12),day=1+(i*11%27);
      rows.push([`${["Repair morning","Community supper","Nature walk","Skills share","Neighbourhood forum"][i%5]} ${String(i+1).padStart(4,"0")}`,
        organisations[(i*5+3)%42],`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`,topics[i%10],regionOf(i),16+(i*13%110),i%3===0?"Outdoor":"Indoor",...loc(i).slice(1),zones[i%zones.length][3]]);
    }
    add("volunteer-calendar","A Year of Community Activity","Events",
      "Fictional activity sessions across the UK over four years, with dates and mapped event locations.",
      "network / future timeline","Explore which organisations appear most often, then compare seasons, topics and attendance once event charting lands.",
      "Appearing in a row with an event does not, alone, prove collaboration or wider impact.",
      [["sessions.csv",csv(["Event","Organisation","Date","Theme","Region","Attendees","Format","Latitude","Longitude","Country"],rows),rows.length]],
      rows.length+organisations.length,rows.length,`${rows.length} dated sessions · ${organisations.length} organisers · 4 years`,
      ["Activities fluctuate by season","Different types of event","Uneven levels of participation"]);
  }
  // 6. Point observations with no invented relationships; sensible map, theme groupings.
  {scope("world");
    const species=["Moss A","Moss B","Moss C","Moss D","Moss E","Moss F","Moss G","Moss H"];
    const rows=[];
    for(let i=0;i<510;i++){
      const z=i%zones.length,locn=loc(z,.09),year=2023+(i%4);
      const month=1+(i*5%12),count=1+(i*19%18);
      rows.push([`Survey observation ${String(i+1).padStart(5,"0")}`,"other",species[(z*3+num(5))%8],
        locn[0],locn[1],locn[2],`${year}-${String(month).padStart(2,"0")}-15`,count,zones[z][3]]);
    }
    add("wildlife-sightings","Living Places: Field Observations","Ecology",
      "Invented field observations across Africa, Asia, Europe, the Americas and Oceania.",
      "map / themes","Explore observation clusters, species concentrations and where the records are sparse.",
      "Observations are not proof of species absence elsewhere and don't create relationships between observations.",
      [["observations.csv",csv(["Name","Type","Tags","Region","Latitude","Longitude","Date","Count","Country"],rows),rows.length]],
      rows.length,0,`${rows.length} positioned observations · 8 fictional species · 4 years`,
      ["Concentrations in several places","Uneven species coverage","Source dates available for further charting"]);
  }
  // 7. Meaningful tag distribution without false relationships.
  {scope("uk");
    const rows=[];
    for(let i=0;i<285;i++){
      const zone=zones[i%zones.length][0],tag=topics[i%10];
      const second=i%6===0?topics[(i+5)%10]:topics[(i+3)%10];
      rows.push([`${zone} ${adjectives[i%18]} Community Initiative ${pad(i+1)}`,"project",
        tag+"|"+second,regionOf(i),`${tag} work, recorded in a fictional project portfolio.`,2021+i%6,...loc(i).slice(1),zones[i%zones.length][3]]);
    }
    add("themes-in-common","Common Ground: A Project Portfolio","Themes",
      "A UK-wide portfolio of fictional projects with overlapping source-given themes, not inferred partnerships.",
      "themes / directory","See themes that recur, try different groupings and inspect projects within each group.",
      "Sharing a tag is not evidence of partnership. No links have been fabricated in this dataset.",
      [["projects.csv",csv(["Name","Type","Tags","Region","Description","Year","Latitude","Longitude","Country"],rows),rows.length]],
      rows.length,0,`${rows.length} projects · 10 themes · 7 areas`,
      ["Some themes recur together","Regional variation","No recorded relationships"]);
  }
  // 8. A genuinely mixed JSON/CSV upload, each category with distinct names, backed by explicit link table.
  {scope("international");
    const orgs=Array.from({length:94},(_,i)=>`${zones[i%zones.length][0]} ${adjectives[i%18]} Social Group ${pad(i+1)}`);
    const initiatives=Array.from({length:76},(_,i)=>`${zones[i%zones.length][0]} ${topics[i%10]} Initiative ${pad(i+1)}`);
    const rows=orgs.map((n,i)=>entity(n,"organisation",topics[i%10],i,"Fictional community organisation."));
    const json=JSON.stringify({initiatives:initiatives.map((Name,i)=>({Name,Type:"project",Tags:topics[(i+4)%10],Region:regionOf(i),Country:zones[i%zones.length][3],Latitude:Number(loc(i)[1]),Longitude:Number(loc(i)[2]),
      Description:"Fictional initiative spanning local organisations.",Year:2022+i%5}))},null,2)+"\n";
    const links=[];
    for(let i=0;i<280;i++)links.push([orgs[(i*3+5)%94],initiatives[i%76],i%4===0?"shares resources with":"helps deliver","directed"]);
    for(let i=0;i<75;i++)links.push([orgs[i],orgs[(i*7+23)%94],"works with","mutual"]);
    add("mixed-programmes","A Patchwork of Projects","Mixed sources",
      "Fictional international programmes across countries, using CSV organisations, JSON initiatives and recorded cross-border links.",
      "network / themes","Compare sources, follow who works across initiatives and inspect the original rows behind the links.",
      "Cross-file records must not merge merely because they share a similar name or location.",
      [["organisations.csv",csv(head,rows),rows.length],["initiatives.json",json,initiatives.length],
        ["recorded-connections.csv",csv(["From","To","Relationship","Direction"],links),links.length]],
      orgs.length+initiatives.length,links.length,`${orgs.length} organisations · ${initiatives.length} initiatives · ${links.length} explicit links`,
      ["Three different source files","Cross-border source-recorded connections","Repeated themes and distinct source receipts"]);
  }
  return {files,manifest:{version:1,generated:"2026-11-11",disclaimer:"All organisations, grants, events, species and relationships are fictional. City centres are illustrative geographic anchors with small synthetic offsets, not real site addresses. Counts describe intended source interpretations, not guaranteed visual support.",examples:rich}};
}
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const data=generateRichLab();
for(const [path,content] of Object.entries(data.files)){
  const target=resolve(root,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,content,"utf8");
}
await writeFile(resolve(root,"data/throw-lab/rich-catalogue.json"),JSON.stringify(data.manifest,null,2)+"\n","utf8");
console.log("Generated",data.manifest.examples.length,"rich Throw Lab examples");
