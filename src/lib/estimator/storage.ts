import type {
  Adjustment,
  AdjustmentType,
  CellValue,
  ColumnLink,
  ColumnRole,
  Deliverable,
  Estimate,
  EstimateColumn,
  EstimateLineItem,
  EstimateSection,
  EstimateSummary,
  LedgerEntry,
  LedgerKind,
  ProjectField,
  TeamMember,
} from "./types";
import { uid } from "../types";
import { migrateAuthor } from "../author";
import { bumpVersion } from "../storage";
import { evalOrZero } from "./formula";
import { estimateTemplateById, type EstimateTemplateId } from "./templates";

const INDEX_KEY = "estimator:index";
const ESTIMATE_PREFIX = "estimator:estimate:";
const LAST_OPEN_KEY = "estimator:lastOpen";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function trySet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeSet(key: string, value: string): void {
  trySet(key, value);
}

export function listEstimates(): EstimateSummary[] {
  const raw = safeGet(INDEX_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as EstimateSummary[];
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function loadEstimate(id: string): Estimate | null {
  const raw = safeGet(ESTIMATE_PREFIX + id);
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

function summaryOf(est: Estimate): EstimateSummary {
  return {
    id: est.id,
    title: est.title,
    subtitle: est.subtitle,
    updatedAt: est.updatedAt,
    lineItemCount: Object.keys(est.lineItems).length,
    columnCount: est.columns.length,
  };
}

export function saveEstimate(estimate: Estimate, opts: { setLastOpen?: boolean } = {}): void {
  const key = ESTIMATE_PREFIX + estimate.id;
  trySet(key, JSON.stringify(estimate));
  const index = listEstimates().filter((e) => e.id !== estimate.id);
  index.unshift(summaryOf(estimate));
  safeSet(INDEX_KEY, JSON.stringify(index));
  // Background account syncs save quietly so they don't hijack which estimate
  // reopens on the next visit
  if (opts.setLastOpen !== false) safeSet(LAST_OPEN_KEY, estimate.id);
}

export function deleteEstimate(id: string): void {
  try {
    localStorage.removeItem(ESTIMATE_PREFIX + id);
  } catch {}
  safeSet(INDEX_KEY, JSON.stringify(listEstimates().filter((e) => e.id !== id)));
}

export function lastOpenId(): string | null {
  return safeGet(LAST_OPEN_KEY);
}

/** Clone a saved estimate into an independent copy. Versioning mirrors the
    Workback duplicate: an existing "vN" in title (or subtitle) is bumped,
    otherwise a "v2" is appended. The share link is cleared. */
export function duplicateEstimate(id: string): Estimate | null {
  const src = loadEstimate(id);
  if (!src) return null;
  const now = Date.now();
  let title = src.title || "Untitled Estimate";
  let subtitle = src.subtitle;
  const bumpedTitle = bumpVersion(title);
  if (bumpedTitle !== null) {
    title = bumpedTitle;
  } else {
    const bumpedSub = bumpVersion(subtitle);
    if (bumpedSub !== null) subtitle = bumpedSub;
    else title = `${title} v2`;
  }
  const copy: Estimate = {
    ...src,
    id: uid(),
    title,
    subtitle,
    shareId: undefined,
    createdAt: now,
    updatedAt: now,
    fields: src.fields.map((f) => ({ ...f })),
    deliverables: src.deliverables.map((d) => ({ ...d })),
    team: src.team.map((m) => ({ ...m })),
    adjustments: src.adjustments.map((a) => ({ ...a })),
    sections: src.sections.map((s) => ({ ...s, lineItemIds: [...s.lineItemIds] })),
    lineItems: Object.fromEntries(Object.entries(src.lineItems).map(([k, v]) => [k, { ...v }])),
    columns: src.columns.map((c) => ({
      ...c,
      links: c.links?.map((l) => ({ ...l })),
      adjustmentOverrides: c.adjustmentOverrides ? { ...c.adjustmentOverrides } : undefined,
      adjustmentSectionsOff: c.adjustmentSectionsOff ? { ...c.adjustmentSectionsOff } : undefined,
    })),
    cells: Object.fromEntries(Object.entries(src.cells).map(([k, v]) => [k, { ...v }])),
    ledger: src.ledger.map((x) => ({ ...x })),
  };
  saveEstimate(copy);
  return copy;
}

// --- migration / normalization ---

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function migrateLinks(raw: unknown): ColumnLink[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const links = (raw as Partial<ColumnLink>[])
    .filter((l) => l && typeof l.url === "string" && l.url.trim())
    .map((l) => ({ label: str(l!.label, "").trim() || l!.url!.trim(), url: l!.url!.trim() }));
  return links.length ? links : undefined;
}

function migrateOverrides(raw: unknown): Record<string, number | null> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === null) out[k] = null;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Per-(adjustment × section) opt-outs: keep only truthy flags. */
function migrateSectionsOff(raw: unknown): Record<string, true> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, true> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v) out[k] = true;
  }
  return Object.keys(out).length ? out : undefined;
}

function migrateColumns(raw: unknown): EstimateColumn[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<EstimateColumn>[])
    .filter((c) => c && typeof c.id === "string" && c.id)
    .map((c, i) => ({
      id: c.id!,
      name: str(c.name, "Column"),
      role: (c.role === "vendor" ? "vendor" : "version") as ColumnRole,
      range: c.range === true ? true : undefined,
      vendor: typeof c.vendor === "string" && c.vendor ? c.vendor : undefined,
      notes: typeof c.notes === "string" && c.notes ? c.notes : undefined,
      links: migrateLinks(c.links),
      adjustmentOverrides: migrateOverrides(c.adjustmentOverrides),
      adjustmentSectionsOff: migrateSectionsOff(c.adjustmentSectionsOff),
      width: typeof c.width === "number" && Number.isFinite(c.width) && c.width > 0 ? c.width : undefined,
      order: num(c.order, i),
    }))
    .sort((a, b) => a.order - b.order);
}

function migrateFields(raw: unknown): ProjectField[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<ProjectField>[])
    .filter((f) => f && (typeof f.label === "string" || typeof f.value === "string"))
    .map((f) => ({ id: typeof f!.id === "string" && f!.id ? f!.id : uid(), label: str(f!.label, ""), value: str(f!.value, "") }));
}

function migrateDeliverables(raw: unknown): Deliverable[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<Deliverable>[])
    .filter((d) => !!d)
    .map((d) => ({
      id: typeof d!.id === "string" && d!.id ? d!.id : uid(),
      title: str(d!.title, ""),
      length: str(d!.length, ""),
      usage: str(d!.usage, ""),
    }));
}

function migrateTeam(raw: unknown): TeamMember[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<TeamMember>[])
    .filter((m) => !!m)
    .map((m) => ({
      id: typeof m!.id === "string" && m!.id ? m!.id : uid(),
      name: str(m!.name, ""),
      role: str(m!.role, ""),
      level: str(m!.level, ""),
      hours: str(m!.hours, ""),
    }));
}

/** Below-the-line adjustments. Folds legacy per-column markup/contingency (and
    the old estimate-level defaults) into estimate-wide adjustment rows. */
function migrateAdjustments(e: Partial<Estimate> & { defaultMarkupPct?: unknown; columns?: unknown }): Adjustment[] {
  const raw = (e as { adjustments?: unknown }).adjustments;
  if (Array.isArray(raw)) {
    return (raw as Partial<Adjustment>[])
      .filter((a) => a && typeof a.label === "string")
      .map((a) => ({
        id: typeof a!.id === "string" && a!.id ? a!.id : uid(),
        label: str(a!.label, "Adjustment"),
        type: (a!.type === "flat" ? "flat" : "percent") as AdjustmentType,
        value: num(a!.value, 0),
      }));
  }
  // Legacy conversion: estimate defaults, else the first column's markup/contingency.
  const cols = Array.isArray(e.columns) ? (e.columns as { markupPct?: number; contingencyPct?: number }[]) : [];
  const markup = num((e as { defaultMarkupPct?: number }).defaultMarkupPct, num(cols[0]?.markupPct, 0));
  const contingency = num((e as { defaultContingencyPct?: number }).defaultContingencyPct, num(cols[0]?.contingencyPct, 0));
  const out: Adjustment[] = [];
  if (markup) out.push({ id: uid(), label: "Markup", type: "percent", value: markup });
  if (contingency) out.push({ id: uid(), label: "Contingency", type: "percent", value: contingency });
  return out;
}

function migrateLineItems(raw: unknown): Record<string, EstimateLineItem> {
  const out: Record<string, EstimateLineItem> = {};
  if (raw && typeof raw === "object") {
    for (const [id, v] of Object.entries(raw as Record<string, Partial<EstimateLineItem>>)) {
      if (!v || typeof id !== "string") continue;
      out[id] = {
        id,
        label: str(v.label, "Line item"),
        note: typeof v.note === "string" && v.note ? v.note : undefined,
        order: num(v.order, 0),
      };
    }
  }
  return out;
}

function migrateSections(raw: unknown, lineItems: Record<string, EstimateLineItem>): EstimateSection[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<EstimateSection>[])
    .filter((s) => s && typeof s.id === "string" && s.id)
    .map((s, i) => ({
      id: s.id!,
      name: str(s.name, "Section"),
      // RTDB drops empty arrays, so a section with no items returns undefined.
      // Keep only ids that still resolve to a known line item.
      lineItemIds: (Array.isArray(s.lineItemIds) ? s.lineItemIds : []).filter(
        (id): id is string => typeof id === "string" && id in lineItems
      ),
      order: num(s.order, i),
    }))
    .sort((a, b) => a.order - b.order);
}

function migrateCell(v: Partial<CellValue> | undefined): CellValue {
  const expr = str(v?.expr, "");
  // Recompute the cached value from the raw expression so a missing/NaN cache
  // (hand-edits, partial writes) self-heals on load.
  const value = typeof v?.value === "number" && Number.isFinite(v.value) ? v.value : evalOrZero(expr);
  const cell: CellValue = { expr, value };
  if (typeof v?.highExpr === "string" && v.highExpr) {
    cell.highExpr = v.highExpr;
    cell.high = typeof v?.high === "number" && Number.isFinite(v.high) ? v.high : evalOrZero(v.highExpr);
  }
  return cell;
}

function migrateCells(raw: unknown): Record<string, CellValue> {
  const out: Record<string, CellValue> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, Partial<CellValue>>)) {
      if (!v) continue;
      out[k] = migrateCell(v);
    }
  }
  return out;
}

/** Read the PO/invoice ledger, and fold any legacy `actuals` map (single
    committed/actual value per line) into one entry each so older saves keep
    their numbers. RTDB drops empty arrays, so `ledger` may be undefined. */
function migrateLedger(e: Partial<Estimate> & { actuals?: unknown }): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  const raw = (e as { ledger?: unknown }).ledger;
  if (Array.isArray(raw)) {
    for (const x of raw as Partial<LedgerEntry>[]) {
      if (!x || typeof x.lineItemId !== "string" || !x.lineItemId) continue;
      const amount = num(x.amount, 0);
      out.push({
        id: typeof x.id === "string" && x.id ? x.id : uid(),
        lineItemId: x.lineItemId,
        kind: (x.kind === "invoice" ? "invoice" : "po") as LedgerKind,
        amount,
        ref: typeof x.ref === "string" && x.ref ? x.ref : undefined,
        vendor: typeof x.vendor === "string" && x.vendor ? x.vendor : undefined,
        date: typeof x.date === "string" && x.date ? x.date : undefined,
        note: typeof x.note === "string" && x.note ? x.note : undefined,
      });
    }
  }
  // Legacy: { lineItemId: { committed: {value}, actual: {value} } }
  const legacy = (e as { actuals?: unknown }).actuals;
  if (legacy && typeof legacy === "object") {
    for (const [lineItemId, v] of Object.entries(legacy as Record<string, { committed?: { value?: number }; actual?: { value?: number } }>)) {
      const c = v?.committed?.value;
      const a = v?.actual?.value;
      if (typeof c === "number" && Number.isFinite(c) && c !== 0) {
        out.push({ id: uid(), lineItemId, kind: "po", amount: c, ref: "Imported" });
      }
      if (typeof a === "number" && Number.isFinite(a) && a !== 0) {
        out.push({ id: uid(), lineItemId, kind: "invoice", amount: a, ref: "Imported" });
      }
    }
  }
  return out;
}

export function migrate(data: unknown): Estimate {
  const e = data as Partial<Estimate>;
  if (!e || typeof e !== "object") throw new Error("Not an Estimate");
  const lineItems = migrateLineItems(e.lineItems);
  const now = Date.now();
  return {
    schema: 1,
    id: typeof e.id === "string" ? e.id : uid(),
    title: str(e.title, "Untitled Estimate"),
    subtitle: str(e.subtitle, ""),
    notes: str(e.notes, ""),
    assumptions: str(e.assumptions, ""),
    currency: str(e.currency, "USD"),
    fields: migrateFields(e.fields),
    deliverables: migrateDeliverables(e.deliverables),
    deliverablesShowSpecs: e.deliverablesShowSpecs === false ? false : true,
    logoUrl: typeof e.logoUrl === "string" && e.logoUrl ? e.logoUrl : undefined,
    team: migrateTeam(e.team),
    adjustments: migrateAdjustments(e),
    sections: migrateSections(e.sections, lineItems),
    lineItems,
    columns: migrateColumns(e.columns),
    cells: migrateCells(e.cells),
    ledger: migrateLedger(e),
    baselineColumnId:
      typeof e.baselineColumnId === "string" && e.baselineColumnId ? e.baselineColumnId : undefined,
    awardedColumnId:
      typeof e.awardedColumnId === "string" && e.awardedColumnId ? e.awardedColumnId : undefined,
    actualsSourceColumnId:
      typeof e.actualsSourceColumnId === "string" && e.actualsSourceColumnId
        ? e.actualsSourceColumnId
        : undefined,
    shareId: typeof e.shareId === "string" && e.shareId ? e.shareId : undefined,
    createdBy: migrateAuthor(e.createdBy),
    createdAt: num(e.createdAt, now),
    updatedAt: num(e.updatedAt, now),
  };
}

// --- constructors ---

/** Build a new estimate from a starter template: its sections and (empty) line
    items are pre-filled so you only need to type the numbers. */
export function newEstimate(templateId: EstimateTemplateId = "video"): Estimate {
  const now = Date.now();
  const template = estimateTemplateById(templateId);
  const firstColumn: EstimateColumn = { id: uid(), name: "Internal v1", role: "version", order: 0 };
  const lineItems: Record<string, EstimateLineItem> = {};
  const cells: Record<string, CellValue> = {};
  let order = 0;
  const sections: EstimateSection[] = template.sections.map((s, i) => {
    const lineItemIds = s.items.map((item) => {
      const label = typeof item === "string" ? item : item.label;
      const amount = typeof item === "string" ? undefined : item.amount;
      const id = uid();
      lineItems[id] = { id, label, order: order++ };
      if (amount !== undefined) cells[`${id}:${firstColumn.id}`] = { expr: String(amount), value: amount };
      return id;
    });
    return { id: uid(), name: s.name, lineItemIds, order: i };
  });
  return {
    schema: 1,
    id: uid(),
    title: "Untitled Estimate",
    subtitle: "",
    notes: "",
    assumptions: template.assumptions,
    currency: "USD",
    fields: template.fields.map((label) => ({ id: uid(), label, value: "" })),
    deliverables: [],
    deliverablesShowSpecs: template.deliverablesShowSpecs,
    team: [],
    adjustments: template.adjustments.map((a) => ({ id: uid(), ...a })),
    sections,
    lineItems,
    columns: [firstColumn],
    cells,
    ledger: [],
    baselineColumnId: firstColumn.id,
    createdAt: now,
    updatedAt: now,
  };
}

/** A starter estimate that shows the grid at a glance: an internal estimate
    column (baseline) beside three vendor bids (triple bid), one marked awarded,
    plus a PO/invoice ledger so the Actuals view has real variance. Built from a
    compact spec so the film and activation samples stay readable. */
type SampleRow = [label: string, internal: number, a: number, b: number, c: number];
interface SampleSpec {
  title: string;
  subtitle: string;
  showSpecs: boolean;
  fields: [string, string][];
  deliverables: { title: string; length: string; usage: string }[];
  assumptions: string;
  vendors: [string, string, string];
  sections: { name: string; rows: SampleRow[] }[];
  /** Index (0–2) of the vendor bid that won; feeds the Actuals estimate. */
  awarded: 0 | 1 | 2;
  /** PO/invoice bookings against the awarded bid: [sectionIdx, rowIdx, po, invoice, refNo]. */
  ledger: [number, number, number, number, number][];
}

function buildSample(spec: SampleSpec): Estimate {
  const now = Date.now();
  const internal: EstimateColumn = { id: uid(), name: "Internal Estimate", role: "version", order: 0 };
  const vendorCols: EstimateColumn[] = spec.vendors.map((company, i) => ({
    id: uid(),
    name: `Bid ${String.fromCharCode(65 + i)}`,
    role: "vendor",
    vendor: company,
    order: i + 1,
  }));
  const columns = [internal, ...vendorCols];

  const lineItems: Record<string, EstimateLineItem> = {};
  const cells: Record<string, CellValue> = {};
  const sections: EstimateSection[] = [];
  const rowIds: string[][] = [];
  let order = 0;
  spec.sections.forEach((sec, si) => {
    const ids: string[] = [];
    for (const row of sec.rows) {
      const id = uid();
      lineItems[id] = { id, label: row[0], order: order++ };
      [row[1], row[2], row[3], row[4]].forEach((amount, ci) => {
        if (amount) cells[`${id}:${columns[ci].id}`] = { expr: String(amount), value: amount };
      });
      ids.push(id);
    }
    rowIds.push(ids);
    sections.push({ id: uid(), name: sec.name, lineItemIds: ids, order: si });
  });

  const awardedCol = vendorCols[spec.awarded];
  const ledger: LedgerEntry[] = [];
  for (const [si, ri, po, inv, ref] of spec.ledger) {
    const lineItemId = rowIds[si]?.[ri];
    if (!lineItemId) continue;
    if (po) ledger.push({ id: uid(), lineItemId, kind: "po", amount: po, ref: `PO-${ref}`, vendor: awardedCol.vendor });
    if (inv) ledger.push({ id: uid(), lineItemId, kind: "invoice", amount: inv, ref: `INV-${ref}`, vendor: awardedCol.vendor });
  }

  return {
    schema: 1,
    id: uid(),
    title: spec.title,
    subtitle: spec.subtitle,
    notes: "",
    assumptions: spec.assumptions,
    currency: "USD",
    fields: spec.fields.map(([label, value]) => ({ id: uid(), label, value })),
    deliverables: spec.deliverables.map((d) => ({ id: uid(), ...d })),
    deliverablesShowSpecs: spec.showSpecs,
    team: [],
    adjustments: [
      { id: uid(), label: "Contingency", type: "percent", value: 10 },
      { id: uid(), label: "Insurance", type: "percent", value: 2 },
      { id: uid(), label: "Sales Tax", type: "percent", value: 0 },
    ],
    sections,
    lineItems,
    columns,
    cells,
    ledger,
    baselineColumnId: internal.id,
    awardedColumnId: awardedCol.id,
    actualsSourceColumnId: awardedCol.id,
    createdAt: now,
    updatedAt: now,
  };
}

/** Sample film/video production budget — triple bid + actuals. */
export function sampleFilmEstimate(): Estimate {
  return buildSample({
    title: "Sample Film — Brand Spot",
    subtitle: "Acme x Brand · :30 + cutdowns · 2026",
    showSpecs: true,
    fields: [
      ["Client", "Acme"],
      ["Product", "Brand Spot"],
      ["Job #", "AC-2601"],
      ["Director", "TBD"],
      ["Shoot Dates", "TBD"],
      ["Producer", ""],
    ],
    deliverables: [
      { title: ":30 Hero Spot", length: ":30", usage: "1yr NA, digital + broadcast" },
      { title: ":15 Cutdown", length: ":15", usage: "1yr NA, digital" },
      { title: ":06 Bumper", length: ":06", usage: "1yr NA, social" },
    ],
    assumptions:
      "Two (2) shoot days in Los Angeles.\nClient provides final script and brand assets.\nUsage: 1 year, North America, digital + broadcast.\nTalent buyout for 6 on-camera principals; celebrity talent not included.\nMusic: needledrop/stock unless noted.\nContingency, insurance, and sales tax applied to the whole project below.",
    vendors: ["Acme Films", "Northside Pictures", "Lantern & Co."],
    sections: [
      {
        name: "Pre-Production",
        rows: [
          ["Director", 25000, 22000, 28000, 24000],
          ["Line Producer", 18000, 16000, 20000, 17500],
          ["Casting", 6000, 5500, 7000, 6500],
          ["Location Scout & Permits", 4500, 4000, 5000, 4200],
        ],
      },
      {
        name: "Production",
        rows: [
          ["Crew (3 days)", 90000, 85000, 98000, 92000],
          ["Camera & Lighting", 38000, 35000, 42000, 40000],
          ["Art Dept / Set", 28000, 26000, 31000, 29000],
          ["Talent (6 principals)", 45000, 44000, 48000, 46000],
          ["Wardrobe / HMU", 14000, 13000, 16000, 15000],
          ["Catering", 9000, 8500, 10000, 9500],
        ],
      },
      {
        name: "Post-Production",
        rows: [
          ["Editorial (4 weeks)", 32000, 30000, 36000, 34000],
          ["Color Grade", 12000, 11000, 13500, 12500],
          ["VFX / Online", 22000, 20000, 26000, 24000],
          ["Sound Design & Mix", 10000, 9500, 11000, 10500],
        ],
      },
      {
        name: "Music & Licensing",
        rows: [["License / Composition", 20000, 18000, 24000, 22000]],
      },
    ],
    awarded: 0, // Acme Films
    ledger: [
      [0, 0, 22000, 22000, 101], // Director — paid in full
      [1, 0, 85000, 86500, 110], // Crew — came in over
      [1, 1, 35000, 34200, 111], // Camera — under
      [1, 3, 44000, 22000, 112], // Talent — half invoiced
      [2, 0, 30000, 0, 120], // Editorial — committed, not yet invoiced
      [2, 1, 11000, 11000, 121], // Color — paid
    ],
  });
}

/** Sample brand-activation / experiential budget — triple bid + actuals. */
export function sampleActivationEstimate(): Estimate {
  return buildSample({
    title: "Sample Activation — Brand House",
    subtitle: "Acme · 2-day experiential · 2026",
    showSpecs: false,
    fields: [
      ["Client", "Acme"],
      ["Activation", "Brand House"],
      ["Job #", "AC-2602"],
      ["Event Dates", "TBD"],
      ["Venue", "Austin, TX"],
      ["Producer", ""],
    ],
    deliverables: [
      { title: "2-Day On-site Brand Activation", length: "", usage: "" },
      { title: "Recap / Sizzle Reel", length: "", usage: "" },
      { title: "Lead-capture & Analytics Report", length: "", usage: "" },
    ],
    assumptions:
      "One (1) two-day activation with public + VIP hours.\nTwo (2) build days and one (1) strike day at the venue.\nVenue, permits, and power are estimates pending final venue selection.\nStaffing assumes 12 brand ambassadors across show days.\nF&B based on expected attendance; alcohol service permitted.\nContingency, insurance, and sales tax applied to the whole project below.",
    vendors: ["Splash Events", "Livewire Experiential", "Bigtop Productions"],
    sections: [
      {
        name: "Venue & Logistics",
        rows: [
          ["Venue Rental (2 days)", 60000, 58000, 65000, 62000],
          ["Permits & Insurance Riders", 8000, 7500, 9000, 8500],
          ["Power & Generators", 12000, 11000, 14000, 13000],
          ["Security", 9000, 8500, 10000, 9500],
        ],
      },
      {
        name: "Production & Build",
        rows: [
          ["Custom Booth Fabrication", 85000, 80000, 95000, 90000],
          ["AV & Lighting", 42000, 40000, 48000, 45000],
          ["Signage & Graphics", 18000, 16000, 21000, 19000],
          ["Furniture & Decor Rental", 14000, 13000, 16000, 15000],
        ],
      },
      {
        name: "Staffing",
        rows: [
          ["Brand Ambassadors (12)", 36000, 34000, 40000, 38000],
          ["Event Manager", 15000, 14000, 17000, 16000],
          ["Stagehands / Labor", 22000, 20000, 26000, 24000],
        ],
      },
      {
        name: "Experience & Content",
        rows: [
          ["Interactive Installation", 48000, 45000, 55000, 52000],
          ["Photo / Video Capture", 16000, 15000, 19000, 17000],
          ["Giveaways / Premiums", 12000, 11000, 14000, 13000],
        ],
      },
      {
        name: "Food & Beverage",
        rows: [["Catering & Bar Service", 28000, 26000, 32000, 30000]],
      },
      {
        name: "Travel",
        rows: [["Crew Travel & Lodging", 19000, 18000, 22000, 20000]],
      },
    ],
    awarded: 1, // Livewire Experiential
    ledger: [
      [0, 0, 65000, 65000, 201], // Venue — paid
      [1, 0, 95000, 48000, 210], // Booth — partial
      [1, 1, 48000, 49500, 211], // AV — over
      [2, 0, 40000, 0, 220], // Ambassadors — committed
      [4, 0, 32000, 31000, 240], // Catering — under
    ],
  });
}

/** Boot/default sample (used when no estimates exist) = the film sample. */
export function sampleEstimate(): Estimate {
  return sampleFilmEstimate();
}

/** Wipe all locally-stored estimates, then seed the film + activation samples.
    Returns the two fresh samples (caller opens one and clears remote copies). */
export function resetToSampleProjects(): { film: Estimate; activation: Estimate } {
  for (const s of listEstimates()) {
    try {
      localStorage.removeItem(ESTIMATE_PREFIX + s.id);
    } catch {}
  }
  safeSet(INDEX_KEY, JSON.stringify([]));
  const film = sampleFilmEstimate();
  const activation = sampleActivationEstimate();
  saveEstimate(activation, { setLastOpen: false });
  saveEstimate(film); // opened by default
  return { film, activation };
}
