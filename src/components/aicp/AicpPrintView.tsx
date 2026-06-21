"use client";

import { Fragment } from "react";
import { useBid } from "@/state/aicpStore";
import { formatCurrency } from "@/lib/estimator/format";
import {
  estimateColumn,
  actualColumn,
  categoryTotal,
  categorySubtotal,
  categoryFringe,
  categoryHandling,
  categoryFringePct,
  subtotalAtoK,
  productionInsurance,
  productionFee,
  productionTotal,
  postRecap,
  postCategories,
  productionCategories,
  grandTotal,
} from "@/lib/aicp/totals";
import { cellKey, categoryLineIds } from "@/lib/aicp/types";
import type { Bid, BidCategory } from "@/lib/aicp/types";

export type PrintTheme = "classic" | "modern";

export interface PrintConfig {
  theme: PrintTheme;
  /** Drop zero-value lines and empty categories from the printed bid. */
  hideUnused: boolean;
  showJobInfo: boolean;
  showSummary: boolean;
  showDetail: boolean;
  showActual: boolean;
  showNotes: boolean;
}

export function defaultPrintConfig(bid: Bid): PrintConfig {
  return {
    theme: "classic",
    hideUnused: true,
    showJobInfo: true,
    showSummary: true,
    showDetail: true,
    showActual: false,
    showNotes: bid.notes.trim().length > 0,
  };
}

function lineValue(bid: Bid, lineId: string, colId: string | undefined): number {
  if (!colId) return 0;
  return bid.cells[cellKey(lineId, colId)]?.value ?? 0;
}

/** Lines to print for a set of ids, dropping zero rows when hideUnused. */
function visibleLines(bid: Bid, ids: string[], estCol: string, actCol: string | undefined, hideUnused: boolean): string[] {
  return ids.filter((id) => {
    const line = bid.lines[id];
    if (!line || line.hidden) return false;
    if (!hideUnused) return true;
    return lineValue(bid, id, estCol) !== 0 || lineValue(bid, id, actCol) !== 0;
  });
}

/** Whether a category has anything to show under the current config. */
function categoryHasContent(bid: Bid, cat: BidCategory, estCol: string, actCol: string | undefined, hideUnused: boolean): boolean {
  if (cat.hidden) return false;
  if (!hideUnused) return true;
  return categoryTotal(bid, cat.id, estCol) !== 0 || (!!actCol && categoryTotal(bid, cat.id, actCol) !== 0);
}

/**
 * The printable AICP bid: a cover (job info + summary recap) followed by the
 * lettered category detail pages. Two themes — `classic` reproduces the familiar
 * AICP form look (heavy rules, shaded category bands); `modern` is a cleaner,
 * lighter-typeset version of the same data. `hideUnused` drops zero lines and
 * empty categories so a sparse bid prints tight. Hidden on screen; shown only
 * when printing via `print-only`.
 */
export default function AicpPrintView({ config }: { config: PrintConfig }) {
  const { bid } = useBid();
  if (!bid) return null;
  const estCol = estimateColumn(bid);
  if (!estCol) return null;
  const actCol = config.showActual ? actualColumn(bid) : undefined;
  const cur = bid.currency;
  const classic = config.theme === "classic";
  const fmt = (n: number) => formatCurrency(n, cur);

  // Theme styles.
  const headerRule = classic ? "3px solid #000" : "1px solid #bbb";
  const th = classic
    ? "border-b-2 border-black px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide"
    : "border-b border-[#ccc] px-2 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-[#666]";
  const tdLabel = "border-b border-[#e5e5e5] px-2 py-1 text-[11.5px]";
  const tdNum = "border-b border-[#e5e5e5] px-2 py-1 text-right text-[11.5px] tabular-nums";
  const bandStyle = classic
    ? { background: "#eee", WebkitPrintColorAdjust: "exact" as const, printColorAdjust: "exact" as const }
    : undefined;

  const prod = productionCategories(bid).filter((c) => categoryHasContent(bid, c, estCol, actCol, config.hideUnused));
  const post = postCategories(bid).filter((c) => categoryHasContent(bid, c, estCol, actCol, config.hideUnused));

  const recapRow = (label: string, est: number, act: number, strong?: boolean, letter?: string) => (
    <tr style={strong ? { borderTop: "1.5px solid #000", fontWeight: 600 } : undefined}>
      <td className="px-2 py-0.5 text-[11.5px]">
        {letter && <span className="mr-1 inline-block w-4 text-[#888]">{letter}</span>}
        {label}
      </td>
      <td className="px-2 py-0.5 text-right text-[11.5px] tabular-nums">{fmt(est)}</td>
      {actCol && <td className="px-2 py-0.5 text-right text-[11.5px] tabular-nums text-[#555]">{act ? fmt(act) : "—"}</td>}
    </tr>
  );

  const detailTable = (cat: BidCategory, ids: string[]) => {
    const lines = visibleLines(bid, ids, estCol, actCol, config.hideUnused);
    return lines.map((id) => {
      const line = bid.lines[id];
      const c = bid.cells[cellKey(id, estCol)];
      return (
        <tr key={id}>
          <td className={tdLabel}>{line.label || "—"}</td>
          <td className={`${tdLabel} text-[#777]`}>{c?.unitsExpr ? `${c.unitsExpr} ${line.unitType}` : ""}</td>
          <td className={tdNum}>{c?.rate ? fmt(c.rate) : ""}</td>
          <td className={tdNum}>{c && c.qty !== 1 ? c.qty : ""}</td>
          <td className={tdNum}>{fmt(lineValue(bid, id, estCol))}</td>
          {actCol && <td className={tdNum}>{lineValue(bid, id, actCol) ? fmt(lineValue(bid, id, actCol)) : ""}</td>}
        </tr>
      );
    });
  };

  const detailCols = 5 + (actCol ? 1 : 0);

  return (
    <div className={`aicp-print print-only ${classic ? "aicp-classic" : "aicp-modern"}`}>
      {/* Cover header */}
      <div style={{ borderBottom: headerRule, paddingBottom: 8, marginBottom: 14 }} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-bold leading-tight">{bid.title || "AICP Bid"}</h1>
          {bid.subtitle && <div className="text-[13px] text-[#444]">{bid.subtitle}</div>}
          <div className="mt-1 text-[11px] text-[#666]">
            AICP Bid · {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
        {bid.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bid.logoUrl} alt="Logo" style={{ maxHeight: 60, maxWidth: 200, objectFit: "contain" }} />
        )}
      </div>

      {/* Job information */}
      {config.showJobInfo && bid.fields.some((f) => f.value) && (
        <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1">
          {bid.fields
            .filter((f) => f.value)
            .map((f) => (
              <div key={f.id} className="flex justify-between border-b border-[#eee] py-0.5 text-[12px]">
                <span className="font-semibold text-[#555]">{f.label}</span>
                <span className="text-right">{f.value}</span>
              </div>
            ))}
        </div>
      )}

      {/* Summary recap */}
      {config.showSummary && (
        <div className="mb-4">
          <h2 className="mb-1 text-[12px] font-bold uppercase tracking-wide">Summary of Estimated Production Costs</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className={th}>Category</th>
                <th className={`${th} text-right`}>Estimate</th>
                {actCol && <th className={`${th} text-right`}>Actual</th>}
              </tr>
            </thead>
            <tbody>
              {prod.map((c) => recapRow(c.name, categoryTotal(bid, c.id, estCol), actCol ? categoryTotal(bid, c.id, actCol) : 0, false, c.letter + "."))}
              {recapRow("Sub-Total A to K", subtotalAtoK(bid, estCol), actCol ? subtotalAtoK(bid, actCol) : 0, true)}
              {bid.rates.insuranceProdPct > 0 && recapRow("Insurance", productionInsurance(bid, estCol), actCol ? productionInsurance(bid, actCol) : 0)}
              {bid.rates.productionFeePct > 0 && recapRow("Production Fee", productionFee(bid, estCol), actCol ? productionFee(bid, actCol) : 0)}
              {recapRow("Production Total", productionTotal(bid, estCol), actCol ? productionTotal(bid, actCol) : 0, true)}
              {post.length > 0 && (
                <>
                  {post.map((c) => recapRow(c.name, categoryTotal(bid, c.id, estCol), actCol ? categoryTotal(bid, c.id, actCol) : 0, false, c.letter + "."))}
                  {recapRow("Post-Production Total", postRecap(bid, estCol).total, actCol ? postRecap(bid, actCol).total : 0, true)}
                </>
              )}
              {recapRow("Grand Total", grandTotal(bid, estCol), actCol ? grandTotal(bid, actCol) : 0, true)}
            </tbody>
          </table>
        </div>
      )}

      {/* Category detail */}
      {config.showDetail && (
        <div className="aicp-page-break">
          {[...prod, ...post].map((cat) => {
            const ids = categoryLineIds(cat);
            return (
              <div key={cat.id} className="mb-4" style={{ breakInside: "avoid" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <td colSpan={detailCols} className="px-2 py-1 text-[12px] font-bold" style={bandStyle}>
                        {cat.letter}. {cat.name}
                      </td>
                    </tr>
                    <tr>
                      <th className={th}>Description</th>
                      <th className={th}>Units</th>
                      <th className={`${th} text-right`}>Rate</th>
                      <th className={`${th} text-right`}>Qty</th>
                      <th className={`${th} text-right`}>Estimate</th>
                      {actCol && <th className={`${th} text-right`}>Actual</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {cat.subSections ? (
                      cat.subSections.map((s) => {
                        const sLines = visibleLines(bid, s.lineIds, estCol, actCol, config.hideUnused);
                        if (sLines.length === 0) return null;
                        return (
                          <Fragment key={s.id}>
                            <tr>
                              <td colSpan={detailCols} className="px-2 py-0.5 text-[11px] font-semibold text-[#555]">
                                {s.name}
                              </td>
                            </tr>
                            {detailTable(cat, s.lineIds)}
                          </Fragment>
                        );
                      })
                    ) : (
                      detailTable(cat, ids)
                    )}
                    {/* Category subtotal + fringes/handling */}
                    <tr style={{ borderTop: "1.5px solid #000", fontWeight: 600 }}>
                      <td className="px-2 py-1 text-[11.5px]" colSpan={detailCols - 1}>
                        Sub-total {cat.letter}
                      </td>
                      <td className="px-2 py-1 text-right text-[11.5px] tabular-nums">{fmt(categorySubtotal(bid, cat.id, estCol))}</td>
                    </tr>
                    {cat.fringes && (
                      <tr>
                        <td className="px-2 py-0.5 text-[11px] text-[#555]" colSpan={detailCols - 1}>
                          Fringes ({categoryFringePct(bid, cat)}%)
                        </td>
                        <td className="px-2 py-0.5 text-right text-[11px] tabular-nums text-[#555]">{fmt(categoryFringe(bid, cat.id, estCol))}</td>
                      </tr>
                    )}
                    {cat.handling && (
                      <tr>
                        <td className="px-2 py-0.5 text-[11px] text-[#555]" colSpan={detailCols - 1}>
                          Handling fee
                        </td>
                        <td className="px-2 py-0.5 text-right text-[11px] tabular-nums text-[#555]">{fmt(categoryHandling(bid, cat.id, estCol))}</td>
                      </tr>
                    )}
                    {(cat.fringes || cat.handling) && (
                      <tr style={{ fontWeight: 700 }}>
                        <td className="px-2 py-0.5 text-[11.5px]" colSpan={detailCols - 1}>
                          Total {cat.letter}
                        </td>
                        <td className="px-2 py-0.5 text-right text-[11.5px] tabular-nums">{fmt(categoryTotal(bid, cat.id, estCol))}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Notes / assumptions */}
      {config.showNotes && bid.notes.trim() && (
        <div className="mt-5">
          <h2 className="mb-1 text-[12px] font-bold uppercase tracking-wide">Notes &amp; Assumptions</h2>
          <ul className="list-disc pl-5 text-[11.5px] leading-relaxed">
            {bid.notes.split("\n").map((line, i) => (line.trim() ? <li key={i}>{line.trim()}</li> : null))}
          </ul>
        </div>
      )}
    </div>
  );
}
