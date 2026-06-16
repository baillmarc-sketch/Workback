"use client";

import { useState } from "react";
import {
  actualsTotals,
  actualValue,
  committedValue,
  lineEstimate,
  lineVariance,
  resolveActualsSource,
  sectionActualsTotals,
} from "@/lib/estimator/totals";
import { formatCurrency, formatCurrencySigned, formatPctSigned } from "@/lib/estimator/format";
import type { CellValue, LineActual } from "@/lib/estimator/types";
import { useEstimate } from "@/state/estimateStore";
import CellEditorPopover from "./CellEditorPopover";

type Anchor = { left: number; top: number; right: number; bottom: number };
function rectToAnchor(r: DOMRect): Anchor {
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

type Field = "committed" | "actual";

const LABEL_W = 240;
const COL_W = 140;
const EMPTY_CELL: CellValue = { expr: "", value: 0 };

/**
 * The Actuals view: Estimate (from the awarded/chosen column) vs Committed (POs)
 * vs Actual (invoiced), with Remaining (Estimate − Actual) and a variance. The
 * Estimate column is read-only here; Committed/Actual are formula cells stored
 * on the estimate's `actuals` map.
 */
export default function ActualsGrid() {
  const { estimate, commit, patch } = useEstimate();
  const [edit, setEdit] = useState<{ lineItemId: string; field: Field; anchor: Anchor } | null>(null);
  if (!estimate) return null;

  const currency = estimate.currency;
  const sourceId = resolveActualsSource(estimate);
  const rowWidth = LABEL_W + COL_W * 5;

  const setActual = (lineItemId: string, field: Field, cell: CellValue) =>
    commit((e) => {
      const prev: LineActual = e.actuals[lineItemId] ?? { committed: { ...EMPTY_CELL }, actual: { ...EMPTY_CELL } };
      const next: LineActual = { ...prev, [field]: cell };
      const actuals = { ...e.actuals };
      if (next.committed.expr === "" && next.actual.expr === "") delete actuals[lineItemId];
      else actuals[lineItemId] = next;
      return { ...e, actuals };
    });

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

  const editable = (lineItemId: string, field: Field, value: number) => (
    <button
      className="flex h-9 shrink-0 items-center justify-end border-l border-hairline px-3 text-right text-[13px] tabular-nums hover:bg-paper"
      style={{ width: COL_W }}
      onClick={(e) => setEdit({ lineItemId, field, anchor: rectToAnchor(e.currentTarget.getBoundingClientRect()) })}
    >
      {estimate.actuals[lineItemId]?.[field]?.expr ? formatCurrency(value, currency) : <span className="text-ink-faint">—</span>}
    </button>
  );

  const headers = ["Estimate", "Committed", "Actual", "Remaining", "Var"];
  const grand = actualsTotals(estimate, sourceId ?? "");

  return (
    <div>
      {/* Estimate source selector */}
      <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-soft">
        <span>Estimate from</span>
        <select
          className="rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] font-medium text-ink"
          value={sourceId ?? ""}
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
            const sub = sectionActualsTotals(estimate, section.id, sourceId ?? "");
            return (
              <div key={section.id}>
                <div className="flex border-b border-hairline bg-paper/60">
                  {labelCell(
                    <span className="font-display text-[13.5px] font-semibold">{section.name}</span>,
                    "h-9"
                  )}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="shrink-0 border-l border-hairline" style={{ width: COL_W }} />
                  ))}
                </div>

                {section.lineItemIds.map((liId) => {
                  const li = estimate.lineItems[liId];
                  if (!li) return null;
                  const est = lineEstimate(estimate, liId, sourceId ?? "");
                  const act = actualValue(estimate, liId);
                  const remaining = est - act;
                  const v = lineVariance(act, est); // over = positive
                  return (
                    <div key={liId} className="flex border-b border-hairline">
                      {labelCell(<span className="truncate text-[13px]">{li.label || "Line item"}</span>, "h-9")}
                      {numCell(est ? formatCurrency(est, currency) : <span className="text-ink-faint">—</span>, "text-ink-soft")}
                      {editable(liId, "committed", committedValue(estimate, liId))}
                      {editable(liId, "actual", act)}
                      {numCell(
                        formatCurrency(remaining, currency),
                        remaining < 0 ? "text-danger" : "text-ink"
                      )}
                      {numCell(
                        act && v.abs !== 0 ? (
                          <span className={v.abs > 0 ? "text-danger" : "text-[#15803d]"}>{formatPctSigned(v.pct)}</span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )
                      )}
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
                  {[sub.estimate, sub.committed, sub.actual, sub.remaining].map((n, i) => (
                    <div
                      key={i}
                      className={`flex h-8 shrink-0 items-center justify-end border-l border-hairline px-3 text-[12.5px] font-medium tabular-nums ${
                        i === 3 && n < 0 ? "text-danger" : ""
                      }`}
                      style={{ width: COL_W }}
                    >
                      {formatCurrency(n, currency)}
                    </div>
                  ))}
                  <div className="shrink-0 border-l border-hairline" style={{ width: COL_W }} />
                </div>
              </div>
            );
          })}

          {/* Grand total */}
          <div className="flex bg-paper/70">
            {labelCell(<span className="font-display text-[14px] font-semibold">Total</span>, "h-11")}
            {[grand.estimate, grand.committed, grand.actual, grand.remaining].map((n, i) => (
              <div
                key={i}
                className={`flex h-11 shrink-0 items-center justify-end border-l border-hairline px-3 text-[14px] font-semibold tabular-nums ${
                  i === 3 && n < 0 ? "text-danger" : ""
                }`}
                style={{ width: COL_W }}
              >
                {formatCurrency(n, currency)}
              </div>
            ))}
            {/* Total over/under */}
            <div
              className="flex h-11 shrink-0 flex-col items-end justify-center border-l border-hairline px-3 tabular-nums"
              style={{ width: COL_W }}
            >
              {(() => {
                const over = grand.actual - grand.estimate;
                const tone = over > 0 ? "text-danger" : over < 0 ? "text-[#15803d]" : "text-ink-faint";
                return (
                  <>
                    <span className={`text-[12.5px] font-semibold ${tone}`}>{formatCurrencySigned(over, currency)}</span>
                    <span className={`text-[10px] ${tone}`}>{over > 0 ? "over" : over < 0 ? "under" : "on budget"}</span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {edit && estimate.lineItems[edit.lineItemId] && (
        <CellEditorPopover
          title={`${estimate.lineItems[edit.lineItemId].label || "Line item"} · ${
            edit.field === "committed" ? "Committed (PO)" : "Actual (spent)"
          }`}
          initialExpr={estimate.actuals[edit.lineItemId]?.[edit.field]?.expr ?? ""}
          currency={currency}
          anchor={edit.anchor}
          onClose={() => setEdit(null)}
          onCommit={(expr, value) => setActual(edit.lineItemId, edit.field, { expr, value })}
        />
      )}
    </div>
  );
}
