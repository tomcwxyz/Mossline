#!/usr/bin/env node
/**
 * A large invented 360Giving file for checking how the atlas copes with a
 * grants-heavy map: ~3,700 grants from 30 funders to ~2,000 organisations,
 * mostly in one year, as a regional GrantNav download often is. Every name,
 * number and grant is invented.
 *
 *   node data/generators/large-grants.mjs out.csv
 */
import { writeFileSync } from "node:fs";

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const funders = [
  ["Northfield Community Foundation", 2007], ["Workwise North", 1044], ["Larchmere Trust", 317], ["Heritage Renewal Fund", 98],
  ["Moorside Foundation", 186], ["Department for Places", 64], ["Culture Fund for the North", 48], ["Riverbank Charitable Trust", 24],
  ["Kestrel Foundation", 60], ["Hollins Fund", 40], ["Sport for All Fund", 55], ["Whinmoor Trust", 30], ["Stoneleigh Foundation", 28],
  ["Coastline Trust", 22], ["Fellgate Fund", 20], ["Bracken Foundation", 18], ["Elmhurst Trust", 16], ["Ashdown Fund", 14],
  ["Tarn Foundation", 12], ["Greystones Trust", 12], ["Beacon Fund", 10], ["Lindisfarne Fund", 9], ["Wansdyke Trust", 8],
  ["Pennine Gift", 8], ["Harrier Fund", 7], ["Oakfield Trust", 6], ["Saltwell Fund", 5], ["Copperleaf Trust", 4], ["Ridge Fund", 3], ["Dene Trust", 3]];
const kinds = ["Youth Project", "Food Bank", "Community Centre", "Arts Collective", "Carers Network", "Sports Club", "Credit Union",
  "Mental Health Network", "Women's Centre", "Refugee Welcome", "Allotment Society", "Heritage Trust", "Village Hall", "Men's Shed",
  "Advice Centre", "Theatre Company", "Housing Project", "Wildlife Group", "Recovery Café", "Family Hub", "Digital Skills Hub", "Dementia Café"];
const places = [["Newcastle", "NE1"], ["Gateshead", "NE8"], ["Sunderland", "SR1"], ["Durham", "DH1"], ["Hexham", "NE46"], ["Blyth", "NE24"],
  ["Morpeth", "NE61"], ["South Shields", "NE33"], ["Middlesbrough", "TS1"], ["Darlington", "DL1"], ["Hartlepool", "TS24"], ["Consett", "DH8"],
  ["Ashington", "NE63"], ["Stockton", "TS18"], ["Bishop Auckland", "DL14"], ["Alnwick", "NE66"], ["Washington", "NE38"], ["Whitley Bay", "NE26"]];
const purposes = [
  "Core costs to keep the {k} open for young people in {p}", "Running costs for a weekly food larder and shared meals in {p}",
  "Wellbeing sessions to reduce loneliness and isolation among older people", "Support for unpaid carers, including respite and peer groups",
  "Arts and music workshops for children and families", "Coaching and equipment so more people take part in sport and physical activity",
  "Money advice and help with the cost of living crisis", "Counselling and mental health support for adults in {p}",
  "Repairs to the community building and village hall", "ESOL classes and welcome activities for refugees and asylum seekers",
  "Employability training and help into work", "Tree planting, gardening and nature recovery on local green spaces",
  "A safe space and advocacy for women affected by domestic abuse", "Digital skills and online access for people who are offline",
  "Heritage project recording the history of {p}", "Recovery support for people affected by drug and alcohol use",
  "Homelessness outreach and help into housing", "Holiday activities and food programme for children", "Salary of a part-time coordinator"];
const programmes = { "Northfield Community Foundation": ["Community Fund", "Cost of Living Fund", "Young People's Fund", "Small Grants"],
  "Workwise North": ["Into Work", "Skills Grants"], "Larchmere Trust": ["Main Grants"], "Heritage Renewal Fund": ["Heritage Grants"] };
const orgs = [];
for (let i = 0; i < 2000; i++) {
  const [place, district] = pick(places);
  orgs.push({ name: place + " " + pick(kinds) + (rnd() < 0.3 ? " " + (i % 97 + 1) : ""), id: "GB-CHC-" + (1700000 + i),
    postcode: district + " " + (1 + Math.floor(rnd() * 8)) + "ZZ", place });
}
const head = ["Identifier", "Title", "Description", "Currency", "Amount Awarded", "Award Date", "Recipient Org:Identifier", "Recipient Org:Name",
  "Recipient Org:Charity Number", "Recipient Org:Postal Code", "Funding Org:Identifier", "Funding Org:Name", "Grant Programme:Title"];
const rows = [head];
let n = 0;
funders.forEach(([funder, count], fi) => {
  for (let i = 0; i < count; i++) {
    const org = rnd() < 0.7 ? orgs[Math.floor(Math.pow(rnd(), 1.4) * orgs.length)] : pick(orgs);
    const kind = org.name.replace(/^\S+(?: \S+)? /, "");
    const month = 1 + Math.floor(rnd() * 12), day = 1 + Math.floor(rnd() * 27);
    const year = fi < 3 || rnd() < 0.85 ? 2025 : 2024;
    const amount = Math.round((fi < 2 ? 500 + rnd() * 6000 : 2000 + Math.pow(rnd(), 2) * 120000) / 10) * 10;
    rows.push(["360G-INVENTED-" + (++n), "Grant to " + org.name, pick(purposes).replace("{p}", org.place).replace("{k}", kind.toLowerCase()), "GBP",
      String(amount), `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, org.id, org.name, org.id.slice(7), org.postcode,
      "GB-CHC-" + (1600000 + fi), funder, pick(programmes[funder] ?? ["Grants"])]);
  }
});
const csv = rows.map(r => r.map(v => /[",]/.test(v) ? '"' + v.replaceAll('"', '""') + '"' : v).join(",")).join("\r\n") + "\r\n";
writeFileSync(process.argv[2] ?? "large-grants.csv", csv);
console.log(rows.length - 1 + " grants");
