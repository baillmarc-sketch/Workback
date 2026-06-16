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
    columns: src.columns.map((c) => ({ ...c, links: c.links?.map((l) => ({ ...l })) })),
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

/** A starter estimate that shows the grid at a glance: a few populated line
    items across two internal versions and one vendor bid (so the triple-bid
    view and column deltas have something to compare). */
export function sampleEstimate(): Estimate {
  const now = Date.now();
  const mk = (name: string): EstimateLineItem & { _section: string } =>
    ({ id: uid(), label: name, order: 0, _section: "" }) as EstimateLineItem & { _section: string };

  const production = uid();
  const post = uid();
  const music = uid();

  const liDirector = mk("Director");
  const liCrew = mk("Crew (3 days)");
  const liEquipment = mk("Camera & Lighting");
  const liEditor = mk("Editor");
  const liColor = mk("Color Grade");
  const liVfx = mk("VFX / Online");
  const liLicense = mk("Music License");
  const liMix = mk("Audio Mix");

  const lineItems: Record<string, EstimateLineItem> = {};
  for (const li of [liDirector, liCrew, liEquipment, liEditor, liColor, liVfx, liLicense, liMix]) {
    lineItems[li.id] = { id: li.id, label: li.label, order: li.order };
  }

  const sections: EstimateSection[] = [
    { id: production, name: "Production", lineItemIds: [liDirector.id, liCrew.id, liEquipment.id], order: 0 },
    { id: post, name: "Post", lineItemIds: [liEditor.id, liColor.id, liVfx.id], order: 1 },
    { id: music, name: "Music", lineItemIds: [liLicense.id, liMix.id], order: 2 },
  ];

  const versionA: EstimateColumn = { id: uid(), name: "Premium", role: "version", order: 0 };
  const versionB: EstimateColumn = { id: uid(), name: "Value", role: "version", order: 1 };
  const vendor: EstimateColumn = { id: uid(), name: "Production Co. A", role: "vendor", vendor: "Acme Films", order: 2 };

  const cells: Record<string, CellValue> = {};
  const set = (li: EstimateLineItem, col: EstimateColumn, expr: string) => {
    cells[`${li.id}:${col.id}`] = { expr, value: evalOrZero(expr) };
  };
  // Premium version
  set(liDirector, versionA, "25000");
  set(liCrew, versionA, "3*8000");
  set(liEquipment, versionA, "12000");
  set(liEditor, versionA, "18000");
  set(liColor, versionA, "9000");
  set(liVfx, versionA, "15000");
  set(liLicense, versionA, "20000");
  set(liMix, versionA, "6000");
  // Value version
  set(liDirector, versionB, "15000");
  set(liCrew, versionB, "3*5500");
  set(liEquipment, versionB, "7500");
  set(liEditor, versionB, "12000");
  set(liColor, versionB, "5000");
  set(liVfx, versionB, "8000");
  set(liLicense, versionB, "9000");
  set(liMix, versionB, "4000");
  // Vendor bid (a real quote, lump sums)
  set(liDirector, vendor, "22000");
  set(liCrew, vendor, "26000");
  set(liEquipment, vendor, "11000");
  set(liEditor, vendor, "17000");
  set(liColor, vendor, "8500");
  set(liVfx, vendor, "14000");
  set(liLicense, vendor, "18000");
  set(liMix, vendor, "5500");

  // A few PO/invoice entries so the Actuals view demos with real numbers
  // against the awarded vendor bid.
  const ledger: LedgerEntry[] = [];
  const po = (li: EstimateLineItem, amount: number, ref: string) =>
    ledger.push({ id: uid(), lineItemId: li.id, kind: "po", amount, ref, vendor: vendor.vendor });
  const inv = (li: EstimateLineItem, amount: number, ref: string) =>
    ledger.push({ id: uid(), lineItemId: li.id, kind: "invoice", amount, ref, vendor: vendor.vendor });
  po(liDirector, 22000, "PO-101");
  inv(liDirector, 22000, "INV-2201");
  po(liCrew, 26000, "PO-102");
  inv(liCrew, 27500, "INV-2202"); // came in over
  po(liEquipment, 11000, "PO-103");
  inv(liEquipment, 10200, "INV-2203"); // under
  po(liEditor, 17000, "PO-104");
  inv(liEditor, 8500, "INV-2204"); // half invoiced so far

  return {
    schema: 1,
    id: uid(),
    title: "Sample Estimate",
    subtitle: "Acme x Brand · Spot 2026",
    notes: "",
    assumptions:
      "Two (2) shoot days in Los Angeles.\nClient provides final script and brand assets.\nUsage: 1 year, North America, digital + broadcast.\nTalent buyout estimated for 6 on-camera principals.\nDoes not include media spend or sales tax.",
    currency: "USD",
    fields: [
      { id: uid(), label: "Client", value: "Acme" },
      { id: uid(), label: "Product", value: "Brand Spot" },
      { id: uid(), label: "Producer", value: "" },
      { id: uid(), label: "Shoot Dates", value: "" },
    ],
    deliverables: [
      { id: uid(), title: ":30 Hero Spot", length: ":30", usage: "1yr NA, digital + broadcast" },
      { id: uid(), title: ":15 Cutdown", length: ":15", usage: "1yr NA, digital" },
    ],
    team: [{ id: uid(), name: "", role: "Producer", level: "Sr", hours: "" }],
    adjustments: [
      { id: uid(), label: "Contingency", type: "percent", value: 10 },
      { id: uid(), label: "Insurance", type: "percent", value: 2 },
      { id: uid(), label: "Sales Tax", type: "percent", value: 0 },
    ],
    sections,
    lineItems,
    columns: [versionA, versionB, vendor],
    cells,
    ledger,
    baselineColumnId: versionA.id,
    awardedColumnId: vendor.id,
    createdAt: now,
    updatedAt: now,
  };
}
