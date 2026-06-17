import type { BidSpec } from "./types";

/** Render a bid spec as a plain-text / Markdown document for copy or download. */
export function specToText(spec: BidSpec): string {
  const out: string[] = [];
  const h = (t: string) => out.push("", `## ${t}`);

  out.push(`# ${spec.title || "Bid Specs"}`);
  if (spec.subtitle) out.push(spec.subtitle);
  out.push("Confidential — Commercial Bid Specs");

  h("Project & job");
  for (const f of spec.fields) if (f.label || f.value) out.push(`- ${f.label}: ${f.value || "—"}`);

  if (spec.contacts.some((c) => c.role || c.name || c.contact)) {
    h("Production team");
    for (const c of spec.contacts) if (c.role || c.name || c.contact) out.push(`- ${c.role}: ${c.name}${c.contact ? ` (${c.contact})` : ""}`);
  }

  if (spec.specs.some((c) => c.title || c.length || c.versions)) {
    h("Commercial specs");
    for (const c of spec.specs) if (c.title || c.length || c.versions) out.push(`- ${c.title} · ${c.length}${c.versions ? ` · ${c.versions}` : ""}`);
  }

  h("Bidding format");
  out.push(`- Bid type: ${spec.format.bidType === "firm" ? "Firm bid" : "Cost-plus / actualized"}`);
  out.push(`- AICP form: ${spec.format.aicpForm || "—"}`);
  out.push(`- Union: ${spec.format.union || "—"}`);
  out.push(`- Bidders: ${spec.format.bidders || "—"}`);
  const flags = spec.format.flags.filter((f) => f.on).map((f) => f.label);
  if (flags.length) out.push(`- Flags: ${flags.join(" · ")}`);

  h("Agency vs production provided");
  out.push("Agency provided: " + (spec.checklist.filter((c) => c.provider === "A").map((c) => c.label).join(", ") || "—"));
  out.push("Production provided: " + (spec.checklist.filter((c) => c.provider === "P").map((c) => c.label).join(", ") || "—"));

  if (spec.techSpecs.some((t) => t.label || t.value)) {
    h("Deliverable tech specs");
    for (const t of spec.techSpecs) if (t.label || t.value) out.push(`- ${t.label}: ${t.value}`);
  }

  if (spec.usage.some((u) => u.deliverable || u.media)) {
    h("Usage & rights");
    for (const u of spec.usage)
      if (u.deliverable || u.media)
        out.push(`- ${u.deliverable} — ${[u.media, u.territory, u.term, u.exclusivity, u.options].filter(Boolean).join(" · ")}`);
    if (spec.usageNote) out.push("", spec.usageNote);
  }

  const clauses = spec.clauses.filter((c) => c.on);
  if (clauses.length) {
    h("Production terms");
    for (const c of clauses) out.push("", `**${c.title}.** ${c.body}`);
  }

  if (spec.signatureNote) {
    h("Acknowledgement");
    out.push(spec.signatureNote);
  }

  return out.join("\n");
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Render the provided-by checklist as CSV (Element, Provided by). */
export function checklistToCsv(spec: BidSpec): string {
  const label: Record<string, string> = { A: "Agency", P: "Production Co.", NA: "N/A" };
  const rows = [["Element", "Provided by"], ...spec.checklist.map((c) => [c.label, label[c.provider] ?? c.provider])];
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
