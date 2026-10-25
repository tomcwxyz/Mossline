#!/usr/bin/env node
/**
 * Writes small sample files in the real layouts of common sources, for trying
 * "Add data" and for tests. Every organisation, person, number and grant here
 * is invented. Charity numbers (199xxxx, SC0999xx) and company numbers
 * (990000xx) are deliberately outside the ranges the registers have issued.
 *
 *   node data/generators/source-samples.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../../apps/web/public/samples");
mkdirSync(out, { recursive: true });
const csv = (rows) => rows.map(r => r.map(v => /[",\n]/.test(v) ? '"' + v.replaceAll('"', '""') + '"' : v).join(",")).join("\r\n") + "\r\n";
const tsv = (rows) => rows.map(r => r.join("\t")).join("\r\n") + "\r\n";
const write = (name, text) => { writeFileSync(resolve(out, name), text); console.log("wrote " + name); };

/* 360Giving, flat CSV as GrantNav downloads it (a subset of its columns). */
const g360 = [
  ["Identifier", "Title", "Description", "Currency", "Amount Awarded", "Award Date", "Recipient Org:Identifier", "Recipient Org:Name",
    "Recipient Org:Charity Number", "Recipient Org:Company Number", "Recipient Org:Postal Code", "Recipient Org:Location:0:Name",
    "Recipient Ind:Identifier", "Recipient Ind:Name", "Funding Org:Identifier", "Funding Org:Name", "Grant Programme:Title", "Classifications:0:Title"],
  ["360G-MOORFIELD-0001", "Village larder and shared meals", "Weekly larder and a shared meal for families in the upper dale.", "GBP", "12000", "2025-03-14",
    "GB-CHC-1990001", "Allendale Larder", "1990001", "99000001", "NE47 9QZ", "Northumberland", "", "", "GB-CHC-1990101", "Moorfield Foundation", "Rural Food", "Food access"],
  ["360G-MOORFIELD-0002", "Repair sessions in the market hall", "Monthly repair sessions with volunteer fixers.", "GBP", "4500", "2025-06-02",
    "GB-COH-99000002", "Riverside Repair Cafe CIC", "", "99000002", "NE46 3ZZ", "Northumberland", "", "", "GB-CHC-1990101", "Moorfield Foundation", "Circular Economy", "Environment"],
  ["360G-LARKSPUR-0001", "Detached youth work", "Two evenings a week of detached youth work across the town.", "GBP", "20000", "2024-11-20",
    "GB-CHC-1990003", "Hexmoor Youth Project", "1990003", "", "NE46 1ZZ", "Northumberland", "", "", "GB-SC-SC099901", "Larkspur Community Trust", "Young People", "Young people"],
  ["360G-LARKSPUR-0002", "Individual hardship award", "", "GBP", "300", "2025-01-08",
    "", "", "", "", "", "", "360G-LARKSPUR-IND-1", "Individual recipient", "GB-SC-SC099901", "Larkspur Community Trust", "Hardship", ""],
  ["360G-MOORFIELD-0003", "Cold store and delivery van", "Equipment so the larder can take donated fresh food.", "GBP", "6000", "2026-01-10",
    "GB-CHC-1990001", "Allendale Larder", "1990001", "99000001", "NE47 9QZ", "Northumberland", "", "", "GB-CHC-1990101", "Moorfield Foundation", "Rural Food", "Food access"]
];
write("360giving-grants.csv", csv(g360));

/* 360Giving JSON package. */
write("360giving-grants.json", JSON.stringify({ grants: [{
  id: "360G-LARKSPUR-0003", title: "Peer support for carers", description: "Fortnightly peer support groups for unpaid carers.",
  currency: "GBP", amountAwarded: 7500, awardDate: "2025-09-30",
  recipientOrganization: [{ id: "GB-CHC-1990004", name: "Tynedale Carers Circle", charityNumber: "1990004", postalCode: "NE45 5ZZ" }],
  fundingOrganization: [{ id: "GB-SC-SC099901", name: "Larkspur Community Trust" }],
  grantProgramme: [{ title: "Care and Support" }]
}] }, null, 2));

/* Charity Commission register download: tab-separated tables. */
const ccDate = "2026-10-01";
write("publicextract.charity.txt", tsv([
  ["date_of_extract", "organisation_number", "registered_charity_number", "linked_charity_number", "charity_name", "charity_type",
    "charity_registration_status", "date_of_registration", "date_of_removal", "latest_income", "latest_expenditure",
    "charity_contact_address1", "charity_contact_postcode", "charity_contact_web", "charity_company_registration_number", "charity_activities"],
  [ccDate, "5990001", "1990001", "0", "ALLENDALE LARDER", "Charitable company", "Registered", "2016-04-11", "", "48210", "45102",
    "The Old Chapel", "NE47 9QZ", "www.example.org/larder", "99000001", "Runs a village larder and shared meals for families in the upper dale."],
  [ccDate, "5990003", "1990003", "0", "HEXMOOR YOUTH PROJECT", "CIO", "Registered", "2019-09-02", "", "86500", "90120",
    "Unit 4, Station Yard", "NE46 1ZZ", "", "", "Youth work, mentoring and holiday activities for young people in and around the town."],
  [ccDate, "5990013", "1990003", "1", "HEXMOOR YOUTH PROJECT MINIBUS FUND", "Other", "Registered", "2020-01-15", "", "1200", "800",
    "", "", "", "", "Holds funds for the project's minibus."],
  [ccDate, "5990009", "1990009", "0", "DISTANT DALES TRUST", "Trust", "Registered", "2001-05-30", "", "12000", "9000",
    "", "LA10 5ZZ", "", "", "Grants for village halls."]
]));
write("publicextract.charity_trustee.txt", tsv([
  ["date_of_extract", "organisation_number", "registered_charity_number", "linked_charity_number", "trustee_id", "trustee_name",
    "trustee_is_chair", "individual_or_organisation", "trustee_date_of_appointment"],
  [ccDate, "5990001", "1990001", "0", "8800101", "Morgan Hale", "True", "P", "2016-04-11"],
  [ccDate, "5990001", "1990001", "0", "8800102", "Priya Lowther", "False", "P", "2021-07-19"],
  [ccDate, "5990003", "1990003", "0", "8800301", "Moorfield Foundation", "False", "O", "2019-09-02"],
  [ccDate, "5990009", "1990009", "0", "8800901", "Robin Ashby", "True", "P", "2001-05-30"]
]));
write("publicextract.charity_classification.txt", tsv([
  ["date_of_extract", "organisation_number", "registered_charity_number", "linked_charity_number", "classification_code",
    "classification_type", "classification_description"],
  [ccDate, "5990001", "1990001", "0", "105", "What", "The Prevention Or Relief Of Poverty"],
  [ccDate, "5990001", "1990001", "0", "202", "Who", "Children/young People"],
  [ccDate, "5990001", "1990001", "0", "302", "How", "Provides Services"],
  [ccDate, "5990003", "1990003", "0", "202", "Who", "Children/young People"],
  [ccDate, "5990009", "1990009", "0", "117", "What", "Arts/culture/heritage/science"]
]));

/* Companies House free company data (headings as published, some with a leading space). */
write("companies-house.csv", csv([
  ["CompanyName", " CompanyNumber", "RegAddress.CareOf", "RegAddress.POBox", "RegAddress.AddressLine1", " RegAddress.AddressLine2",
    "RegAddress.PostTown", "RegAddress.County", "RegAddress.Country", "RegAddress.PostCode", "CompanyCategory", "CompanyStatus",
    "CountryOfOrigin", "DissolutionDate", "IncorporationDate", "SICCode.SicText_1", "SICCode.SicText_2", "SICCode.SicText_3", "SICCode.SicText_4"],
  ["ALLENDALE LARDER", "99000001", "", "", "THE OLD CHAPEL", "", "HEXHAM", "NORTHUMBERLAND", "ENGLAND", "NE47 9QZ",
    "PRI/LTD BY GUAR/NSC (Private, limited by guarantee, no share capital)", "Active", "United Kingdom", "", "11/04/2016",
    "88990 - Other social work activities without accommodation n.e.c.", "", "", ""],
  ["RIVERSIDE REPAIR CAFE CIC", "99000002", "", "", "MARKET HALL", "", "HEXHAM", "NORTHUMBERLAND", "ENGLAND", "NE46 3ZZ",
    "Community Interest Company", "Active", "United Kingdom", "", "03/02/2022",
    "95290 - Repair of personal and household goods n.e.c.", "94990 - Activities of other membership organisations n.e.c.", "", ""],
  ["NORTHERN SPROCKET LTD", "99000077", "", "", "UNIT 9", "", "CARLISLE", "CUMBRIA", "ENGLAND", "CA1 9ZZ",
    "Private Limited Company", "Active", "United Kingdom", "", "21/08/2018", "29320 - Manufacture of other parts and accessories for motor vehicles", "", "", ""]
]));

/* Kumu: JSON blueprint and Excel workbook. */
write("kumu-map.json", JSON.stringify({
  elements: [
    { _id: "elem-larder", attributes: { label: "Allendale Larder", "element type": "Organization", tags: ["food"] } },
    { _id: "elem-network", attributes: { label: "Tynedale Food Network", "element type": "Project", description: "A network of food projects in the valley.", tags: ["food", "network"] } },
    { _id: "elem-repair", attributes: { label: "Riverside Repair Cafe", "element type": "Organization" } }
  ],
  connections: [
    { _id: "conn-1", from: "elem-larder", to: "elem-network", direction: "directed", attributes: { "connection type": "member of" } },
    { _id: "conn-2", from: "elem-repair", to: "elem-network", direction: "directed", attributes: { "connection type": "member of" } }
  ]
}, null, 2));

/* Kumu: a cause-and-effect (systems) map. "+" means more leads to more; "-" more leads to less. */
const factors = ["Volunteer capacity", "Meals served", "Community trust", "Food donations", "Food sent to landfill",
  "Household food insecurity", "Demand on food services", "Staff and volunteer burnout", "Grant funding",
  "Local growing projects", "Cooking skills", "Fresh food eaten"];
const fid = (name) => "elem-" + name.toLowerCase().replace(/[^a-z]+/g, "-");
const causal = [
  ["Meals served", "Community trust", "+"], ["Community trust", "Volunteer capacity", "+"], ["Volunteer capacity", "Meals served", "+"],
  ["Community trust", "Food donations", "+"], ["Food donations", "Meals served", "+"], ["Food donations", "Food sent to landfill", "-"],
  ["Household food insecurity", "Demand on food services", "+"], ["Demand on food services", "Meals served", "+"],
  ["Meals served", "Household food insecurity", "-"], ["Meals served", "Staff and volunteer burnout", "+"],
  ["Staff and volunteer burnout", "Volunteer capacity", "-"], ["Grant funding", "Volunteer capacity", "+"],
  ["Grant funding", "Local growing projects", "+"], ["Local growing projects", "Cooking skills", "+"],
  ["Cooking skills", "Fresh food eaten", "+"], ["Fresh food eaten", "Household food insecurity", "-"],
  ["Local growing projects", "Community trust", "+"]
];
write("kumu-systems-map.json", JSON.stringify({
  elements: factors.map(name => ({ _id: fid(name), attributes: { label: name, "element type": "Factor" } })),
  connections: [
    ...causal.map(([from, to, sign], i) => ({ _id: "conn-" + (i + 1), from: fid(from), to: fid(to), direction: "directed",
      attributes: { "connection type": sign === "+" ? "increases" : "decreases", polarity: sign } })),
    { _id: "conn-related", from: fid("Cooking skills"), to: fid("Community trust"), direction: "undirected", attributes: { "connection type": "related to" } }
  ]
}, null, 2));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i) => { let s = ""; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
export function buildXlsx(sheets) {
  const strings = [], at = new Map();
  const si = (v) => { if (!at.has(v)) { at.set(v, strings.length); strings.push(v); } return at.get(v); };
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
  };
  sheets.forEach((s, i) => {
    const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => v === "" ? "" : typeof v === "number"
      ? `<c r="${colName(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${colName(ci)}${ri + 1}" t="s"><v>${si(v)}</v></c>`).join("")}</row>`).join("");
    files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
  });
  files["xl/sharedStrings.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map(s => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`;
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}
writeFileSync(resolve(out, "kumu-map.xlsx"), buildXlsx([
  { name: "Elements", rows: [["Label", "Type", "Description", "Tags", "Postcode"],
    ["Hexmoor Youth Project", "Organization", "Youth work in the town.", "young people|mentoring", "NE46 1ZZ"],
    ["Tynedale Food Network", "Project", "A network of food projects in the valley.", "food|network", ""],
    ["Larkspur Community Trust", "Funder", "", "", ""]] },
  { name: "Connections", rows: [["From", "To", "Type", "Direction"],
    ["Hexmoor Youth Project", "Tynedale Food Network", "partner", "mutual"],
    ["Larkspur Community Trust", "Hexmoor Youth Project", "funds", "directed"]] }
]));
console.log("wrote kumu-map.xlsx");
