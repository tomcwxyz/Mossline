import type { NodeType } from "@mossline/graph-core";

/** Colour values for canvas/WebGL renderers. They mirror the CSS tokens in
 *  field-atlas.css (Sigma and MapLibre cannot read CSS custom properties). */
export type AtlasTheme = "day" | "night";
export interface AtlasPalette {
  paper: string; raised: string; sea: string; seaLine: string; coast: string;
  ink: string; inkSoft: string; inkFaint: string; pencil: string; pencilSoft: string; wash: string; washLine: string;
  moss: string; dim: string; label: string; labelPlate: string; areaLabel: string;
  types: Record<NodeType, string>;
}
export const PALETTES: Record<AtlasTheme, AtlasPalette> = {
  day: {
    paper: "#F2F1EC", raised: "#FBFAF6", sea: "#DCE4E2", seaLine: "#A9BCBE", coast: "#7E8D84",
    ink: "#1F2622", inkSoft: "rgba(31,38,34,0.22)", inkFaint: "rgba(31,38,34,0.07)", pencil: "#7A7E76", pencilSoft: "rgba(122,126,118,0.45)",
    wash: "#6E8C55", washLine: "#5D7A4A", moss: "#4F6F3E", dim: "#C9CCC2",
    label: "#1F2622", labelPlate: "rgba(242,241,236,0.86)", areaLabel: "#38432F",
    types: {
      organisation: "#4F7A44", project: "#B87A2B", funder: "#2F5F86", place: "#857D6B",
      person: "#8F5E86", topic: "#6F746C", methodology: "#6F746C", outcome: "#6F746C", other: "#6F746C"
    }
  },
  night: {
    paper: "#0F1915", raised: "#14211C", sea: "#0B1412", seaLine: "#2B3F3B", coast: "#4E625A",
    ink: "#E8E6D9", inkSoft: "rgba(232,230,217,0.18)", inkFaint: "rgba(232,230,217,0.06)", pencil: "#9FAE9F", pencilSoft: "rgba(159,174,159,0.4)",
    wash: "#A9C98A", washLine: "#A9C98A", moss: "#A9C98A", dim: "#33413A",
    label: "#E8E6D9", labelPlate: "rgba(15,25,21,0.82)", areaLabel: "#E8E6D9",
    types: {
      organisation: "#93C27E", project: "#E2AA5A", funder: "#86B5DE", place: "#BDB49C",
      person: "#C99BC0", topic: "#A3A99F", methodology: "#A3A99F", outcome: "#A3A99F", other: "#A3A99F"
    }
  }
};
export type MarkShape = "circle" | "square" | "diamond" | "triangle";
export const SHAPE: Record<NodeType, MarkShape> = {
  organisation: "circle", project: "square", funder: "diamond", place: "triangle",
  person: "circle", topic: "circle", methodology: "circle", outcome: "circle", other: "circle"
};
export const TYPE_LABEL: Record<NodeType, string> = {
  organisation: "Organisation", project: "Project", funder: "Funder", person: "Person", place: "Place",
  topic: "Topic", methodology: "Method", outcome: "Outcome", other: "Other"
};
export const TYPE_PLURAL: Record<NodeType, string> = {
  organisation: "Organisations", project: "Projects", funder: "Funders", person: "People", place: "Places",
  topic: "Topics", methodology: "Methods", outcome: "Outcomes", other: "Other"
};
/** Radius in CSS pixels from recorded degree only (pencil never adds size). */
export const markSize = (degree: number, type: NodeType) =>
  Math.min(16, 3.2 + 1.05 * Math.sqrt(degree) + (type === "funder" ? 1.6 : 0));

/** Mix a hex colour towards another (used for dimming without transparency). */
export function mix(hex: string, toward: string, amount: number): string {
  const a = parse(hex), b = parse(toward);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
}
function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export const formatMoney = (value: number, currency: string | null) => {
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "USD" ? "$" : "";
  const suffix = symbol ? "" : currency ? " " + currency : "";
  if (value >= 1e6) return symbol + (value / 1e6).toFixed(value >= 1e7 ? 1 : 2) + "m" + suffix;
  if (value >= 1e3) return symbol + Math.round(value / 1e3).toLocaleString("en-GB") + "k" + suffix;
  return symbol + Math.round(value).toLocaleString("en-GB") + suffix;
};
