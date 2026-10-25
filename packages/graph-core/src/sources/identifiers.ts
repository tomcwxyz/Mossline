/**
 * Organisation identifiers in the org-id.guide form that 360Giving uses, so
 * the same organisation found in different sources can be joined without
 * relying on its name: GB-CHC (charities in England and Wales), GB-SC
 * (Scotland), GB-NIC (Northern Ireland), GB-COH (Companies House).
 */
export type IdScheme = "orgid" | "charity" | "company" | "raw" | "local";

const squash = (v: string) => v.trim().replace(/\s+/g, "").toUpperCase();

/** A registered charity number from any UK regulator → its org-id. */
export function charityOrgId(raw: string): string | null {
  const v = squash(raw).replace(/^(GB-CHC-|GB-SC-|GB-NIC-)/, "");
  if (!v || /^0+$/.test(v)) return null;
  if (/^SC\d{6}$/.test(v)) return "GB-SC-" + v;
  const ni = v.match(/^NIC?(\d{5,6})$/);
  if (ni) return "GB-NIC-" + ni[1];
  // England and Wales numbers; a "-1" style suffix marks a linked charity, which
  // the register reports under the main number.
  const ew = v.match(/^(\d{6,7})(?:-\d+)?$/);
  return ew ? "GB-CHC-" + ew[1] : null;
}

/** A Companies House number → GB-COH, padded to eight characters as registered. */
export function companyOrgId(raw: string): string | null {
  const v = squash(raw).replace(/^GB-COH-/, "");
  if (!v || /^0+$/.test(v)) return null;
  const m = v.match(/^([A-Z]{0,2})(\d{1,8})$/);
  if (!m) return null;
  const digits = m[2].padStart(8 - m[1].length, "0");
  return (m[1] + digits).length === 8 ? "GB-COH-" + m[1] + digits : null;
}

/** An identifier already in org-id form (or a 360Giving 360G- identifier). */
export function cleanOrgId(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const m = v.match(/^([A-Za-z]{2})-([A-Za-z0-9]+)-(.+)$/);
  if (m) {
    const prefix = (m[1] + "-" + m[2]).toUpperCase();
    if (prefix === "GB-CHC" || prefix === "GB-SC" || prefix === "GB-NIC") return charityOrgId(m[3]);
    if (prefix === "GB-COH") return companyOrgId(m[3]);
    return prefix + "-" + m[3].trim();
  }
  if (/^360G-/i.test(v)) return "360G-" + v.slice(5);
  return null;
}

/** Normalise a value under a scheme. Raw and local identifiers are kept as given. */
export function normaliseIdentifier(raw: string, scheme: IdScheme): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (scheme === "charity") return charityOrgId(v);
  if (scheme === "company") return companyOrgId(v);
  if (scheme === "orgid") return cleanOrgId(v) ?? null;
  return v;
}

/** Human description of an identifier, for receipts and the record panel. */
export function describeIdentifier(id: string): string {
  if (id.startsWith("GB-CHC-")) return "Charity " + id.slice(7) + " (England and Wales)";
  if (id.startsWith("GB-SC-")) return "Charity " + id.slice(6) + " (Scotland)";
  if (id.startsWith("GB-NIC-")) return "Charity " + id.slice(7) + " (Northern Ireland)";
  if (id.startsWith("GB-COH-")) return "Company " + id.slice(7);
  return id;
}
