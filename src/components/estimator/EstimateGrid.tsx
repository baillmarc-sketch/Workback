"use client";

import { useState } from "react";
import { uid } from "@/lib/types";
import {
  baselineColumnId,
  cellVariance,
  columnDelta,
  columnSubtotal,
  columnTotal,
  contingencyAmount,
  markupAmount,
  sectionSubtotal,
} from "@/lib/estimator/totals";
import { formatCurrency, formatCurrencySigned, formatPct, formatPctSigned } from "@/lib/estimator/format";
import { cellKey, type EstimateColumn } from "@/lib/estimator/types";
import { useEstimate } from "@/state/estimateStore";
import CellEditorPopover from "./CellEditorPopover";
import ColumnEditorPopover from "./ColumnEditorPopover";
import type { ViewMode } from "./ViewToggle";

type Anchor = { left: number; top: number; right: number; bottom: number };
function rectToAnchor(r: DOMRect): Anchor {
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

const LABEL_W = 240;
const COL_W = 150;

const labelInput =
  "w-full border-none bg-transparent text-[13px] outline-none placeholder:text-ink-faint";

export default function EstimateGrid({ mode }: { mode: ViewMode }) {
  const { estimate, commit } = useEstimate();
  const [editCell, setEditCell] = useState<{ lineItemId: string; columnId: string; anchor: Anchor } | null>(null);
  const [editCol, setEditCol] = useState<{ column: EstimateColumn; anchor: Anchor } | null>(null);

  if (!estimate) return null;

  const baseId = baselineColumnId(estimate);
  // Leveling shows your estimate baseline first, then the vendor bids; per-cell
  // and total variance are read against that baseline.
  let visibleColumns: EstimateColumn[];
  if (mode === "versions") {
    visibleColumns = estimate.columns.filter((c) => c.role === "version");
  } else if (mode === "leveling") {
    const base = estimate.columns.find((c) => c.id === baseId);
    const vendors = estimate.columns.filter((c) => c.role === "vendor" && c.id !== base?.id);
    visibleColumns = base ? [base, ...vendors] : vendors;
  } else {
    visibleColumns = estimate.columns; // "all"
  }
  const currency = estimate.currency;
  const rowWidth = LABEL_W + COL_W * visibleColumns.length;

  // --- mutations ---
  const addColumn = () =>
    commit((e) => {
      const col: EstimateColumn = {
        id: uid(),
        name:
          mode === "leveling"
            ? `Vendor ${e.columns.filter((c) => c.role === "vendor").length + 1}`
            : `Version ${e.columns.length + 1}`,
        role: mode === "leveling" ? "vendor" : "version",
        markupPct: e.defaultMarkupPct,
        contingencyPct: e.defaultContingencyPct,
        order: e.columns.length,
      };
      return { ...e, columns: [...e.columns, col] };
    });

  const addLineItem = (sectionId: string) =>
    commit((e) => {
      const id = uid();
      const order = Object.keys(e.lineItems).length;
      return {
        ...e,
        lineItems: { ...e.lineItems, [id]: { id, label: "", order } },
        sections: e.sections.map((s) =>
          s.id === sectionId ? { ...s, lineItemIds: [...s.lineItemIds, id] } : s
        ),
      };
    });

  const addSection = () =>
    commit((e) => ({
      ...e,
      sections: [...e.sections, { id: uid(), name: "New Section", lineItemIds: [], order: e.sections.length }],
    }));

  const deleteLineItem = (sectionId: string, lineItemId: string) =>
    commit((e) => {
      const lineItems = { ...e.lineItems };
      delete lineItems[lineItemId];
      const cells = Object.fromEntries(
        Object.entries(e.cells).filter(([k]) => !k.startsWith(`${lineItemId}:`))
      );
      return {
        ...e,
        lineItems,
        cells,
        sections: e.sections.map((s) =>
          s.id === sectionId ? { ...s, lineItemIds: s.lineItemIds.filter((id) => id !== lineItemId) } : s
        ),
      };
    });

  const deleteSection = (sectionId: string) =>
    commit((e) => {
      const section = e.sections.find((s) => s.id === sectionId);
      const removed = new Set(section?.lineItemIds ?? []);
      const lineItems = Object.fromEntries(
        Object.entries(e.lineItems).filter(([id]) => !removed.has(id))
      );
      const cells = Object.fromEntries(
        Object.entries(e.cells).filter(([k]) => !removed.has(k.slice(0, k.indexOf(":"))))
      );
      return { ...e, lineItems, cells, sections: e.sections.filter((s) => s.id !== sectionId) };
    });

  const renameSection = (sectionId: string, name: string) =>
    commit((e) => ({ ...e, sections: e.sections.map((s) => (s.id === sectionId ? { ...s, name } : s)) }));

  // Fast keyboard fill: move the open cell editor to an adjacent cell. Down/up
  // walk the line items in display order (across sections); left/right move
  // across the visible columns. Mirrors spreadsheet/Workback-style entry.
  const orderedLineIds = estimate.sections.flatMap((s) => s.lineItemIds);
  const navigateCell = (dir: "down" | "up" | "left" | "right") => {
    if (!editCell) return;
    let tLi = editCell.lineItemId;
    let tCol = editCell.columnId;
    if (dir === "down" || dir === "up") {
      const idx = orderedLineIds.indexOf(editCell.lineItemId);
      const n = dir === "down" ? idx + 1 : idx - 1;
      if (n < 0 || n >= orderedLineIds.length) {
        setEditCell(null);
        return;
      }
      tLi = orderedLineIds[n];
    } else {
      const ci = visibleColumns.findIndex((c) => c.id === editCell.columnId);
      const n = dir === "right" ? ci + 1 : ci - 1;
      if (n < 0 || n >= visibleColumns.length) return; // stay put at the edge
      tCol = visibleColumns[n].id;
    }
    const el = document.querySelector(`[data-cell="${tLi}__${tCol}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    setEditCell({ lineItemId: tLi, columnId: tCol, anchor: rectToAnchor(el.getBoundingClientRect()) });
  };

  const renameLineItem = (lineItemId: string, label: string) =>
    commit((e) => ({
      ...e,
      lineItems: { ...e.lineItems, [lineItemId]: { ...e.lineItems[lineItemId], label } },
    }));

  // --- shared row pieces ---
  const labelCell = (content: React.ReactNode, extra = "") => (
    <div
      className={`sticky left-0 z-10 flex shrink-0 items-center gap-1 bg-surface px-3 ${extra}`}
      style={{ width: LABEL_W }}
    >
      {content}
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
      <div style={{ width: rowWidth, minWidth: "100%" }}>
        {/* Column headers */}
        <div className="flex border-b border-hairline-strong bg-surface">
          {labelCell(
            <button
              className="text-[12px] font-medium text-ink-faint hover:text-ink"
              onClick={addColumn}
              title="Add a comparison column"
            >
              + Column
            </button>,
            "h-12"
          )}
          {visibleColumns.map((col) => {
            const awarded = col.id === estimate.awardedColumnId;
            return (
              <button
                key={col.id}
                className={`flex h-12 shrink-0 flex-col justify-center border-l border-hairline px-3 text-left hover:bg-paper ${
                  awarded ? "bg-[#f0fdf4] ring-1 ring-inset ring-[#86efac]" : ""
                }`}
                style={{ width: COL_W }}
                onClick={(e) => setEditCol({ column: col, anchor: rectToAnchor(e.currentTarget.getBoundingClientRect()) })}
              >
                <span className="flex items-center gap-1 truncate text-[12.5px] font-semibold">
                  {col.name || "Untitled"}
                  {col.id === baseId && <span className="text-[9px] text-ink-faint" title="Baseline">★</span>}
                </span>
                <span className="truncate text-[10px] tracking-wide text-ink-faint uppercase">
                  {awarded
                    ? "✓ Awarded"
                    : col.role === "vendor"
                      ? col.vendor || "Vendor"
                      : "Version"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sections */}
        {estimate.sections.map((section) => (
          <div key={section.id}>
            {/* Section header */}
            <div className="flex border-b border-hairline bg-paper/60">
              {labelCell(
                <>
                  <input
                    className={`${labelInput} font-display text-[13.5px] font-semibold`}
                    value={section.name}
                    placeholder="Section"
                    onChange={(e) => renameSection(section.id, e.target.value)}
                  />
                  <button
                    className="shrink-0 px-1 text-[15px] leading-none text-ink-faint hover:text-ink"
                    title="Add line item"
                    onClick={() => addLineItem(section.id)}
                  >
                    +
                  </button>
                  <button
                    className="shrink-0 px-1 text-[13px] leading-none text-ink-faint hover:text-danger"
                    title="Delete section"
                    onClick={() => deleteSection(section.id)}
                  >
                    ×
                  </button>
                </>,
                "h-9"
              )}
              {visibleColumns.map((col) => (
                <div key={col.id} className="shrink-0 border-l border-hairline" style={{ width: COL_W }} />
              ))}
            </div>

            {/* Line items */}
            {section.lineItemIds.map((liId) => {
              const li = estimate.lineItems[liId];
              if (!li) return null;
              return (
                <div key={liId} className="group flex border-b border-hairline">
                  {labelCell(
                    <>
                      <input
                        className={labelInput}
                        value={li.label}
                        placeholder="Line item"
                        onChange={(e) => renameLineItem(liId, e.target.value)}
                      />
                      <button
                        className="shrink-0 px-1 text-[13px] leading-none text-ink-faint opacity-0 group-hover:opacity-100 hover:text-danger"
                        title="Delete line item"
                        onClick={() => deleteLineItem(section.id, liId)}
                      >
                        ×
                      </button>
                    </>,
                    "h-9"
                  )}
                  {visibleColumns.map((col) => {
                    const cell = estimate.cells[cellKey(liId, col.id)];
                    // In leveling, show each vendor cell's variance vs the baseline cell.
                    const showVar =
                      mode === "leveling" && baseId && col.id !== baseId && col.role === "vendor" && cell;
                    const v = showVar
                      ? cellVariance(cell!.value, estimate.cells[cellKey(liId, baseId!)]?.value ?? 0)
                      : null;
                    return (
                      <button
                        key={col.id}
                        data-cell={`${liId}__${col.id}`}
                        className="flex h-9 shrink-0 flex-col items-end justify-center border-l border-hairline px-3 text-right text-[13px] tabular-nums hover:bg-paper"
                        style={{ width: COL_W }}
                        onClick={(e) =>
                          setEditCell({
                            lineItemId: liId,
                            columnId: col.id,
                            anchor: rectToAnchor(e.currentTarget.getBoundingClientRect()),
                          })
                        }
                      >
                        {cell ? formatCurrency(cell.value, currency) : <span className="text-ink-faint">—</span>}
                        {v && v.abs !== 0 && (
                          <span className={`text-[9.5px] ${v.abs > 0 ? "text-danger" : "text-[#15803d]"}`}>
                            {formatCurrencySigned(v.abs, currency)}
                          </span>
                        )}
                      </button>
                    );
                  })}
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
              {visibleColumns.map((col) => (
                <div
                  key={col.id}
                  className="flex h-8 shrink-0 items-center justify-end border-l border-hairline px-3 text-[12.5px] font-medium tabular-nums"
                  style={{ width: COL_W }}
                >
                  {formatCurrency(sectionSubtotal(estimate, section.id, col.id), currency)}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Add section */}
        <div className="flex border-b border-hairline">
          {labelCell(
            <button className="text-[12px] font-medium text-ink-faint hover:text-ink" onClick={addSection}>
              + Section
            </button>,
            "h-9"
          )}
          {visibleColumns.map((col) => (
            <div key={col.id} className="shrink-0 border-l border-hairline" style={{ width: COL_W }} />
          ))}
        </div>

        {/* Totals block */}
        <TotalRow
          label="Subtotal"
          columns={visibleColumns}
          value={(col) => columnSubtotal(estimate, col.id)}
          currency={currency}
        />
        <TotalRow
          label="Markup"
          columns={visibleColumns}
          sub={(col) => formatPct(col.markupPct)}
          value={(col) => markupAmount(columnSubtotal(estimate, col.id), col.markupPct)}
          currency={currency}
          muted
        />
        <TotalRow
          label="Contingency"
          columns={visibleColumns}
          sub={(col) => formatPct(col.contingencyPct)}
          value={(col) => contingencyAmount(columnSubtotal(estimate, col.id), col.contingencyPct)}
          currency={currency}
          muted
        />
        <TotalRow
          label="Total"
          columns={visibleColumns}
          value={(col) => columnTotal(estimate, col.id)}
          currency={currency}
          strong
        />
        {/* Delta vs baseline */}
        {baseId && (
          <div className="flex bg-paper/40">
            {labelCell(
              <span className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">vs baseline</span>,
              "h-9"
            )}
            {visibleColumns.map((col) => {
              if (col.id === baseId) {
                return (
                  <div
                    key={col.id}
                    className="flex h-9 shrink-0 items-center justify-end border-l border-hairline px-3 text-[12px] text-ink-faint"
                    style={{ width: COL_W }}
                  >
                    baseline
                  </div>
                );
              }
              const d = columnDelta(estimate, col.id, baseId);
              const tone = d.abs > 0 ? "text-danger" : d.abs < 0 ? "text-[#15803d]" : "text-ink-faint";
              return (
                <div
                  key={col.id}
                  className={`flex h-9 shrink-0 flex-col items-end justify-center border-l border-hairline px-3 tabular-nums ${tone}`}
                  style={{ width: COL_W }}
                >
                  <span className="text-[12.5px] font-medium">{formatCurrencySigned(d.abs, currency)}</span>
                  <span className="text-[10.5px]">{formatPctSigned(d.pct)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editCell && estimate.lineItems[editCell.lineItemId] && (
        <CellEditorPopover
          key={`${editCell.lineItemId}__${editCell.columnId}`}
          title={`${estimate.lineItems[editCell.lineItemId].label || "Line item"} · ${
            estimate.columns.find((c) => c.id === editCell.columnId)?.name ?? ""
          }`}
          initialExpr={estimate.cells[cellKey(editCell.lineItemId, editCell.columnId)]?.expr ?? ""}
          currency={currency}
          anchor={editCell.anchor}
          onClose={() => setEditCell(null)}
          onNavigate={navigateCell}
          onCommit={(expr, value) =>
            commit((e) => {
              const key = cellKey(editCell.lineItemId, editCell.columnId);
              const cells = { ...e.cells };
              if (expr === "") delete cells[key];
              else cells[key] = { expr, value };
              return { ...e, cells };
            })
          }
        />
      )}
      {editCol && (
        <ColumnEditorPopover column={editCol.column} anchor={editCol.anchor} onClose={() => setEditCol(null)} />
      )}
    </div>
  );
}

function TotalRow({
  label,
  columns,
  value,
  sub,
  currency,
  strong,
  muted,
}: {
  label: string;
  columns: EstimateColumn[];
  value: (col: EstimateColumn) => number;
  sub?: (col: EstimateColumn) => string;
  currency: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex border-b border-hairline ${strong ? "bg-paper/70" : ""}`}>
      <div
        className={`sticky left-0 z-10 flex shrink-0 items-center bg-surface px-3 ${strong ? "h-11 font-display text-[14px] font-semibold" : "h-9 text-[12.5px] font-medium"} ${muted ? "text-ink-soft" : ""}`}
        style={{ width: LABEL_W }}
      >
        {label}
      </div>
      {columns.map((col) => (
        <div
          key={col.id}
          className={`flex shrink-0 items-center justify-end gap-1.5 border-l border-hairline px-3 tabular-nums ${
            strong ? "h-11 text-[14px] font-semibold" : "h-9 text-[12.5px]"
          } ${muted ? "text-ink-soft" : ""}`}
          style={{ width: COL_W }}
        >
          {sub && <span className="text-[10px] text-ink-faint">{sub(col)}</span>}
          {formatCurrency(value(col), currency)}
        </div>
      ))}
    </div>
  );
}
