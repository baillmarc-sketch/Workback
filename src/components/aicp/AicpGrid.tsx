"use client";

import { useState } from "react";
import { useBid } from "@/state/aicpStore";
import { formatCurrency } from "@/lib/estimator/format";
import {
  estimateColumn,
  actualColumn,
  categorySubtotal,
  categoryFringe,
  categoryHandling,
  categoryFringePct,
  categoryTotal,
  subSectionSubtotal,
} from "@/lib/aicp/totals";
import {
  addLine,
  addSubSection,
  removeLine,
  removeSubSection,
  renameLine,
  renameSubSection,
  setActualAmount,
  setEstimateField,
  setLineUnitType,
  toggleLineHidden,
} from "@/lib/aicp/mutations";
import { readCell } from "@/lib/aicp/mutations";
import type { Bid, BidCategory, BidColumn } from "@/lib/aicp/types";
import { categoryLineIds } from "@/lib/aicp/types";
import CellInput from "./CellInput";

/** One editable budget line. Estimate is Units × Rate × QTY; other columns
    (versions, Actual) take a single amount. */
function LineRow({
  bid,
  lineId,
  estCol,
  amountCols,
  commit,
}: {
  bid: Bid;
  lineId: string;
  estCol: string;
  amountCols: BidColumn[];
  commit: (up: (b: Bid) => Bid) => void;
}) {
  const line = bid.lines[lineId];
  if (!line) return null;
  const est = readCell(bid, lineId, estCol);
  const dim = line.hidden ? "opacity-40" : "";

  return (
    <tr className="group border-t border-hairline hover:bg-surface/60">
      <td className={`py-0.5 pl-2 ${dim}`}>
        <CellInput
          value={line.label}
          onCommit={(v) => commit((b) => renameLine(b, lineId, v))}
          placeholder="Line description"
          align="left"
          ariaLabel="Line description"
        />
      </td>
      <td className={`py-0.5 ${dim}`}>
        <CellInput
          value={line.unitType}
          onCommit={(v) => commit((b) => setLineUnitType(b, lineId, v))}
          align="left"
          className="text-[11px] text-ink-soft"
          ariaLabel="Unit type"
        />
      </td>
      <td className={`w-14 py-0.5 ${dim}`}>
        <CellInput value={est.unitsExpr} onCommit={(v) => commit((b) => setEstimateField(b, lineId, estCol, "units", v))} ariaLabel="Units" />
      </td>
      <td className={`w-20 py-0.5 ${dim}`}>
        <CellInput value={est.rateExpr} onCommit={(v) => commit((b) => setEstimateField(b, lineId, estCol, "rate", v))} ariaLabel="Rate" />
      </td>
      <td className={`w-12 py-0.5 ${dim}`}>
        <CellInput value={est.qtyExpr} onCommit={(v) => commit((b) => setEstimateField(b, lineId, estCol, "qty", v))} ariaLabel="Quantity" />
      </td>
      <td className={`w-24 py-0.5 pr-1 text-right tabular-nums ${dim}`}>{formatCurrency(est.value, bid.currency)}</td>
      {amountCols.map((c) => (
        <td key={c.id} className={`w-24 py-0.5 ${dim}`}>
          <CellInput
            value={readCell(bid, lineId, c.id).rateExpr}
            onCommit={(v) => commit((b) => setActualAmount(b, lineId, c.id, v))}
            ariaLabel={c.name}
          />
        </td>
      ))}
      <td className="w-12 py-0.5 pr-1 text-right">
        <span className="invisible inline-flex gap-1 group-hover:visible">
          <button
            title={line.hidden ? "Show on print" : "Hide on print"}
            onClick={() => commit((b) => toggleLineHidden(b, lineId))}
            className="text-[11px] text-ink-faint hover:text-ink"
          >
            {line.hidden ? "◌" : "◍"}
          </button>
          <button
            title="Delete line"
            onClick={() => commit((b) => removeLine(b, lineId))}
            className="text-[11px] text-ink-faint hover:text-danger"
          >
            ✕
          </button>
        </span>
      </td>
    </tr>
  );
}

function AddLineRow({ cols, onAdd }: { cols: number; onAdd: () => void }) {
  return (
    <tr className="border-t border-hairline">
      <td colSpan={cols} className="py-1 pl-2">
        <button onClick={onAdd} className="text-[11.5px] font-medium text-ink-faint hover:text-ink">
          + Add line
        </button>
      </td>
    </tr>
  );
}

function CategoryBlock({
  bid,
  cat,
  estCol,
  amountCols,
  commit,
}: {
  bid: Bid;
  cat: BidCategory;
  estCol: string;
  amountCols: BidColumn[];
  commit: (up: (b: Bid) => Bid) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const totalCols = 6 + amountCols.length + 1; // desc, unit, units, rate, qty, est, amounts, actions
  const sub = categorySubtotal(bid, cat.id, estCol);
  const fringe = categoryFringe(bid, cat.id, estCol);
  const handling = categoryHandling(bid, cat.id, estCol);
  const total = categoryTotal(bid, cat.id, estCol);

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-hairline bg-paper">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between gap-2 bg-surface px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-ink-faint">{collapsed ? "▸" : "▾"}</span>
          <span className="inline-block w-5 font-semibold text-ink-soft">{cat.letter}</span>
          <span className="font-display text-[13px] font-semibold">{cat.name}</span>
          {cat.fringes && <span className="rounded bg-hairline px-1 text-[10px] text-ink-soft">fringes</span>}
          {cat.handling && <span className="rounded bg-hairline px-1 text-[10px] text-ink-soft">handling</span>}
        </span>
        <span className="text-[12.5px] font-semibold tabular-nums">{formatCurrency(total, bid.currency)}</span>
      </button>

      {!collapsed && (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-ink-faint">
              <th className="py-1 pl-2 text-left font-medium">Description</th>
              <th className="py-1 text-left font-medium">Unit</th>
              <th className="py-1 text-right font-medium">Units</th>
              <th className="py-1 text-right font-medium">Rate</th>
              <th className="py-1 text-right font-medium">Qty</th>
              <th className="py-1 pr-1 text-right font-medium">Estimate</th>
              {amountCols.map((c) => (
                <th key={c.id} className="py-1 text-right font-medium">
                  {c.name}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {cat.subSections ? (
              cat.subSections.map((s) => {
                const ssub = subSectionSubtotal(bid, s.lineIds, estCol);
                return (
                  <>
                    <tr key={s.id} className="border-t border-hairline-strong bg-surface/40">
                      <td colSpan={totalCols} className="py-1 pl-2">
                        <span className="flex items-center justify-between gap-2">
                          <CellInput
                            value={s.name}
                            onCommit={(v) => commit((b) => renameSubSection(b, cat.id, s.id, v))}
                            align="left"
                            className="text-[12px] font-semibold"
                            ariaLabel="Sub-section name"
                          />
                          <span className="flex items-center gap-3 pr-2">
                            <span className="text-[12px] font-semibold tabular-nums">{formatCurrency(ssub, bid.currency)}</span>
                            <button
                              onClick={() => commit((b) => removeSubSection(b, cat.id, s.id))}
                              className="text-[11px] text-ink-faint hover:text-danger"
                              title="Remove sub-section"
                            >
                              ✕
                            </button>
                          </span>
                        </span>
                      </td>
                    </tr>
                    {s.lineIds.map((id) => (
                      <LineRow key={id} bid={bid} lineId={id} estCol={estCol} amountCols={amountCols} commit={commit} />
                    ))}
                    <AddLineRow cols={totalCols} onAdd={() => commit((b) => addLine(b, cat.id, { subSectionId: s.id }))} />
                  </>
                );
              })
            ) : (
              <>
                {categoryLineIds(cat).map((id) => (
                  <LineRow key={id} bid={bid} lineId={id} estCol={estCol} amountCols={amountCols} commit={commit} />
                ))}
                <AddLineRow cols={totalCols} onAdd={() => commit((b) => addLine(b, cat.id))} />
              </>
            )}
          </tbody>
          <tfoot>
            {cat.subSections && (
              <tr className="border-t border-hairline">
                <td colSpan={totalCols} className="py-1 pl-2">
                  <button
                    onClick={() => commit((b) => addSubSection(b, cat.id))}
                    className="text-[11.5px] font-medium text-ink-faint hover:text-ink"
                  >
                    + Add sub-section
                  </button>
                </td>
              </tr>
            )}
            <tr className="border-t border-hairline-strong text-[12px]">
              <td className="py-1 pl-2 font-medium text-ink-soft" colSpan={5}>
                Sub-total {cat.letter}
              </td>
              <td className="py-1 pr-1 text-right font-semibold tabular-nums">{formatCurrency(sub, bid.currency)}</td>
              <td colSpan={amountCols.length + 1} />
            </tr>
            {cat.fringes && (
              <tr className="text-[12px]">
                <td className="py-0.5 pl-2 text-ink-soft" colSpan={5}>
                  Fringes ({categoryFringePct(bid, cat)}%)
                </td>
                <td className="py-0.5 pr-1 text-right tabular-nums">{formatCurrency(fringe, bid.currency)}</td>
                <td colSpan={amountCols.length + 1} />
              </tr>
            )}
            {cat.handling && (
              <tr className="text-[12px]">
                <td className="py-0.5 pl-2 text-ink-soft" colSpan={5}>
                  Handling fee
                </td>
                <td className="py-0.5 pr-1 text-right tabular-nums">{formatCurrency(handling, bid.currency)}</td>
                <td colSpan={amountCols.length + 1} />
              </tr>
            )}
            {(cat.fringes || cat.handling) && (
              <tr className="border-t border-hairline text-[12px] font-semibold">
                <td className="py-1 pl-2" colSpan={5}>
                  Total {cat.letter}
                </td>
                <td className="py-1 pr-1 text-right tabular-nums">{formatCurrency(total, bid.currency)}</td>
                <td colSpan={amountCols.length + 1} />
              </tr>
            )}
          </tfoot>
        </table>
      )}
    </div>
  );
}

/** The editable AICP grid: every cost category with qty×rate line entry,
    fringes/handling subtotals, and Actual/version amount columns. */
export default function AicpGrid() {
  const { bid, commit } = useBid();
  if (!bid) return null;
  const estCol = estimateColumn(bid);
  if (!estCol) return null;
  const actCol = actualColumn(bid);
  // Amount columns shown to the right of Estimate: version scenarios, then Actual.
  const versionCols = bid.columns.filter((c) => c.kind === "version").sort((a, b) => a.order - b.order);
  const amountCols = [...versionCols, ...(actCol ? bid.columns.filter((c) => c.id === actCol) : [])];

  const production = bid.categories.filter((c) => c.group === "production").sort((a, b) => a.order - b.order);
  const post = bid.categories.filter((c) => c.group === "post").sort((a, b) => a.order - b.order);

  return (
    <div>
      {production.map((cat) => (
        <CategoryBlock key={cat.id} bid={bid} cat={cat} estCol={estCol} amountCols={amountCols} commit={commit} />
      ))}
      {post.length > 0 && (
        <h3 className="mb-2 mt-6 font-display text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
          Post-Production
        </h3>
      )}
      {post.map((cat) => (
        <CategoryBlock key={cat.id} bid={bid} cat={cat} estCol={estCol} amountCols={amountCols} commit={commit} />
      ))}
    </div>
  );
}
