"use client";

import { useEffect, useRef, useState } from "react";
import { uid } from "@/lib/types";
import {
  adjustmentAmount,
  baselineColumnId,
  cellVariance,
  columnDelta,
  columnSubtotal,
  columnTotal,
  sectionSubtotal,
} from "@/lib/estimator/totals";
import { evalExpr } from "@/lib/estimator/formula";
import { formatCurrency, formatCurrencySigned, formatPct, formatPctSigned } from "@/lib/estimator/format";
import { cellKey, type EstimateColumn } from "@/lib/estimator/types";
import { useEstimate } from "@/state/estimateStore";
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

type Sel = { liId: string; colId: string };
type Dir = "up" | "down" | "left" | "right";

export default function EstimateGrid({ mode }: { mode: ViewMode }) {
  const { estimate, commit } = useEstimate();
  const [editCol, setEditCol] = useState<{ column: EstimateColumn; anchor: Anchor } | null>(null);
  // Spreadsheet-style selection + inline editing.
  const [sel, setSel] = useState<Sel | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const selectOnFocus = useRef(true); // select existing text on click/Enter, not when typing to seed

  // Deselect when clicking outside the grid.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setSel(null);
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Keep the active cell in view; when selected-but-not-editing, hold keyboard
  // focus on the grid so navigation/type-to-edit keys land.
  useEffect(() => {
    if (!sel) return;
    const el = document.querySelector(`[data-cell="${sel.liId}__${sel.colId}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (!editing) gridRef.current?.focus();
  }, [sel, editing]);

  if (!estimate) return null;

  const baseId = baselineColumnId(estimate);
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
  const orderedLineIds = estimate.sections.flatMap((s) => s.lineItemIds);
  const colIds = visibleColumns.map((c) => c.id);

  // --- cell editing ---
  const exprOf = (liId: string, colId: string) => estimate.cells[cellKey(liId, colId)]?.expr ?? "";

  /** Persist a cell as the user types: blank clears it, valid math stores
      {expr,value}, invalid keystrokes update only the local draft. */
  const writeCell = (liId: string, colId: string, value: string) => {
    setDraft(value);
    const r = evalExpr(value);
    if (value.trim() === "") {
      commit((e) => {
        const cells = { ...e.cells };
        delete cells[cellKey(liId, colId)];
        return { ...e, cells };
      });
    } else if (r.ok) {
      commit((e) => ({ ...e, cells: { ...e.cells, [cellKey(liId, colId)]: { expr: value.trim(), value: r.value ?? 0 } } }));
    }
  };

  const clearCell = (liId: string, colId: string) =>
    commit((e) => {
      const cells = { ...e.cells };
      delete cells[cellKey(liId, colId)];
      return { ...e, cells };
    });

  const startEdit = (liId: string, colId: string, seed?: string) => {
    setSel({ liId, colId });
    setEditing(true);
    if (seed !== undefined) {
      selectOnFocus.current = false;
      writeCell(liId, colId, seed);
    } else {
      selectOnFocus.current = true;
      setDraft(exprOf(liId, colId));
    }
  };

  const move = (dir: Dir, edit: boolean) => {
    if (!sel) return;
    let { liId, colId } = sel;
    if (dir === "up" || dir === "down") {
      const i = orderedLineIds.indexOf(liId);
      const n = dir === "down" ? i + 1 : i - 1;
      if (n < 0 || n >= orderedLineIds.length) return;
      liId = orderedLineIds[n];
    } else {
      const i = colIds.indexOf(colId);
      const n = dir === "right" ? i + 1 : i - 1;
      if (n < 0 || n >= colIds.length) return;
      colId = colIds[n];
    }
    if (edit) startEdit(liId, colId);
    else {
      setEditing(false);
      setSel({ liId, colId });
    }
  };

  // Keys while a cell is selected but NOT editing (grid container has focus).
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (editing || !sel) return;
    const t = e.target as HTMLElement;
    if (t !== gridRef.current && !t.closest?.("[data-cell]")) return; // ignore label-field typing
    if (e.key === "ArrowDown") return e.preventDefault(), move("down", false);
    if (e.key === "ArrowUp") return e.preventDefault(), move("up", false);
    if (e.key === "ArrowRight") return e.preventDefault(), move("right", false);
    if (e.key === "ArrowLeft") return e.preventDefault(), move("left", false);
    if (e.key === "Tab") return e.preventDefault(), move(e.shiftKey ? "left" : "right", false);
    if (e.key === "Enter") return e.preventDefault(), startEdit(sel.liId, sel.colId);
    if (e.key === "Backspace" || e.key === "Delete") return e.preventDefault(), clearCell(sel.liId, sel.colId);
    // Type-to-edit: a printable char seeds a fresh edit.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      startEdit(sel.liId, sel.colId, e.key);
    }
  };

  // Keys while editing inside the inline input.
  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") return e.preventDefault(), move(e.shiftKey ? "up" : "down", true);
    if (e.key === "Tab") return e.preventDefault(), move(e.shiftKey ? "left" : "right", true);
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false); // keep selection; effect refocuses the grid
    }
  };

  // --- structure mutations ---
  const addColumn = () =>
    commit((e) => {
      const col: EstimateColumn = {
        id: uid(),
        name:
          mode === "leveling"
            ? `Vendor ${e.columns.filter((c) => c.role === "vendor").length + 1}`
            : `Version ${e.columns.length + 1}`,
        role: mode === "leveling" ? "vendor" : "version",
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
        sections: e.sections.map((s) => (s.id === sectionId ? { ...s, lineItemIds: [...s.lineItemIds, id] } : s)),
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
      const cells = Object.fromEntries(Object.entries(e.cells).filter(([k]) => !k.startsWith(`${lineItemId}:`)));
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
      const lineItems = Object.fromEntries(Object.entries(e.lineItems).filter(([id]) => !removed.has(id)));
      const cells = Object.fromEntries(Object.entries(e.cells).filter(([k]) => !removed.has(k.slice(0, k.indexOf(":")))));
      return { ...e, lineItems, cells, sections: e.sections.filter((s) => s.id !== sectionId) };
    });

  const renameSection = (sectionId: string, name: string) =>
    commit((e) => ({ ...e, sections: e.sections.map((s) => (s.id === sectionId ? { ...s, name } : s)) }));

  const renameLineItem = (lineItemId: string, label: string) =>
    commit((e) => ({ ...e, lineItems: { ...e.lineItems, [lineItemId]: { ...e.lineItems[lineItemId], label } } }));

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
    <div>
      <p className="no-print mb-2 text-[11.5px] text-ink-faint">
        Tip: click a cell and type — <span className="font-medium text-ink-soft">Enter</span> ↓,{" "}
        <span className="font-medium text-ink-soft">Tab</span> →, arrows to move,{" "}
        <span className="font-medium text-ink-soft">Esc</span> to stop. Math like <code>2*15000</code> works.
      </p>

      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        className="overflow-x-auto rounded-xl border border-hairline bg-surface outline-none"
      >
        <div style={{ width: rowWidth, minWidth: "100%" }}>
          {/* Column headers */}
          <div className="flex border-b border-hairline-strong bg-surface">
            {labelCell(
              <button className="text-[12px] font-medium text-ink-faint hover:text-ink" onClick={addColumn} title="Add a comparison column">
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
                    {(col.links?.length || col.notes) && (
                      <span className="text-[9px] text-ink-faint" title="Has notes / links">🔗</span>
                    )}
                  </span>
                  <span className="truncate text-[10px] tracking-wide text-ink-faint uppercase">
                    {awarded ? "✓ Awarded" : col.role === "vendor" ? col.vendor || "Vendor" : "Version"}
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
                      const isSel = sel?.liId === liId && sel?.colId === col.id;
                      const isEditing = isSel && editing;
                      const showVar =
                        mode === "leveling" && baseId && col.id !== baseId && col.role === "vendor" && cell;
                      const v = showVar
                        ? cellVariance(cell!.value, estimate.cells[cellKey(liId, baseId!)]?.value ?? 0)
                        : null;
                      return (
                        <div
                          key={col.id}
                          data-cell={`${liId}__${col.id}`}
                          className={`relative h-9 shrink-0 border-l border-hairline ${
                            isSel && !isEditing ? "ring-1 ring-inset ring-ink-faint" : ""
                          }`}
                          style={{ width: COL_W }}
                        >
                          {isEditing ? (
                            <input
                              key={`${liId}__${col.id}`}
                              className="h-full w-full bg-paper px-3 text-right text-[13px] tabular-nums outline-none ring-1 ring-inset ring-ink"
                              value={draft}
                              autoFocus
                              inputMode="text"
                              onFocus={(e) => {
                                if (selectOnFocus.current) e.currentTarget.select();
                              }}
                              onChange={(e) => writeCell(liId, col.id, e.target.value)}
                              onKeyDown={onInputKeyDown}
                            />
                          ) : (
                            <button
                              className="flex h-full w-full flex-col items-end justify-center px-3 text-right text-[13px] tabular-nums hover:bg-paper"
                              onClick={() => startEdit(liId, col.id)}
                            >
                              {cell ? formatCurrency(cell.value, currency) : <span className="text-ink-faint">—</span>}
                              {v && v.abs !== 0 && (
                                <span className={`text-[9.5px] ${v.abs > 0 ? "text-danger" : "text-[#15803d]"}`}>
                                  {formatCurrencySigned(v.abs, currency)}
                                </span>
                              )}
                            </button>
                          )}
                        </div>
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

          {/* Totals block: Net subtotal → adjustments → Total */}
          <TotalRow label="Net Subtotal" columns={visibleColumns} value={(col) => columnSubtotal(estimate, col.id)} currency={currency} />
          {estimate.adjustments.map((adj) => (
            <TotalRow
              key={adj.id}
              label={adj.label}
              columns={visibleColumns}
              sub={adj.type === "percent" ? () => formatPct(adj.value) : undefined}
              value={(col) => adjustmentAmount(columnSubtotal(estimate, col.id), adj)}
              currency={currency}
              muted
            />
          ))}
          <TotalRow label="Total" columns={visibleColumns} value={(col) => columnTotal(estimate, col.id)} currency={currency} strong />

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
      </div>

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
