/**
 * Bid Specs data model. A BidSpec is the upstream document an agency producer
 * sends to bidding production companies: it defines the job, who provides what
 * (agency vs production company), the commercial deliverables and their tech
 * specs, the usage/rights, and the production terms a vendor must bid against.
 *
 * It is the companion to the Estimator: the spec sheet goes out, vendors bid on
 * the named AICP Bid Form, and those bids come back into the Estimator to be
 * leveled and awarded.
 *
 * Everything is stored as flat, RTDB-safe arrays/records with a cached schema
 * version so a sparse cloud copy round-trips and migrate() can self-heal it.
 */

/** A simple labelled value (Client, Job #, Bid Due, Shoot Dates, …). */
export interface SpecField {
  id: string;
  label: string;
  value: string;
}

/** A production-team contact line (role + name + phone/email). */
export interface SpecContact {
  id: string;
  role: string;
  name: string;
  contact: string;
}

/** A commercial in the package: title, length, and cutdown/lift versions. */
export interface CommercialSpec {
  id: string;
  title: string;
  length: string;
  versions: string;
}

/** Who supplies a given element: the (A)gency, the (P)roduction company, or
    not applicable. Mirrors the agency-provided / production-provided split on a
    real bid specs sheet. */
export type Provider = "A" | "P" | "NA";

export interface ChecklistItem {
  id: string;
  label: string;
  provider: Provider;
  note?: string;
}

/** A deliverable technical spec line (Resolution → 3840×2160, Frame rate → 23.98, …). */
export interface TechSpec {
  id: string;
  label: string;
  value: string;
}

/** One row of the usage / rights matrix. */
export interface UsageRow {
  id: string;
  deliverable: string;
  media: string;
  territory: string;
  term: string;
  exclusivity: string;
  options: string;
}

/** A toggleable production term. Ships with a default library (overages, P&W,
    insurance, talent, sustainability, AI disclosure, …); each is switched on/off
    and editable per spec. */
export interface Clause {
  id: string;
  group: string;
  title: string;
  body: string;
  on: boolean;
  order: number;
}

/** A named on/off flag in the bidding format (Film, HD, Bid as Package, …). */
export interface FormatFlag {
  id: string;
  label: string;
  on: boolean;
}

export type BidType = "firm" | "costPlus";

export interface BiddingFormat {
  /** Firm (fixed) bid vs cost-plus / actualized. */
  bidType: BidType;
  /** The named AICP form vendors must bid on, e.g. "AICP Bid Form (Jan 2023)". */
  aicpForm: string;
  /** Union status, e.g. "SAG-AFTRA · DGA · IATSE" or "Non-union". */
  union: string;
  /** Number of bidders / leveling note, e.g. "3 (triple bid)". */
  bidders: string;
  /** Named yes/no production flags (Film, HD, Digital, Provide Treatment, …). */
  flags: FormatFlag[];
}

export interface BidSpec {
  schema: 1;
  id: string;
  title: string;
  subtitle: string;
  /** Internal notes (never part of the client-facing print). */
  notes: string;
  /** Project info (Client, Product, Job #, dates, # shoot days, # locations, …). */
  fields: SpecField[];
  /** Production team contacts. */
  contacts: SpecContact[];
  /** Commercials in the package. */
  specs: CommercialSpec[];
  /** Firm vs cost-plus, AICP form version, union, format flags. */
  format: BiddingFormat;
  /** Agency- vs production-provided element checklist. */
  checklist: ChecklistItem[];
  /** Deliverable technical specs (resolution, frame rate, masters, naming, …). */
  techSpecs: TechSpec[];
  /** Usage / rights matrix. */
  usage: UsageRow[];
  /** Free-text buyout / usage note beneath the matrix. */
  usageNote: string;
  /** Toggleable production terms library. */
  clauses: Clause[];
  /** Acknowledgement / initial line shown at the foot of the sheet. */
  signatureNote: string;
  /** Set when published to the shared cloud copy — the link channel ID. */
  shareId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BidSpecSummary {
  id: string;
  title: string;
  subtitle: string;
  updatedAt: number;
  specCount: number;
  clauseCount: number;
}
