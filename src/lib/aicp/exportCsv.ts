/**
 * Spreadsheet (CSV) export of an AICP bid: job info, then each category's lines
 * with their qty×rate breakdown and the fringe/handling subtotals, then the full
 * summary recap. Numbers are raw (unformatted) so the file opens clean in
 * Excel/Sheets. Pure string-building, kept out of components.
 */
import type { Bid, BidCategory } from "./types";
import { cellKey, categoryLineIds } from "./types";
import {
  estimateColumn,
  actualColumn,
  categorySubtotal,
  categoryFringe,
  categoryHandling,
  categoryFringePct,
  categoryTotal,
  subtotalAtoK,
  productionInsurance,
  productionFee,
  productionTotal,
  postRecap,
  postCategories,
  productionCategories,
  grandTotal,
} from "./totals";

/** RFC-4180 cell escaping. */
export function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function row(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}
function val(bid: Bid, lineId: string, col: string | undefined): number {
  return col ? bid.cells[cellKey(lineId, col)]?.value ?? 0 : 0;
}

export function buildBidCsv(bid: Bid): string {
  const est = estimateColumn(bid);
  if (!est) return "";
  const act = actualColumn(bid);
  const out: string[] = [];

  out.push(row([bid.title || "AICP Bid"]));
  if (bid.subtitle) out.push(row([bid.subtitle]));
  out.push("");

  // Job information
  if (bid.fields.some((f) => f.value)) {
    for (const f of bid.fields) if (f.value) out.push(row([f.label, f.value]));
    out.push("");
  }

  const header = ["Cat", "Description", "Units", "Unit", "Rate", "Qty", "Estimate", ...(act ? ["Actual"] : [])];

  const emitCategory = (cat: BidCategory) => {
    out.push(row([`${cat.letter}. ${cat.name}`]));
    out.push(row(header));
    const emitLines = (ids: string[], subName?: string) => {
      if (subName) out.push(row(["", subName]));
      for (const id of ids) {
        const line = bid.lines[id];
        if (!line) continue;
        const c = bid.cells[cellKey(id, est)];
        out.push(
          row([
            cat.letter,
            line.label,
            c?.unitsExpr ?? "",
            line.unitType,
            c?.rate ?? "",
            c && c.qty !== 1 ? c.qty : "",
            val(bid, id, est),
            ...(act ? [val(bid, id, act)] : []),
          ])
        );
      }
    };
    if (cat.subSections) for (const s of cat.subSections) emitLines(s.lineIds, s.name);
    else emitLines(categoryLineIds(cat));

    out.push(row(["", `Sub-total ${cat.letter}`, "", "", "", "", categorySubtotal(bid, cat.id, est)]));
    if (cat.fringes) out.push(row(["", `Fringes (${categoryFringePct(bid, cat)}%)`, "", "", "", "", categoryFringe(bid, cat.id, est)]));
    if (cat.handling) out.push(row(["", "Handling fee", "", "", "", "", categoryHandling(bid, cat.id, est)]));
    out.push(row(["", `Total ${cat.letter}`, "", "", "", "", categoryTotal(bid, cat.id, est)]));
    out.push("");
  };

  const prod = productionCategories(bid);
  const post = postCategories(bid);
  for (const cat of prod) emitCategory(cat);
  for (const cat of post) emitCategory(cat);

  // Summary recap
  out.push(row(["SUMMARY", "", "", "", "", "", "Estimate", ...(act ? ["Actual"] : [])]));
  const recap = (label: string, e: number, a: number) =>
    out.push(row(["", label, "", "", "", "", e, ...(act ? [a] : [])]));
  for (const c of prod) recap(`${c.letter}. ${c.name}`, categoryTotal(bid, c.id, est), act ? categoryTotal(bid, c.id, act) : 0);
  recap("Sub-Total A to K", subtotalAtoK(bid, est), act ? subtotalAtoK(bid, act) : 0);
  recap("Insurance", productionInsurance(bid, est), act ? productionInsurance(bid, act) : 0);
  recap("Production Fee", productionFee(bid, est), act ? productionFee(bid, act) : 0);
  recap("Production Total", productionTotal(bid, est), act ? productionTotal(bid, act) : 0);
  if (post.length) {
    for (const c of post) recap(`${c.letter}. ${c.name}`, categoryTotal(bid, c.id, est), act ? categoryTotal(bid, c.id, act) : 0);
    recap("Post-Production Total", postRecap(bid, est).total, act ? postRecap(bid, act).total : 0);
  }
  recap("Grand Total", grandTotal(bid, est), act ? grandTotal(bid, act) : 0);

  return out.join("\n");
}
