import type {
  BidSpec,
  BidSpecSummary,
  BidType,
  BiddingFormat,
  ChecklistItem,
  Clause,
  CommercialSpec,
  FormatFlag,
  Provider,
  SpecContact,
  SpecField,
  TechSpec,
  UsageRow,
} from "./types";
import { uid } from "../types";
import { bumpVersion } from "../storage";
import {
  DEFAULT_CHECKLIST,
  DEFAULT_CLAUSES,
  DEFAULT_FORMAT_FLAGS,
  DEFAULT_TECH_SPECS,
} from "./clauses";

const INDEX_KEY = "bidspecs:index";
const SPEC_PREFIX = "bidspecs:spec:";
const LAST_OPEN_KEY = "bidspecs:lastOpen";

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

export function listBidSpecs(): BidSpecSummary[] {
  const raw = safeGet(INDEX_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as BidSpecSummary[]).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function loadBidSpec(id: string): BidSpec | null {
  const raw = safeGet(SPEC_PREFIX + id);
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

function summaryOf(spec: BidSpec): BidSpecSummary {
  return {
    id: spec.id,
    title: spec.title,
    subtitle: spec.subtitle,
    updatedAt: spec.updatedAt,
    specCount: spec.specs.length,
    clauseCount: spec.clauses.filter((c) => c.on).length,
  };
}

export function saveBidSpec(spec: BidSpec, opts: { setLastOpen?: boolean } = {}): void {
  safeSet(SPEC_PREFIX + spec.id, JSON.stringify(spec));
  const index = listBidSpecs().filter((s) => s.id !== spec.id);
  index.unshift(summaryOf(spec));
  safeSet(INDEX_KEY, JSON.stringify(index));
  if (opts.setLastOpen !== false) safeSet(LAST_OPEN_KEY, spec.id);
}

export function deleteBidSpec(id: string): void {
  try {
    localStorage.removeItem(SPEC_PREFIX + id);
  } catch {}
  safeSet(INDEX_KEY, JSON.stringify(listBidSpecs().filter((s) => s.id !== id)));
}

export function lastOpenId(): string | null {
  return safeGet(LAST_OPEN_KEY);
}

/** Clone a saved spec into an independent, version-bumped copy (link cleared). */
export function duplicateBidSpec(id: string): BidSpec | null {
  const src = loadBidSpec(id);
  if (!src) return null;
  const now = Date.now();
  let title = src.title || "Untitled Bid Specs";
  let subtitle = src.subtitle;
  const bumpedTitle = bumpVersion(title);
  if (bumpedTitle !== null) {
    title = bumpedTitle;
  } else {
    const bumpedSub = bumpVersion(subtitle);
    if (bumpedSub !== null) subtitle = bumpedSub;
    else title = `${title} v2`;
  }
  const copy: BidSpec = {
    ...migrate(src), // deep-normalizes every nested array into fresh objects
    id: uid(),
    title,
    subtitle,
    shareId: undefined,
    createdAt: now,
    updatedAt: now,
  };
  saveBidSpec(copy);
  return copy;
}

// --- migration / normalization ---

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function migrateFields(raw: unknown): SpecField[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<SpecField>[])
    .filter((f) => f && (typeof f.label === "string" || typeof f.value === "string"))
    .map((f) => ({ id: str(f!.id, "") || uid(), label: str(f!.label, ""), value: str(f!.value, "") }));
}

function migrateContacts(raw: unknown): SpecContact[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<SpecContact>[])
    .filter((c) => !!c)
    .map((c) => ({
      id: str(c!.id, "") || uid(),
      role: str(c!.role, ""),
      name: str(c!.name, ""),
      contact: str(c!.contact, ""),
    }));
}

function migrateSpecs(raw: unknown): CommercialSpec[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<CommercialSpec>[])
    .filter((s) => !!s)
    .map((s) => ({
      id: str(s!.id, "") || uid(),
      title: str(s!.title, ""),
      length: str(s!.length, ""),
      versions: str(s!.versions, ""),
    }));
}

function migrateFlags(raw: unknown): FormatFlag[] {
  if (!Array.isArray(raw)) return DEFAULT_FORMAT_FLAGS.map((f) => ({ id: uid(), label: f.label, on: f.on }));
  return (raw as Partial<FormatFlag>[])
    .filter((f) => f && typeof f.label === "string")
    .map((f) => ({ id: str(f!.id, "") || uid(), label: str(f!.label, ""), on: f!.on === true }));
}

function migrateFormat(raw: unknown): BiddingFormat {
  const f = (raw && typeof raw === "object" ? raw : {}) as Partial<BiddingFormat>;
  return {
    bidType: (f.bidType === "costPlus" ? "costPlus" : "firm") as BidType,
    aicpForm: str(f.aicpForm, "AICP Bid Form (Jan 2023)"),
    union: str(f.union, ""),
    bidders: str(f.bidders, ""),
    flags: migrateFlags(f.flags),
  };
}

function migrateProvider(v: unknown): Provider {
  return v === "P" ? "P" : v === "NA" ? "NA" : "A";
}

function migrateChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<ChecklistItem>[])
    .filter((c) => c && typeof c.label === "string")
    .map((c) => ({
      id: str(c!.id, "") || uid(),
      label: str(c!.label, ""),
      provider: migrateProvider(c!.provider),
      note: typeof c!.note === "string" && c!.note ? c!.note : undefined,
    }));
}

function migrateTechSpecs(raw: unknown): TechSpec[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<TechSpec>[])
    .filter((t) => !!t)
    .map((t) => ({ id: str(t!.id, "") || uid(), label: str(t!.label, ""), value: str(t!.value, "") }));
}

function migrateUsage(raw: unknown): UsageRow[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<UsageRow>[])
    .filter((u) => !!u)
    .map((u) => ({
      id: str(u!.id, "") || uid(),
      deliverable: str(u!.deliverable, ""),
      media: str(u!.media, ""),
      territory: str(u!.territory, ""),
      term: str(u!.term, ""),
      exclusivity: str(u!.exclusivity, ""),
      options: str(u!.options, ""),
    }));
}

function migrateClauses(raw: unknown): Clause[] {
  if (!Array.isArray(raw)) return defaultClauses();
  return (raw as Partial<Clause>[])
    .filter((c) => c && typeof c.title === "string")
    .map((c, i) => ({
      id: str(c!.id, "") || uid(),
      group: str(c!.group, "Terms"),
      title: str(c!.title, "Clause"),
      body: str(c!.body, ""),
      on: c!.on !== false,
      order: num(c!.order, i),
    }))
    .sort((a, b) => a.order - b.order);
}

export function migrate(data: unknown): BidSpec {
  const e = data as Partial<BidSpec>;
  if (!e || typeof e !== "object") throw new Error("Not a BidSpec");
  const now = Date.now();
  return {
    schema: 1,
    id: typeof e.id === "string" ? e.id : uid(),
    title: str(e.title, "Untitled Bid Specs"),
    subtitle: str(e.subtitle, ""),
    notes: str(e.notes, ""),
    fields: migrateFields(e.fields),
    contacts: migrateContacts(e.contacts),
    specs: migrateSpecs(e.specs),
    format: migrateFormat(e.format),
    checklist: migrateChecklist(e.checklist),
    techSpecs: migrateTechSpecs(e.techSpecs),
    usage: migrateUsage(e.usage),
    usageNote: str(e.usageNote, ""),
    clauses: migrateClauses(e.clauses),
    signatureNote: str(
      e.signatureNote,
      "Please initial below confirming that you have read these production specifications, and return a copy to the Agency with your AICP bid."
    ),
    shareId: typeof e.shareId === "string" && e.shareId ? e.shareId : undefined,
    createdAt: num(e.createdAt, now),
    updatedAt: num(e.updatedAt, now),
  };
}

// --- constructors ---

function defaultClauses(): Clause[] {
  return DEFAULT_CLAUSES.map((c, i) => ({ id: uid(), order: i, ...c }));
}

function defaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST.map((c) => ({ id: uid(), label: c.label, provider: c.provider }));
}

function defaultTechSpecs(): TechSpec[] {
  return DEFAULT_TECH_SPECS.map(([label, value]) => ({ id: uid(), label, value }));
}

function defaultFormat(): BiddingFormat {
  return {
    bidType: "firm",
    aicpForm: "AICP Bid Form (Jan 2023)",
    union: "SAG-AFTRA · DGA · IATSE",
    bidders: "3 (triple bid)",
    flags: DEFAULT_FORMAT_FLAGS.map((f) => ({ id: uid(), label: f.label, on: f.on })),
  };
}

/** Build a new, empty-but-pre-structured bid spec ready to fill in. */
export function newBidSpec(): BidSpec {
  const now = Date.now();
  return {
    schema: 1,
    id: uid(),
    title: "Untitled Bid Specs",
    subtitle: "",
    notes: "",
    fields: [
      ["Client", ""],
      ["Product / Division", ""],
      ["Job #", ""],
      ["Agency", ""],
      ["Bid Due (date & time)", ""],
      ["Q&A Deadline", ""],
      ["Award Date", ""],
      ["Shoot Date(s)", ""],
      ["# Shoot Days", ""],
      ["# Locations", ""],
    ].map(([label, value]) => ({ id: uid(), label, value })),
    contacts: [
      { id: uid(), role: "Agency Producer", name: "", contact: "" },
      { id: uid(), role: "Business Manager", name: "", contact: "" },
    ],
    specs: [{ id: uid(), title: "", length: "", versions: "" }],
    format: defaultFormat(),
    checklist: defaultChecklist(),
    techSpecs: defaultTechSpecs(),
    usage: [{ id: uid(), deliverable: "", media: "", territory: "", term: "", exclusivity: "", options: "" }],
    usageNote: "",
    clauses: defaultClauses(),
    signatureNote:
      "Please initial below confirming that you have read these production specifications, and return a copy to the Agency with your AICP bid.",
    createdAt: now,
    updatedAt: now,
  };
}

/** The scrubbed sample bid specs sheet — a real agency spec sheet with every
    agency, brand, and contact name replaced by a generic placeholder. Used as
    the boot default and the "Reset & load sample" target. */
export function sampleBidSpec(): BidSpec {
  const base = newBidSpec();
  const now = Date.now();
  return {
    ...base,
    title: "[Client] — Commercial Bid Specs",
    subtitle: "[Product] · :30 + cutdowns · Big Game",
    fields: [
      ["Client", "[Client]"],
      ["Product / Division", "[Product] — Big Game"],
      ["Job #", ""],
      ["Agency", "[Agency]"],
      ["Bid Due (date & time)", "ASAP"],
      ["Q&A Deadline", "—"],
      ["Award Date", "[Award Date]"],
      ["Shoot Date(s)", "[Shoot Date]"],
      ["# Shoot Days", "1"],
      ["# Locations", "1"],
    ].map(([label, value]) => ({ id: uid(), label, value })),
    contacts: [
      { id: uid(), role: "Agency Producer", name: "[Producer Name]", contact: "[phone]" },
      { id: uid(), role: "Business Manager", name: "[Business Manager]", contact: "[phone]" },
      { id: uid(), role: "Agency CCO / ECD", name: "[Creative Lead]", contact: "" },
      { id: uid(), role: "Production Co. / Director", name: "[Production Co.] / [Director]", contact: "[email]" },
    ],
    specs: [{ id: uid(), title: "Big Game Party", length: ":30", versions: ":15L, :06L" }],
    usage: [
      {
        id: uid(),
        deliverable: "Big Game Party (:30 + :15L, :06L)",
        media: "TV / Internet / Industrial",
        territory: "US",
        term: "2 Months",
        exclusivity: "N/A",
        options: "Renewal: 2 Months & 10 Months",
      },
    ],
    usageNote:
      "Buyout should cover unlimited lifts, edits, and versions of the spots listed above. If shooting internationally, buyout should cover the same.",
    createdAt: now,
    updatedAt: now,
  };
}

/** Wipe all locally-stored bid specs, then seed the sample. */
export function resetToSample(): BidSpec {
  for (const s of listBidSpecs()) {
    try {
      localStorage.removeItem(SPEC_PREFIX + s.id);
    } catch {}
  }
  safeSet(INDEX_KEY, JSON.stringify([]));
  const sample = sampleBidSpec();
  saveBidSpec(sample);
  return sample;
}
