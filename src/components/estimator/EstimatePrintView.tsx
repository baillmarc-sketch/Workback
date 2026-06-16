"use client";

import { Fragment } from "react";
import {
  adjustmentAmount,
  columnSubtotal,
  columnSubtotalHigh,
  columnTotal,
  columnTotalHigh,
  sectionSubtotal,
  sectionSubtotalHigh,
} from "@/lib/estimator/totals";
import { formatCurrency, formatPct } from "@/lib/estimator/format";
import { cellKey } from "@/lib/estimator/types";
import { useEstimate } from "@/state/estimateStore";

export interface PrintConfig {
  columnIds: string[];
  showInfo: boolean;
  showDeliverables: boolean;
  showAssumptions: boolean;
}

export function defaultPrintConfig(e: { columns: { id: string }[]; awardedColumnId?: string; baselineColumnId?: string; deliverables: unknown[]; assumptions: string }): PrintConfig {
  const presented = e.awardedColumnId ?? e.baselineColumnId ?? e.columns[0]?.id;
  return {
    columnIds: presented ? [presented] : e.columns.map((c) => c.id),
    showInfo: true,
    showDeliverables: e.deliverables.length > 0,
    showAssumptions: e.assumptions.trim().length > 0,
  };
}

/**
 * A clean, client-ready estimate document. Hidden on screen; shown only when
 * printing (Cmd/Ctrl+P → Save as PDF) via the `print-only` + `estimate-print`
 * classes, which also force a portrait letter page in globals.css.
 */
export default function EstimatePrintView({ config }: { config: PrintConfig }) {
  const { estimate } = useEstimate();
  if (!estimate) return null;

  const cur = estimate.currency;
  const cols = estimate.columns.filter((c) => config.columnIds.includes(c.id));
  const presentCols = cols.length ? cols : estimate.columns.slice(0, 1);
  const showSpecs = estimate.deliverablesShowSpecs !== false;
  const fmt = (colId: string, low: number, high: number) => {
    const col = estimate.columns.find((c) => c.id === colId);
    return col?.range && high !== low ? `${formatCurrency(low, cur)} – ${formatCurrency(high, cur)}` : formatCurrency(low, cur);
  };

  const th = "border-b-2 border-black px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide";
  const tdNum = "border-b border-[#ddd] px-2 py-1 text-right text-[12px] tabular-nums";
  const tdLabel = "border-b border-[#ddd] px-2 py-1 text-[12px]";

  return (
    <div className="estimate-print print-only">
      {/* Header */}
      <div style={{ borderBottom: "3px solid #000", paddingBottom: 8, marginBottom: 14 }} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-bold leading-tight">{estimate.title || "Estimate"}</h1>
          {estimate.subtitle && <div className="text-[13px] text-[#444]">{estimate.subtitle}</div>}
          <div className="mt-1 text-[11px] text-[#666]">
            Estimate · {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
        {estimate.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={estimate.logoUrl} alt="Logo" style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain" }} />
        )}
      </div>

      {/* Project info */}
      {config.showInfo && estimate.fields.some((f) => f.label || f.value) && (
        <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1">
          {estimate.fields
            .filter((f) => f.label || f.value)
            .map((f) => (
              <div key={f.id} className="flex justify-between border-b border-[#eee] py-0.5 text-[12px]">
                <span className="font-semibold text-[#555]">{f.label}</span>
                <span className="text-right">{f.value}</span>
              </div>
            ))}
        </div>
      )}

      {/* Deliverables */}
      {config.showDeliverables && estimate.deliverables.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-1 text-[12px] font-bold uppercase tracking-wide">Deliverables</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className={th}>Title</th>
                {showSpecs && <th className={th}>Length</th>}
                {showSpecs && <th className={th}>Usage</th>}
              </tr>
            </thead>
            <tbody>
              {estimate.deliverables.map((d) => (
                <tr key={d.id}>
                  <td className={tdLabel}>{d.title}</td>
                  {showSpecs && <td className={tdLabel}>{d.length}</td>}
                  {showSpecs && <td className={tdLabel}>{d.usage}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Budget */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className={th}>Description</th>
            {presentCols.map((c) => (
              <th key={c.id} className={`${th} text-right`}>
                {c.role === "vendor" ? c.vendor || c.name : c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {estimate.sections.map((section) => (
            <Fragment key={section.id}>
              <tr>
                <td colSpan={1 + presentCols.length} className="bg-[#f2f2f2] px-2 py-1 text-[12px] font-bold" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                  {section.name}
                </td>
              </tr>
              {section.lineItemIds.map((liId) => {
                const li = estimate.lineItems[liId];
                if (!li) return null;
                return (
                  <tr key={liId}>
                    <td className={tdLabel}>{li.label || "—"}</td>
                    {presentCols.map((c) => {
                      const cell = estimate.cells[cellKey(liId, c.id)];
                      return (
                        <td key={c.id} className={tdNum}>
                          {cell ? fmt(c.id, cell.value, cell.high ?? cell.value) : ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr>
                <td className="px-2 py-1 text-right text-[11px] font-medium text-[#666] uppercase">Subtotal · {section.name}</td>
                {presentCols.map((c) => (
                  <td key={c.id} className="border-b border-[#bbb] px-2 py-1 text-right text-[12px] font-medium tabular-nums">
                    {fmt(c.id, sectionSubtotal(estimate, section.id, c.id), sectionSubtotalHigh(estimate, section.id, c.id))}
                  </td>
                ))}
              </tr>
            </Fragment>
          ))}

          {/* Totals */}
          <tr>
            <td className="px-2 pt-2 text-right text-[12px] font-semibold">Net Subtotal</td>
            {presentCols.map((c) => (
              <td key={c.id} className="px-2 pt-2 text-right text-[12px] font-semibold tabular-nums">
                {fmt(c.id, columnSubtotal(estimate, c.id), columnSubtotalHigh(estimate, c.id))}
              </td>
            ))}
          </tr>
          {estimate.adjustments.map((adj) => (
            <tr key={adj.id}>
              <td className="px-2 py-0.5 text-right text-[12px] text-[#555]">
                {adj.label}
                {adj.type === "percent" ? ` (${formatPct(adj.value)})` : ""}
              </td>
              {presentCols.map((c) => (
                <td key={c.id} className="px-2 py-0.5 text-right text-[12px] tabular-nums text-[#555]">
                  {fmt(c.id, adjustmentAmount(columnSubtotal(estimate, c.id), adj), adjustmentAmount(columnSubtotalHigh(estimate, c.id), adj))}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="border-t-2 border-black px-2 py-1 text-right text-[14px] font-bold">Total</td>
            {presentCols.map((c) => (
              <td key={c.id} className="border-t-2 border-black px-2 py-1 text-right text-[14px] font-bold tabular-nums">
                {fmt(c.id, columnTotal(estimate, c.id), columnTotalHigh(estimate, c.id))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* Assumptions */}
      {config.showAssumptions && estimate.assumptions.trim() && (
        <div className="mt-5">
          <h2 className="mb-1 text-[12px] font-bold uppercase tracking-wide">Assumptions</h2>
          <ul className="list-disc pl-5 text-[11.5px] leading-relaxed">
            {estimate.assumptions.split("\n").map((line, i) =>
              line.trim() ? <li key={i}>{line.trim()}</li> : null
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
