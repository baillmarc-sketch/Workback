/**
 * Pure, immutable edit helpers for a Bid — every one returns a new Bid and never
 * mutates its input, so the store's commit/patch (and undo history) stay correct.
 * Kept out of components so the editing logic is unit-testable.
 */
import { uid } from "../types";
import { evalCell, emptyCell } from "./builder";
import type { Bid, BidCategory, BidCell, BidLine } from "./types";
import { cellKey, categoryLineIds } from "./types";

type EstimateField = "units" | "rate" | "qty";

function withLine(bid: Bid, lineId: string, up: (l: BidLine) => BidLine): Bid {
  const line = bid.lines[lineId];
  if (!line) return bid;
  return { ...bid, lines: { ...bid.lines, [lineId]: up(line) } };
}

function withCategory(bid: Bid, categoryId: string, up: (c: BidCategory) => BidCategory): Bid {
  return { ...bid, categories: bid.categories.map((c) => (c.id === categoryId ? up(c) : c)) };
}

/** Read a cell (or a blank one) for editing. */
export function readCell(bid: Bid, lineId: string, columnId: string): BidCell {
  return bid.cells[cellKey(lineId, columnId)] ?? emptyCell();
}

/** Set one of the Estimate cell's three expressions (Units / Rate / QTY) and
    re-evaluate the cell. An all-blank cell is removed so RTDB stays sparse. */
export function setEstimateField(
  bid: Bid,
  lineId: string,
  columnId: string,
  field: EstimateField,
  expr: string
): Bid {
  const cur = readCell(bid, lineId, columnId);
  const next = evalCell(
    field === "units" ? expr : cur.unitsExpr,
    field === "rate" ? expr : cur.rateExpr,
    field === "qty" ? expr : cur.qtyExpr
  );
  const cells = { ...bid.cells };
  const key = cellKey(lineId, columnId);
  if (next.unitsExpr.trim() === "" && next.rateExpr.trim() === "" && next.qtyExpr.trim() === "") {
    delete cells[key];
  } else {
    cells[key] = next;
  }
  return { ...bid, cells };
}

/** Set an Actual (or any column) as a single lump amount — units/qty = 1 so the
    value equals the entered amount. Blank clears the cell. */
export function setActualAmount(bid: Bid, lineId: string, columnId: string, expr: string): Bid {
  const cells = { ...bid.cells };
  const key = cellKey(lineId, columnId);
  if (expr.trim() === "") {
    delete cells[key];
  } else {
    cells[key] = evalCell("1", expr, "1");
  }
  return { ...bid, cells };
}

/** Append a new (blank) line to a flat category, or to one of its sub-sections. */
export function addLine(bid: Bid, categoryId: string, opts: { subSectionId?: string; label?: string } = {}): Bid {
  const cat = bid.categories.find((c) => c.id === categoryId);
  if (!cat) return bid;
  const existing = bid.categories.flatMap((c) =>
    (c.subSections ? c.subSections.flatMap((s) => s.lineIds) : c.lineIds).map((id) => bid.lines[id]?.order ?? 0)
  );
  const order = (existing.length ? Math.max(...existing) : 0) + 1;
  const line: BidLine = { id: uid(), label: opts.label ?? "", unitType: cat.kind === "labor" ? "days" : "each", order };
  const lines = { ...bid.lines, [line.id]: line };
  const next = withCategory(bid, categoryId, (c) => {
    if (opts.subSectionId && c.subSections) {
      return {
        ...c,
        subSections: c.subSections.map((s) =>
          s.id === opts.subSectionId ? { ...s, lineIds: [...s.lineIds, line.id] } : s
        ),
      };
    }
    return { ...c, lineIds: [...c.lineIds, line.id] };
  });
  return { ...next, lines };
}

export function renameLine(bid: Bid, lineId: string, label: string): Bid {
  return withLine(bid, lineId, (l) => ({ ...l, label }));
}

/** Set a line's AICP number (the "No." column); blank clears it. */
export function setLineNo(bid: Bid, lineId: string, no: string): Bid {
  return withLine(bid, lineId, (l) => ({ ...l, no: no.trim() ? no.trim() : undefined }));
}

export function setLineUnitType(bid: Bid, lineId: string, unitType: string): Bid {
  return withLine(bid, lineId, (l) => ({ ...l, unitType }));
}

export function setLineNote(bid: Bid, lineId: string, note: string): Bid {
  return withLine(bid, lineId, (l) => ({ ...l, note: note.trim() ? note : undefined }));
}

export function toggleLineHidden(bid: Bid, lineId: string): Bid {
  return withLine(bid, lineId, (l) => ({ ...l, hidden: l.hidden ? undefined : true }));
}

/** Remove a line: drop it from its category/sub-section, the lines map, and any
    cells booked against it (across every column). */
export function removeLine(bid: Bid, lineId: string): Bid {
  const lines = { ...bid.lines };
  delete lines[lineId];
  const cells = { ...bid.cells };
  for (const k of Object.keys(cells)) {
    if (k.startsWith(`${lineId}:`)) delete cells[k];
  }
  const categories = bid.categories.map((c) => ({
    ...c,
    lineIds: c.lineIds.filter((id) => id !== lineId),
    subSections: c.subSections?.map((s) => ({ ...s, lineIds: s.lineIds.filter((id) => id !== lineId) })),
  }));
  return { ...bid, lines, cells, categories };
}

export function toggleCategoryHidden(bid: Bid, categoryId: string): Bid {
  return withCategory(bid, categoryId, (c) => ({ ...c, hidden: c.hidden ? undefined : true }));
}

// --- sub-sections (X / P breakouts) ---

export function addSubSection(bid: Bid, categoryId: string, name = "New section"): Bid {
  return withCategory(bid, categoryId, (c) => {
    const subs = c.subSections ?? [];
    const order = (subs.length ? Math.max(...subs.map((s) => s.order)) : -1) + 1;
    return { ...c, subSections: [...subs, { id: uid(), name, lineIds: [], order }] };
  });
}

export function renameSubSection(bid: Bid, categoryId: string, subId: string, name: string): Bid {
  return withCategory(bid, categoryId, (c) => ({
    ...c,
    subSections: c.subSections?.map((s) => (s.id === subId ? { ...s, name } : s)),
  }));
}

export function removeSubSection(bid: Bid, categoryId: string, subId: string): Bid {
  const cat = bid.categories.find((c) => c.id === categoryId);
  const sub = cat?.subSections?.find((s) => s.id === subId);
  let next = bid;
  for (const id of sub?.lineIds ?? []) next = removeLine(next, id);
  return withCategory(next, categoryId, (c) => ({
    ...c,
    subSections: c.subSections?.filter((s) => s.id !== subId),
  }));
}

// --- rates & applicability ---

export function setRate(bid: Bid, key: keyof Bid["rates"], value: number): Bid {
  return { ...bid, rates: { ...bid.rates, [key]: Number.isFinite(value) ? value : 0 } };
}

export function setCategoryFringePct(bid: Bid, categoryId: string, value: number | undefined): Bid {
  return withCategory(bid, categoryId, (c) => ({
    ...c,
    fringePct: value === undefined || !Number.isFinite(value) ? undefined : value,
  }));
}

export function toggleApplicability(bid: Bid, which: "productionFee" | "insurance", categoryId: string): Bid {
  const cur = bid.applicability[which][categoryId] === true;
  return {
    ...bid,
    applicability: {
      ...bid.applicability,
      [which]: { ...bid.applicability[which], [categoryId]: !cur },
    },
  };
}

// --- P breakout sections (additional production estimates) ---

/** Add a P breakout: an extra production category that can be included in or
    excluded from the production total. Seeded with one empty sub-section like X. */
export function addBreakoutCategory(bid: Bid, name = "Additional Production Estimate"): Bid {
  const n = bid.categories.filter((c) => c.breakout).length + 1;
  const lastProdOrder = Math.max(0, ...bid.categories.filter((c) => c.group === "production").map((c) => c.order));
  const cat: BidCategory = {
    id: uid(),
    letter: `P${n}`,
    name,
    kind: "expense",
    group: "production",
    fringes: false,
    handling: false,
    breakout: true,
    breakoutIncluded: true,
    lineIds: [],
    subSections: [{ id: uid(), name: "Section 1", lineIds: [], order: 0 }],
    order: lastProdOrder + 0.5,
  };
  // Re-pack orders so the breakout sits at the end of the production group.
  const categories = [...bid.categories, cat].sort((a, b) => a.order - b.order).map((c, i) => ({ ...c, order: i }));
  return {
    ...bid,
    categories,
    applicability: {
      productionFee: { ...bid.applicability.productionFee, [cat.id]: false },
      insurance: { ...bid.applicability.insurance, [cat.id]: false },
    },
  };
}

export function renameCategory(bid: Bid, categoryId: string, name: string): Bid {
  return withCategory(bid, categoryId, (c) => ({ ...c, name }));
}

export function toggleBreakoutIncluded(bid: Bid, categoryId: string): Bid {
  return withCategory(bid, categoryId, (c) =>
    c.breakout ? { ...c, breakoutIncluded: c.breakoutIncluded === false } : c
  );
}

/** Remove a breakout category (never a standard A–X category): drop it, its
    lines, their cells, and its applicability entries. */
export function removeBreakoutCategory(bid: Bid, categoryId: string): Bid {
  const cat = bid.categories.find((c) => c.id === categoryId);
  if (!cat || !cat.breakout) return bid;
  let next = bid;
  for (const id of categoryLineIds(cat)) next = removeLine(next, id);
  const productionFee = { ...next.applicability.productionFee };
  const insurance = { ...next.applicability.insurance };
  delete productionFee[categoryId];
  delete insurance[categoryId];
  return {
    ...next,
    categories: next.categories.filter((c) => c.id !== categoryId),
    applicability: { productionFee, insurance },
  };
}

// --- columns (versions) ---

export function addVersionColumn(bid: Bid, name?: string): Bid {
  const order = bid.columns.length;
  const n = bid.columns.filter((c) => c.kind === "version").length + 2;
  return {
    ...bid,
    columns: [...bid.columns, { id: uid(), name: name ?? `v${n}`, kind: "version", order }],
  };
}

export function renameColumn(bid: Bid, columnId: string, name: string): Bid {
  return { ...bid, columns: bid.columns.map((c) => (c.id === columnId ? { ...c, name } : c)) };
}

export function removeColumn(bid: Bid, columnId: string): Bid {
  const col = bid.columns.find((c) => c.id === columnId);
  if (!col || col.kind !== "version") return bid; // never drop Estimate/Actual
  const cells = { ...bid.cells };
  for (const k of Object.keys(cells)) {
    if (k.endsWith(`:${columnId}`)) delete cells[k];
  }
  return { ...bid, columns: bid.columns.filter((c) => c.id !== columnId), cells };
}
