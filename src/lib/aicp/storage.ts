/**
 * AICP bid persistence: a localStorage index + per-bid blobs, plus migration
 * that fills back anything RTDB drops (empty maps/arrays) and re-derives cached
 * cell values from their expressions so a partial/corrupt write self-heals.
 * Mirrors the Estimator's storage shape so account/cloud sync reuse it.
 */
import { uid } from "../types";
import { migrateAuthor } from "../author";
import { bumpVersion } from "../storage";
import { evalCell } from "./builder";
import { createBid } from "./builder";
import type {
  Bid,
  BidApplicability,
  BidCategory,
  BidCell,
  BidColumn,
  BidField,
  BidLine,
  BidRates,
  BidSubSection,
  BidSummary,
  ColumnKind,
} from "./types";
import { categoryLineIds } from "./types";
import type { AicpCategoryKind, AicpGroup } from "./template";

const INDEX_KEY = "aicp:index";
const BID_PREFIX = "aicp:bid:";
const LAST_OPEN_KEY = "aicp:lastOpen";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function listBids(): BidSummary[] {
  const raw = safeGet(INDEX_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as BidSummary[]).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function loadBid(id: string): Bid | null {
  const raw = safeGet(BID_PREFIX + id);
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

function summaryOf(bid: Bid): BidSummary {
  return {
    id: bid.id,
    title: bid.title,
    subtitle: bid.subtitle,
    updatedAt: bid.updatedAt,
    lineCount: Object.keys(bid.lines).length,
    columnCount: bid.columns.length,
  };
}

export function saveBid(bid: Bid, opts: { setLastOpen?: boolean } = {}): void {
  safeSet(BID_PREFIX + bid.id, JSON.stringify(bid));
  const index = listBids().filter((b) => b.id !== bid.id);
  index.unshift(summaryOf(bid));
  safeSet(INDEX_KEY, JSON.stringify(index));
  if (opts.setLastOpen !== false) safeSet(LAST_OPEN_KEY, bid.id);
}

export function deleteBid(id: string): void {
  try {
    localStorage.removeItem(BID_PREFIX + id);
  } catch {}
  safeSet(INDEX_KEY, JSON.stringify(listBids().filter((b) => b.id !== id)));
}

export function lastOpenId(): string | null {
  return safeGet(LAST_OPEN_KEY);
}

/** A starter bid, saved and returned, for an empty workspace. */
export function sampleBid(): Bid {
  return createBid("Untitled AICP Bid");
}

/** Clone a saved bid into an independent copy, bumping the version in the title
    (or subtitle) like the Workback/Estimator duplicate. Clears the share link. */
export function duplicateBid(id: string): Bid | null {
  const src = loadBid(id);
  if (!src) return null;
  const now = Date.now();
  let title = src.title || "Untitled AICP Bid";
  let subtitle = src.subtitle;
  const bumped = bumpVersion(title);
  if (bumped !== null) title = bumped;
  else {
    const bumpedSub = bumpVersion(subtitle);
    if (bumpedSub !== null) subtitle = bumpedSub;
    else title = `${title} v2`;
  }
  const copy: Bid = JSON.parse(JSON.stringify(src));
  copy.id = uid();
  copy.title = title;
  copy.subtitle = subtitle;
  copy.shareId = undefined;
  copy.createdAt = now;
  copy.updatedAt = now;
  saveBid(copy);
  return copy;
}

// --- migration / normalization ---

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
function bool(v: unknown): boolean {
  return v === true;
}

function migrateColumns(raw: unknown): BidColumn[] {
  const cols = Array.isArray(raw)
    ? (raw as Partial<BidColumn>[])
        .filter((c) => c && typeof c.id === "string" && c.id)
        .map((c, i) => ({
          id: c.id!,
          name: str(c.name, "Column"),
          kind: (["estimate", "actual", "version"].includes(c.kind as string) ? c.kind : "version") as ColumnKind,
          width: typeof c.width === "number" && c.width > 0 ? c.width : undefined,
          order: num(c.order, i),
        }))
        .sort((a, b) => a.order - b.order)
    : [];
  // Guarantee at least an Estimate column so the grid + recap always render.
  if (!cols.some((c) => c.kind === "estimate")) {
    cols.unshift({ id: uid(), name: "Estimate", kind: "estimate", width: undefined, order: -1 });
  }
  return cols.map((c, i) => ({ ...c, order: i }));
}

function migrateLines(raw: unknown): Record<string, BidLine> {
  const out: Record<string, BidLine> = {};
  if (raw && typeof raw === "object") {
    for (const [id, v] of Object.entries(raw as Record<string, Partial<BidLine>>)) {
      if (!v || typeof id !== "string") continue;
      out[id] = {
        id,
        no: typeof v.no === "string" && v.no ? v.no : undefined,
        label: str(v.label, ""),
        unitType: str(v.unitType, "each"),
        note: typeof v.note === "string" && v.note ? v.note : undefined,
        hidden: v.hidden === true ? true : undefined,
        order: num(v.order, 0),
      };
    }
  }
  return out;
}

function migrateSubSections(raw: unknown, lines: Record<string, BidLine>): BidSubSection[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const subs = (raw as Partial<BidSubSection>[])
    .filter((s) => s && typeof s.id === "string" && s.id)
    .map((s, i) => ({
      id: s.id!,
      name: str(s.name, "Section"),
      lineIds: (Array.isArray(s.lineIds) ? s.lineIds : []).filter(
        (id): id is string => typeof id === "string" && id in lines
      ),
      order: num(s.order, i),
    }))
    .sort((a, b) => a.order - b.order);
  return subs.length ? subs : undefined;
}

function migrateCategories(raw: unknown, lines: Record<string, BidLine>): BidCategory[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<BidCategory>[])
    .filter((c) => c && typeof c.id === "string" && c.id)
    .map((c, i) => {
      const subSections = migrateSubSections(c.subSections, lines);
      return {
        id: c.id!,
        letter: str(c.letter, "?"),
        name: str(c.name, "Category"),
        kind: (["labor", "expense", "talent"].includes(c.kind as string) ? c.kind : "expense") as AicpCategoryKind,
        group: (c.group === "post" ? "post" : "production") as AicpGroup,
        fringes: bool(c.fringes),
        handling: bool(c.handling),
        breakout: c.breakout === true ? true : undefined,
        breakoutIncluded: c.breakout === true ? c.breakoutIncluded !== false : undefined,
        lineIds: subSections
          ? []
          : (Array.isArray(c.lineIds) ? c.lineIds : []).filter(
              (id): id is string => typeof id === "string" && id in lines
            ),
        subSections,
        fringePct: typeof c.fringePct === "number" && Number.isFinite(c.fringePct) ? c.fringePct : undefined,
        handlingPct: typeof c.handlingPct === "number" && Number.isFinite(c.handlingPct) ? c.handlingPct : undefined,
        order: num(c.order, i),
        hidden: c.hidden === true ? true : undefined,
      } satisfies BidCategory;
    })
    .sort((a, b) => a.order - b.order);
}

function migrateCells(raw: unknown): Record<string, BidCell> {
  const out: Record<string, BidCell> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, Partial<BidCell>>)) {
      if (!v) continue;
      // Re-derive units/rate/qty/value from the saved expressions so a missing
      // or NaN cache self-heals on load.
      out[k] = evalCell(str(v.unitsExpr, ""), str(v.rateExpr, ""), str(v.qtyExpr, ""));
    }
  }
  return out;
}

function migrateRates(raw: unknown): BidRates {
  const r = (raw ?? {}) as Partial<BidRates>;
  return {
    fringePct: num(r.fringePct, 0),
    handlingPct: num(r.handlingPct, 0),
    productionFeePct: num(r.productionFeePct, 0),
    insuranceProdPct: num(r.insuranceProdPct, 0),
    sectionXFeePct: num(r.sectionXFeePct, 0),
    postInsurancePct: num(r.postInsurancePct, 0),
    postMarkupPct: num(r.postMarkupPct, 0),
    postTaxPct: num(r.postTaxPct, 0),
  };
}

function migrateBoolMap(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v === true) out[k] = true;
    }
  }
  return out;
}

function migrateApplicability(raw: unknown): BidApplicability {
  const a = (raw ?? {}) as Partial<BidApplicability>;
  return { productionFee: migrateBoolMap(a.productionFee), insurance: migrateBoolMap(a.insurance) };
}

function migrateFields(raw: unknown): BidField[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<BidField>[])
    .filter((f) => f && (typeof f.label === "string" || typeof f.value === "string"))
    .map((f) => ({
      id: typeof f!.id === "string" && f!.id ? f!.id : uid(),
      label: str(f!.label, ""),
      value: str(f!.value, ""),
    }));
}

function migrateContingencies(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter((x): x is string => typeof x === "string");
}

export function migrate(data: unknown): Bid {
  const e = data as Partial<Bid>;
  if (!e || typeof e !== "object") throw new Error("Not a Bid");
  const lines = migrateLines(e.lines);
  const now = Date.now();
  const logoUrl = typeof e.logoUrl === "string" && e.logoUrl ? e.logoUrl : undefined;
  return {
    schema: 1,
    id: typeof e.id === "string" ? e.id : uid(),
    title: str(e.title, "Untitled AICP Bid"),
    subtitle: str(e.subtitle, ""),
    templateVersion: str(e.templateVersion, "AICP 2023"),
    fields: migrateFields(e.fields),
    currency: str(e.currency, "USD"),
    logoUrl,
    notes: str(e.notes, ""),
    columns: migrateColumns(e.columns),
    categories: migrateCategories(e.categories, lines),
    lines,
    cells: migrateCells(e.cells),
    rates: migrateRates(e.rates),
    applicability: migrateApplicability(e.applicability),
    contingencies: migrateContingencies(e.contingencies),
    shareId: typeof e.shareId === "string" && e.shareId ? e.shareId : undefined,
    createdBy: migrateAuthor((e as { createdBy?: unknown }).createdBy),
    createdAt: num(e.createdAt, now),
    updatedAt: num(e.updatedAt, now),
  };
}

/** Total line count across a bid's categories (for summaries/empty-state). */
export function bidLineCount(bid: Bid): number {
  return bid.categories.reduce((n, c) => n + categoryLineIds(c).length, 0);
}
