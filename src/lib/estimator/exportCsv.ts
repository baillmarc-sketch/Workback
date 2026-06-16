import type { Estimate, EstimateColumn } from "./types";
import { cellKey } from "./types";
import {
  actualsTotals,
  actualValue,
  baselineColumnId,
  columnDelta,
  columnSubtotal,
  columnTotal,
  committedValue,
  contingencyAmount,
  lineEstimate,
  markupAmount,
  resolveActualsSource,
  sectionActualsTotals,
  sectionSubtotal,
} from "./totals";

/** RFC-4180 cell escaping: wrap in quotes when the value has a comma, quote,
    or newline, and double any embedded quotes. */
export function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

/** Build a CSV of the estimate over the given columns (the visible set for the
    current view). Numbers are raw (unformatted) so the file stays spreadsheet
    friendly; structure mirrors the on-screen grid including the totals block. */
export function buildEstimateCsv(estimate: Estimate, columns: EstimateColumn[]): string {
  const lines: string[] = [];
  const colNames = columns.map((c) => (c.role === "vendor" ? c.vendor || c.name : c.name));
  lines.push(row(["", ...colNames]));

  for (const section of estimate.sections) {
    lines.push(row([section.name]));
    for (const liId of section.lineItemIds) {
      const li = estimate.lineItems[liId];
      if (!li) continue;
      lines.push(
        row([
          li.label || "",
          ...columns.map((c) => estimate.cells[cellKey(liId, c.id)]?.value ?? 0),
        ])
      );
    }
    lines.push(row([`Subtotal — ${section.name}`, ...columns.map((c) => sectionSubtotal(estimate, section.id, c.id))]));
  }

  lines.push(row(["Subtotal", ...columns.map((c) => columnSubtotal(estimate, c.id))]));
  lines.push(row(["Markup", ...columns.map((c) => markupAmount(columnSubtotal(estimate, c.id), c.markupPct))]));
  lines.push(
    row(["Contingency", ...columns.map((c) => contingencyAmount(columnSubtotal(estimate, c.id), c.contingencyPct))])
  );
  lines.push(row(["Total", ...columns.map((c) => columnTotal(estimate, c.id))]));

  const baseId = baselineColumnId(estimate);
  if (baseId) {
    lines.push(
      row([
        "Delta vs baseline",
        ...columns.map((c) => (c.id === baseId ? 0 : columnDelta(estimate, c.id, baseId).abs)),
      ])
    );
  }

  if (estimate.assumptions.trim()) {
    lines.push("");
    lines.push(row(["Assumptions"]));
    for (const line of estimate.assumptions.split("\n")) {
      if (line.trim()) lines.push(row([line.trim()]));
    }
  }

  return lines.join("\n");
}

/** Build a CSV of the Actuals view: Estimate / Committed / Actual / Remaining
    per line, with section subtotals and a grand total. */
export function buildActualsCsv(estimate: Estimate): string {
  const sourceId = resolveActualsSource(estimate) ?? "";
  const lines: string[] = [];
  lines.push(row(["", "Estimate", "Committed", "Actual", "Remaining"]));

  for (const section of estimate.sections) {
    lines.push(row([section.name]));
    for (const liId of section.lineItemIds) {
      const li = estimate.lineItems[liId];
      if (!li) continue;
      const est = lineEstimate(estimate, liId, sourceId);
      const act = actualValue(estimate, liId);
      lines.push(row([li.label || "", est, committedValue(estimate, liId), act, est - act]));
    }
    const sub = sectionActualsTotals(estimate, section.id, sourceId);
    lines.push(row([`Subtotal — ${section.name}`, sub.estimate, sub.committed, sub.actual, sub.remaining]));
  }

  const g = actualsTotals(estimate, sourceId);
  lines.push(row(["Total", g.estimate, g.committed, g.actual, g.remaining]));
  lines.push(row(["Over / (under)", "", "", "", g.actual - g.estimate]));
  return lines.join("\n");
}
