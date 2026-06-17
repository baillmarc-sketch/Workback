"use client";

import { useState } from "react";
import {
  actualsTotals,
  actualValue,
  columnAdjustmentAmount,
  committedValue,
  effectiveAdjustmentValue,
  lineEntries,
  lineEstimate,
  resolveActualsSource,
  sectionActualsTotals,
} from "@/lib/estimator/totals";
import { formatCurrency, formatCurrencySigned, formatPct } from "@/lib/estimator/format";
import type { LedgerKind } from "@/lib/estimator/types";
import { useEstimate } from "@/state/estimateStore";
import LedgerPopover from "./LedgerPopover";

type Anchor = { left: number; top: number; right: number; bottom: number };
function rectToAnchor(r: DOMRect): Anchor {
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

const LABEL_W = 240;
const COL_W = 140;

/**
 * The Actuals view (a running cost report): Estimate (from the awarded/chosen
 * column) vs Committed (Σ POs) vs Actual (Σ invoices), with Outstanding
 * (committed − actual) and Remaining (estimate − actual). Clicking a Committed
 * or Actual cell opens its PO / invoice ledger.
 */
export default function ActualsGrid() {
  const { estimate, patch } = useEstimate();
  const [edit, setEdit] = useState<{ id: string; label: string; kind: LedgerKind; anchor: Anchor } | null>(null);
  if (!estimate) return null;

  const currency = estimate.currency;
  const sourceId = resolveActualsSource(estimate) ?? "";
  const rowWidth = LABEL_W + COL_W * 5;

  const labelCell = (content: React.ReactNode, extra = "") => (
    <div
      className={`sticky left-0 z-10 flex shrink-0 items-center gap-1 bg-surface px-3 ${extra}`}
      style={{ width: LABEL_W }}
    >
      {content}
    </div>
  );

  const numCell = (text: React.ReactNode, extra = "") => (
    <div
      className={`flex h-9 shrink-0 items-center justify-end border-l border-hairline px-3 text-[13px] tabular-nums ${extra}`}
      style={{ width: COL_W }}
    >
      {text}
    </div>
  );

  // A clickable Committed/Actual cell: shows the summed value + entry count,
  // opens the PO/invoice ledger. Works for line items and for adjustments
  // (ledger entries keyed by the adjustment's id).
  const ledgerCell = (id: string, label: string, kind: LedgerKind, value: number) => {
    const count = lineEntries(estimate, id, kind).length;
    return (
      <button
        className="flex h-9 shrink-0 flex-col items-end justify-center border-l border-hairline px-3 text-right tabular-nums hover:bg-paper"
        style={{ width: COL_W }}
        onClick={(e) => setEdit({ id, label, kind, anchor: rectToAnchor(e.currentTarget.getBoundingClientRect()) })}
      >
        {count > 0 ? (
          <>
            <span className="text-[13px]">{formatCurrency(value, currency)}</span>
            <span className="text-[9.5px] text-ink-faint">
              {count} {kind === "po" ? "PO" : "inv"}
              {count === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <span className="text-[13px] text-ink-faint">+</span>
        )}
      </button>
    );
  };

  const headers = ["Estimate", "Committed", "Actual", "Outstanding", "Remaining"];
  // Line items roll up to a net subtotal; project adjustments (markup,
  // insurance, tax) sit below as their own trackable lines — Estimate from the
  // percent on the source column, Committed/Actual logged via the ledger keyed
  // by the adjustment id. Total = net subtotal + adjustments.
  const lineGrand = actualsTotals(estimate, sourceId);
  const adjLines = estimate.adjustments.map((adj) => {
    const est = columnAdjustmentAmount(estimate, sourceId, adj);
    const committed = committedValue(estimate, adj.id);
    const act = actualValue(estimate, adj.id);
    return { adj, est, committed, act, outstanding: committed - act, remaining: est - act };
  });
  const adjSum = adjLines.reduce(
    (a, r) => ({ est: a.est + r.est, committed: a.committed + r.committed, act: a.act + r.act }),
    { est: 0, committed: 0, act: 0 }
  );
  const totalEst = lineGrand.estimate + adjSum.est;
  const totalCommitted = lineGrand.committed + adjSum.committed;
  const totalActual = lineGrand.actual + adjSum.act;
  const totalOutstanding = totalCommitted - totalActual;
  const totalRemaining = totalEst - totalActual;
  const grandOver = totalActual - totalEst;

  return (
    <div>
      {/* Estimate source selector */}
      <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-soft">
        <span>Estimate from</span>
        <select
          className="rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] font-medium text-ink"
          value={sourceId}
          onChange={(e) => patch((est) => ({ ...est, actualsSourceColumnId: e.target.value || undefined }))}
        >
          {estimate.columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.id === estimate.awardedColumnId ? " (awarded)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        <div style={{ width: rowWidth, minWidth: "100%" }}>
          {/* Header */}
          <div className="flex border-b border-hairline-strong bg-surface">
            {labelCell(<span className="text-[12px] font-medium text-ink-faint">Line item</span>, "h-9")}
            {headers.map((h) => (
              <div
                key={h}
                className="flex h-9 shrink-0 items-center justify-end border-l border-hairline px-3 text-[11px] font-semibold tracking-wide text-ink-faint uppercase"
                style={{ width: COL_W }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Sections */}
          {estimate.sections.map((section) => {
            const sub = sectionActualsTotals(estimate, section.id, sourceId);
            return (
              <div key={section.id}>
                <div className="flex border-b border-hairline bg-paper/60">
                  {labelCell(<span className="font-display text-[13.5px] font-semibold">{section.name}</span>, "h-9")}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="shrink-0 border-l border-hairline" style={{ width: COL_W }} />
                  ))}
                </div>

                {section.lineItemIds.map((liId) => {
                  const li = estimate.lineItems[liId];
                  if (!li) return null;
                  const est = lineEstimate(estimate, liId, sourceId);
                  const committed = committedValue(estimate, liId);
                  const act = actualValue(estimate, liId);
                  const outstanding = committed - act;
                  const remaining = est - act;
                  return (
                    <div key={liId} className="flex border-b border-hairline">
                      {labelCell(<span className="truncate text-[13px]">{li.label || "Line item"}</span>, "h-9")}
                      {numCell(est ? formatCurrency(est, currency) : <span className="text-ink-faint">—</span>, "text-ink-soft")}
                      {ledgerCell(liId, li.label || "Line item", "po", committed)}
                      {ledgerCell(liId, li.label || "Line item", "invoice", act)}
                      {numCell(outstanding ? formatCurrency(outstanding, currency) : <span className="text-ink-faint">—</span>)}
                      {numCell(formatCurrency(remaining, currency), remaining < 0 ? "text-danger" : "text-ink")}
                    </div>
                  );
                })}

                {/* Section subtotal */}
                <div className="flex border-b border-hairline-strong bg-paper/40">
                  {labelCell(
                    <span className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                      Subtotal · {section.name}
                    </span>,
                    "h-8"
                  )}
                  {[sub.estimate, sub.committed, sub.actual, sub.outstanding, sub.remaining].map((n, i) => (
                    <div
                      key={i}
                      className={`flex h-8 shrink-0 items-center justify-end border-l border-hairline px-3 text-[12.5px] font-medium tabular-nums ${
                        i === 4 && n < 0 ? "text-danger" : ""
                      }`}
                      style={{ width: COL_W }}
                    >
                      {formatCurrency(n, currency)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Net subtotal (line items) */}
          <div className="flex border-b border-hairline bg-paper/40">
            {labelCell(<span className="text-[12.5px] font-medium">Net Subtotal</span>, "h-9")}
            {[lineGrand.estimate, lineGrand.committed, lineGrand.actual, lineGrand.outstanding, lineGrand.remaining].map((n, i) => (
              <div
                key={i}
                className={`flex h-9 shrink-0 items-center justify-end border-l border-hairline px-3 text-[12.5px] font-medium tabular-nums ${
                  i === 4 && n < 0 ? "text-danger" : ""
                }`}
                style={{ width: COL_W }}
              >
                {formatCurrency(n, currency)}
              </div>
            ))}
          </div>

          {/* Adjustments — Estimate from the %, Committed/Actual are trackable */}
          {adjLines.length > 0 && (
            <>
              <div className="flex border-b border-hairline bg-paper/60">
                {labelCell(
                  <span className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">Adjustments</span>,
                  "h-8"
                )}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="shrink-0 border-l border-hairline" style={{ width: COL_W }} />
                ))}
              </div>
              {adjLines.map(({ adj, est, committed, act, outstanding, remaining }) => {
                const rate = adj.type === "percent" ? effectiveAdjustmentValue(estimate, sourceId, adj) : null;
                return (
                  <div key={adj.id} className="flex border-b border-hairline">
                    {labelCell(
                      <span className="truncate text-[13px]">
                        {adj.label}
                        {rate !== null && <span className="ml-1 text-[11px] text-ink-faint">({formatPct(rate)})</span>}
                      </span>,
                      "h-9"
                    )}
                    {numCell(est ? formatCurrency(est, currency) : <span className="text-ink-faint">—</span>, "text-ink-soft")}
                    {ledgerCell(adj.id, adj.label, "po", committed)}
                    {ledgerCell(adj.id, adj.label, "invoice", act)}
                    {numCell(outstanding ? formatCurrency(outstanding, currency) : <span className="text-ink-faint">—</span>)}
                    {numCell(formatCurrency(remaining, currency), remaining < 0 ? "text-danger" : "text-ink")}
                  </div>
                );
              })}
            </>
          )}

          {/* Grand total incl. adjustments */}
          <div className="flex bg-paper/70">
            {labelCell(<span className="font-display text-[14px] font-semibold">Total</span>, "h-11")}
            {[totalEst, totalCommitted, totalActual, totalOutstanding].map((n, i) => (
              <div
                key={i}
                className="flex h-11 shrink-0 items-center justify-end border-l border-hairline px-3 text-[14px] font-semibold tabular-nums"
                style={{ width: COL_W }}
              >
                {formatCurrency(n, currency)}
              </div>
            ))}
            {/* Remaining + over/under */}
            <div
              className={`flex h-11 shrink-0 flex-col items-end justify-center border-l border-hairline px-3 tabular-nums ${
                totalRemaining < 0 ? "text-danger" : ""
              }`}
              style={{ width: COL_W }}
            >
              <span className="text-[14px] font-semibold">{formatCurrency(totalRemaining, currency)}</span>
              <span
                className={`text-[9.5px] ${
                  grandOver > 0 ? "text-danger" : grandOver < 0 ? "text-[#15803d]" : "text-ink-faint"
                }`}
              >
                {formatCurrencySigned(grandOver, currency)} {grandOver > 0 ? "over" : grandOver < 0 ? "under" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {edit && (
        <LedgerPopover
          lineItemId={edit.id}
          kind={edit.kind}
          lineItemLabel={edit.label}
          currency={currency}
          anchor={edit.anchor}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}
