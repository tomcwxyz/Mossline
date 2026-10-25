import { parseShape, type Shape, type ShapeInput } from "./shape";

/**
 * Ready-made shapes for sources people commonly hold. They are data, read by
 * the same engine as any shape a person adjusts, not separate importers.
 * Alternatives inside braces cover CSV headings and flattened JSON keys.
 */
const notLinked = { when: "{linked_charity_number}", notEquals: ["0", ""],
  reason: "Linked charities are listed under their main charity number" };

const giving360: ShapeInput = {
  kind: "mossline-shape", version: 1, id: "360giving-grants", name: "360Giving grants",
  each: "Each row is a grant from a funder to an organisation.",
  about: "The 360Giving Standard, from GrantNav or a funder's own file (CSV or JSON). Organisations are joined by their org-id, charity or company number.",
  match: { all: ["Identifier|id", "Funding Org:Name|fundingOrganization.0.name", "Recipient Org:Name|recipientOrganization.0.name"],
    any: ["Amount Awarded|amountAwarded", "Award Date|awardDate", "Funding Org:Identifier|fundingOrganization.0.id", "Recipient Org:Identifier|recipientOrganization.0.id"] },
  skip: [{ when: "{Recipient Ind:Identifier|Recipient Ind:Name|recipientIndividual.id|recipientIndividual.name}", reason: "Grants to individuals are left out" }],
  records: [
    { key: "funder", type: "funder", label: "{Funding Org:Name|fundingOrganization.0.name}",
      identifiers: [{ value: "{Funding Org:Identifier|fundingOrganization.0.id}", scheme: "orgid" }] },
    { key: "recipient", type: "organisation", label: "{Recipient Org:Name|recipientOrganization.0.name}",
      identifiers: [
        { value: "{Recipient Org:Identifier|recipientOrganization.0.id}", scheme: "orgid" },
        { value: "{Recipient Org:Charity Number|recipientOrganization.0.charityNumber}", scheme: "charity" },
        { value: "{Recipient Org:Company Number|recipientOrganization.0.companyNumber}", scheme: "company" }],
      region: "{Recipient Region|Recipient Org:Location:0:Name|recipientOrganization.0.location.0.name}",
      place: { postcode: "{Recipient Org:Postal Code|recipientOrganization.0.postalCode}",
        latitude: "{Recipient Org:Latitude|recipientOrganization.0.latitude}", longitude: "{Recipient Org:Longitude|recipientOrganization.0.longitude}" } },
    { key: "grant", type: "project", label: "{Title|title|Identifier|id}",
      identifiers: [{ value: "{Identifier|id}", scheme: "raw" }],
      description: "{Description|description}",
      tags: [{ value: "{Classifications:0:Title|classifications.0.title}" }, { value: "{Classifications:1:Title|classifications.1.title}" }],
      fields: "row",
      grant: { from: "funder", to: "recipient", amount: "{Amount Awarded|amountAwarded}", currency: "{Currency|currency}",
        date: "{Award Date|awardDate}", programme: "{Grant Programme:Title|grantProgramme.0.title}" } }
  ],
  links: []
};

const charity: ShapeInput = {
  kind: "mossline-shape", version: 1, id: "charity-commission-charity", name: "Charity Commission: charities",
  each: "Each row is a registered charity in England and Wales.",
  about: "The charity table from the register download (tab-separated text or JSON). Joins on charity number, and on company number for charitable companies.",
  match: { all: ["registered_charity_number", "charity_name"], any: ["charity_registration_status", "charity_contact_postcode", "organisation_number", "latest_income"] },
  skip: [notLinked],
  records: [{ key: "charity", type: "organisation", label: "{charity_name}", labelCase: "title",
    identifiers: [{ value: "{registered_charity_number}", scheme: "charity" }, { value: "{charity_company_registration_number}", scheme: "company" }],
    description: "{charity_activities}", place: { postcode: "{charity_contact_postcode}" }, fields: "row",
    properties: { "Charity status": "{charity_registration_status}", "Registered": "{date_of_registration}",
      "Latest income": "{latest_income}", "Latest spending": "{latest_expenditure}", "Website": "{charity_contact_web}" } }]
};

const trustees: ShapeInput = {
  kind: "mossline-shape", version: 1, id: "charity-commission-trustees", name: "Charity Commission: trustees",
  each: "Each row is a trustee of a charity. These rows name individuals.",
  about: "The charity_trustee table. Adds trustees as people and links them to the charities they serve.",
  match: { all: ["trustee_name", "registered_charity_number"], any: ["trustee_id", "trustee_is_chair", "individual_or_organisation"] },
  skip: [notLinked],
  records: [{ key: "trustee", type: "{individual_or_organisation}", typeMap: { P: "person", O: "organisation" }, typeFallback: "person",
    label: "{trustee_name}", labelCase: "title", identifiers: [{ value: "CC-TRUSTEE-{trustee_id}", scheme: "raw" }] }],
  links: [{ from: "trustee", to: { ref: "{registered_charity_number}", scheme: "charity" }, type: "trustee of", direction: "directed",
    properties: { "Start Date": "{trustee_date_of_appointment}", "Chair": "{trustee_is_chair}" } }]
};

const classification: ShapeInput = {
  kind: "mossline-shape", version: 1, id: "charity-commission-classification", name: "Charity Commission: what and who",
  each: "Each row is one thing a charity does, or one group it serves.",
  about: "The charity_classification table. Adds 'what' and 'who' descriptions as themes on charities already present.",
  match: { all: ["classification_description", "registered_charity_number"], any: ["classification_type", "classification_code"] },
  skip: [notLinked, { when: "{classification_type}", equals: ["How"], reason: "How a charity works is not used as a theme" }],
  records: [{ key: "charity", type: "organisation", label: "{registered_charity_number}", existingOnly: true,
    identifiers: [{ value: "{registered_charity_number}", scheme: "charity" }], tags: [{ value: "{classification_description}" }] }]
};

const area: ShapeInput = {
  kind: "mossline-shape", version: 1, id: "charity-commission-area", name: "Charity Commission: where they work",
  each: "Each row is one area a charity says it operates in.",
  about: "The charity_area_of_operation table. Kept as 'Area of operation' on charities already present; it is not used to place them on the map.",
  match: { all: ["geographic_area_description", "registered_charity_number"], any: ["geographic_area_type"] },
  skip: [notLinked],
  records: [{ key: "charity", type: "organisation", label: "{registered_charity_number}", existingOnly: true,
    identifiers: [{ value: "{registered_charity_number}", scheme: "charity" }],
    properties: { "Area of operation": "{geographic_area_description}" } }]
};

const companies: ShapeInput = {
  kind: "mossline-shape", version: 1, id: "companies-house", name: "Companies House: companies",
  each: "Each row is a company on the Companies House register.",
  about: "The free company data product or an advanced search download. Joins on company number.",
  match: { all: ["CompanyName|company_name", "CompanyNumber|company_number"],
    any: ["CompanyStatus|company_status", "IncorporationDate|incorporation_date", "RegAddress.PostCode|registered_office_address", "SICCode.SicText_1|nature_of_business"] },
  records: [{ key: "company", type: "organisation", label: "{CompanyName|company_name}", labelCase: "title",
    identifiers: [{ value: "{CompanyNumber|company_number}", scheme: "company" }],
    place: { postcode: "{RegAddress.PostCode}", address: "{registered_office_address}" },
    tags: [{ value: "{SICCode.SicText_1}", strip: "sic" }, { value: "{SICCode.SicText_2}", strip: "sic" },
      { value: "{SICCode.SicText_3}", strip: "sic" }, { value: "{SICCode.SicText_4}", strip: "sic" },
      { value: "{nature_of_business}", split: ",", strip: "sic" }],
    fields: "row",
    properties: { "Company status": "{CompanyStatus|company_status}", "Company type": "{CompanyCategory|company_type}",
      "Incorporated": "{IncorporationDate|incorporation_date}", "Town": "{RegAddress.PostTown}" } }]
};

const kumuElements: ShapeInput = {
  kind: "mossline-shape", version: 1, id: "kumu-elements", name: "Kumu elements",
  each: "Each row is an element: a named record with a type.",
  about: "Kumu's Elements sheet (Excel) or elements array (JSON). Also suits any list with Label and Type columns.",
  match: { all: ["Label|label|attributes.label"], any: ["Type|Element Type|type|element type|attributes.element type", "Tags|tags|attributes.tags", "_id"] },
  records: [{ key: "element", type: "{Type|Element Type|type|element type|attributes.element type}", typeFallback: "other",
    label: "{Label|label|attributes.label}", identifiers: [{ value: "{ID|Id|id|_id}", scheme: "local" }],
    description: "{Description|description|attributes.description}",
    region: "{Region|region|attributes.region}",
    tags: [{ value: "{Tags|tags|attributes.tags}", split: "|" }],
    place: { latitude: "{Latitude|latitude|Lat|lat}", longitude: "{Longitude|longitude|Lng|Long|lng|lon}", postcode: "{Postcode|postcode|Post Code}" },
    fields: "row" }]
};

const kumuConnections: ShapeInput = {
  kind: "mossline-shape", version: 1, id: "kumu-connections", name: "Kumu connections",
  each: "Each row is a connection from one element to another.",
  about: "Kumu's Connections sheet or connections array. From and To name elements by ID or label.",
  match: { all: ["From|from", "To|to"], any: ["Type|Connection Type|type|connection type|attributes.connection type", "Direction|direction"] },
  records: [],
  links: [{ from: { ref: "{From|from}" }, to: { ref: "{To|to}" }, type: "{Type|Connection Type|type|connection type|attributes.connection type}",
    direction: "{Direction|direction}", description: "{Description|description|attributes.description}", fields: "row" }]
};

export const BUILT_IN_SHAPES: Shape[] = [giving360, charity, trustees, classification, area, companies, kumuElements, kumuConnections].map(parseShape);
