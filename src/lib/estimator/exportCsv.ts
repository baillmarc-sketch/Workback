import type { Estimate, EstimateColumn } from "./types";
import { cellKey } from "./types";
import {
  actualsTotals,
  actualValue,
  columnAdjustmentAmount,
  baselineColumnId,
  columnDelta,
  columnSubtotal,
  columnSubtotalHigh,
  columnTotal,
  columnTotalHigh,
  committedValue,
  effectiveAdjustmentValue,
  lineEstimate,
  resolveActualsSource,
  sectionActualsTotals,
  sectionSubtotal,
  sectionSubtotalHigh,
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

  // Project info
  if (estimate.fields.some((f) => f.label || f.value)) {
    for (const f of estimate.fields) {
      if (f.label || f.value) lines.push(row([f.label, f.value]));
    }
    lines.push("");
  }

  // Deliverables (Length/Usage hidden for events)
  if (estimate.deliverables.length) {
    const specs = estimate.deliverablesShowSpecs !== false;
    lines.push(row(specs ? ["Deliverables", "Length", "Usage"] : ["Deliverables"]));
    for (const d of estimate.deliverables) lines.push(row(specs ? [d.title, d.length, d.usage] : [d.title]));
    lines.push("");
  }

  // Range columns export "low-high"; others a plain number.
  const rng = (c: EstimateColumn, low: number, high: number): string | number =>
    c.range && high !== low ? `${low}-${high}` : low;

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
          ...columns.map((c) => {
            const cell = estimate.cells[cellKey(liId, c.id)];
            return rng(c, cell?.value ?? 0, cell?.high ?? cell?.value ?? 0);
          }),
        ])
      );
    }
    lines.push(
      row([
        `Subtotal — ${section.name}`,
        ...columns.map((c) => rng(c, sectionSubtotal(estimate, section.id, c.id), sectionSubtotalHigh(estimate, section.id, c.id))),
      ])
    );
  }

  lines.push(row(["Net Subtotal", ...columns.map((c) => rng(c, columnSubtotal(estimate, c.id), columnSubtotalHigh(estimate, c.id)))]));
  for (const adj of estimate.adjustments) {
    const label = adj.type === "percent" ? `${adj.label} (${adj.value}%)` : adj.label;
    lines.push(
      row([
        label,
        ...columns.map((c) =>
          effectiveAdjustmentValue(estimate, c.id, adj) === null
            ? ""
            : rng(c, columnAdjustmentAmount(estimate, c.id, adj, false), columnAdjustmentAmount(estimate, c.id, adj, true))
        ),
      ])
    );
  }
  lines.push(row(["Total", ...columns.map((c) => rng(c, columnTotal(estimate, c.id), columnTotalHigh(estimate, c.id)))]));

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

/** Build a CSV of the Actuals view (cost report): Estimate / Committed / Actual
    / Outstanding / Remaining per line, with section subtotals, a grand total,
    and a PO/invoice ledger detail. */
export function buildActualsCsv(estimate: Estimate): string {
  const sourceId = resolveActualsSource(estimate) ?? "";
  const lines: string[] = [];
  lines.push(row(["", "Estimate", "Committed", "Actual", "Outstanding", "Remaining"]));

  for (const section of estimate.sections) {
    lines.push(row([section.name]));
    for (const liId of section.lineItemIds) {
      const li = estimate.lineItems[liId];
      if (!li) continue;
      const est = lineEstimate(estimate, liId, sourceId);
      const committed = committedValue(estimate, liId);
      const act = actualValue(estimate, liId);
      lines.push(row([li.label || "", est, committed, act, committed - act, est - act]));
    }
    const sub = sectionActualsTotals(estimate, section.id, sourceId);
    lines.push(row([`Subtotal — ${section.name}`, sub.estimate, sub.committed, sub.actual, sub.outstanding, sub.remaining]));
  }

  const g = actualsTotals(estimate, sourceId);
  lines.push(row(["Net Subtotal", g.estimate, g.committed, g.actual, g.outstanding, g.remaining]));

  // Project adjustments as their own trackable lines (Estimate from the %,
  // Committed/Actual from ledger entries keyed by the adjustment id).
  let adjEst = 0;
  let adjCommitted = 0;
  let adjActual = 0;
  for (const adj of estimate.adjustments) {
    const est = columnAdjustmentAmount(estimate, sourceId, adj);
    const committed = committedValue(estimate, adj.id);
    const act = actualValue(estimate, adj.id);
    adjEst += est;
    adjCommitted += committed;
    adjActual += act;
    lines.push(row([adj.label, est, committed, act, committed - act, est - act]));
  }

  const tEst = g.estimate + adjEst;
  const tCommitted = g.committed + adjCommitted;
  const tActual = g.actual + adjActual;
  lines.push(row(["Total", tEst, tCommitted, tActual, tCommitted - tActual, tEst - tActual]));
  lines.push(row(["Over / (under)", "", "", "", "", tActual - tEst]));

  if (estimate.ledger.length) {
    lines.push("");
    lines.push(row(["PO & invoice ledger"]));
    lines.push(row(["Line item", "Type", "Ref", "Vendor", "Date", "Amount"]));
    for (const section of estimate.sections) {
      for (const liId of section.lineItemIds) {
        const label = estimate.lineItems[liId]?.label || "";
        for (const x of estimate.ledger.filter((e) => e.lineItemId === liId)) {
          lines.push(row([label, x.kind === "po" ? "PO" : "Invoice", x.ref ?? "", x.vendor ?? "", x.date ?? "", x.amount]));
        }
      }
    }
  }

  return lines.join("\n");
}
