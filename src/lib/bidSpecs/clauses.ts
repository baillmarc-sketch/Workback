/**
 * The default production-terms library for a new bid spec. Each clause is
 * toggleable and editable per spec; the bodies are scrubbed, generic versions
 * of standard agency bid-specs language, extended with current AICP / industry
 * best-practice terms (sustainability, diversity, health & safety, AI
 * disclosure, force majeure, insurance limits, payroll service).
 *
 * Placeholders in square brackets ([Agency], [Client], [Production Co.]) are
 * filled in by the producer; nothing here carries a real brand or contact.
 */

export interface ClauseSeed {
  group: string;
  title: string;
  body: string;
  /** On by default? The AICP-gap additions ship off so producers opt in. */
  on: boolean;
}

export const DEFAULT_CLAUSES: ClauseSeed[] = [
  // --- Core terms (on by default) ---
  {
    group: "Bid & Overages",
    title: "Bid scope",
    body: "Bid quote should reflect the specs above as well as any written specs attached by the Agency Producer. Submit a shooting schedule (calendar) and treatment letter with the AICP bid.",
    on: true,
  },
  {
    group: "Bid & Overages",
    title: "Overages",
    body: "Overages will not be considered on firm jobs unless specification changes are made by Agency/Client and are pre-approved by the Agency and Client in writing. All overages must be handled cost-plus and reconciled with backup. It is the Production Company's responsibility to alert the Agency of any potential overage and secure Agency/Client approval; all overages must be confirmed in writing no later than the morning after each shoot day.",
    on: true,
  },
  {
    group: "Labor",
    title: "Crew P&W (cost-plus 15%)",
    body: "Crew Payroll & Wrap (P&W) must be bid below the line as Cost Plus 15%. P&W must be actualized with backup submitted with the final invoice.",
    on: true,
  },
  {
    group: "Labor",
    title: "Director prep fees",
    body: "Director's prep fees are not to be included. No additional fees will be paid to the Director/Production Company for lifting footage into additional spots.",
    on: true,
  },
  {
    group: "Talent",
    title: "Talent payment & handling",
    body: "Agency pays all talent. If travel is necessary, include talent travel and per diem in the budget; handling fee not to exceed 10%. Booking talent is the responsibility of the Production Company. Agency to provide all talent releases/contracts prior to the shoot, with a headshot and a full-body-in-wardrobe photo of each actor attached to their contract.",
    on: true,
  },
  {
    group: "Talent",
    title: "Buyout & usage",
    body: "Buyout should cover unlimited lifts, edits, and versions of the spots listed above per the usage matrix. Provide a detailed talent breakdown separate from the production bid.",
    on: true,
  },
  {
    group: "Insurance",
    title: "Production insurance",
    body: "Do not bid for production insurance — the Agency will cover it through [Agency insurance carrier]. Local production service providers on foreign shoots must still carry workers' comp for crew and talent.",
    on: true,
  },
  {
    group: "Art & Props",
    title: "Props return",
    body: "All purchased props are to be returned to the Agency with a detailed inventory list. If items are sold, credit is to be given to the Client on the final invoice.",
    on: true,
  },
  {
    group: "Art & Props",
    title: "Animals",
    body: "If shooting animals of any kind, a Humane Society representative must be on set.",
    on: true,
  },
  {
    group: "Safety",
    title: "Stunts",
    body: "The Production Company is responsible for hiring the Stunt Coordinator (if required) and obtaining written consent that the engagement does not entitle them to re-use payments.",
    on: true,
  },
  {
    group: "Payment",
    title: "Payment policy",
    body: "[Agency] adheres to a 50/50 payment policy for domestic productions and a 75/25 payment policy for overseas productions. All payments are subject to the Agency's receipt of Client funds.",
    on: true,
  },
  {
    group: "Post & VFX",
    title: "Post / VFX split",
    body: "The Production Company is to bid all VFX/CG; the Agency will bid editorial (the Production Company may bid editorial if the Producer agrees). Coordinate VFX requirements directly with the post house. Include costs for uploading and shipping all materials. Agency masters are Apple ProRes files.",
    on: true,
  },
  {
    group: "Foreign Shoot",
    title: "Foreign shoot provisions",
    body: "If bidding outside the US, the subcontracting company abroad advises on local employment protocol (including child-labor law) and session/buyout rates. Exchange rates lock on the award date; no additional money is allocated for FX fluctuation. Include a driver-staffed van to shuttle Agency and Client at all foreign locations (and at domestic multi-location shoots).",
    on: true,
  },
  {
    group: "Security",
    title: "On-set security & NDA",
    body: "Assume strictest confidentiality on all film/photo sets. Everyone on set must be warned in advance and sign an NDA; picture-taking is prohibited. If heightened security incurs additional cost, plan and discuss it at the time of bidding.",
    on: true,
  },

  // --- AICP / current best-practice additions (opt in) ---
  {
    group: "Sustainability",
    title: "Sustainable production",
    body: "Production is expected to follow sustainable-production best practices (e.g. Green The Bid). Include a sustainability line and report measures taken to reduce the production's footprint.",
    on: false,
  },
  {
    group: "Diversity & EEO",
    title: "Diversity & EEO reporting",
    body: "The Production Company shall provide an equal-opportunity workplace and, on request, report crew/vendor diversity for the production.",
    on: false,
  },
  {
    group: "Safety",
    title: "Health & safety protocols",
    body: "Include a set medic where required and budget for applicable health & safety protocols. An intimacy coordinator must be engaged for any intimate scenes.",
    on: false,
  },
  {
    group: "AI & Content",
    title: "AI / generative-content disclosure",
    body: "Any use of generative AI or synthetic media in the work must be disclosed in advance and approved in writing by the Agency and Client, with all rights, clearances, and talent consents secured.",
    on: false,
  },
  {
    group: "Cancellation",
    title: "Cancellation, postponement & force majeure",
    body: "Cancellation and postponement are handled per the AICP/Standard Commercial Production Agreement terms. Force-majeure events are addressed cost-plus with backup and require written Agency/Client approval.",
    on: false,
  },
  {
    group: "Insurance",
    title: "Insurance limits & certificates",
    body: "Maintain required coverage limits (general liability, auto, workers' comp, and Errors & Omissions where applicable). Provide a Certificate of Insurance naming [Agency] and [Client] as additional insured prior to the shoot.",
    on: false,
  },
  {
    group: "Payment",
    title: "Payroll service & paperwork",
    body: "Crew is to be paid through the designated payroll service. A completed W-9 and a signed master services agreement (MSA) are required prior to first payment.",
    on: false,
  },
];

/** Default firm/HD bidding-format flags (the "X" checkboxes on a spec sheet). */
export interface FlagSeed {
  label: string;
  on: boolean;
}

export const DEFAULT_FORMAT_FLAGS: FlagSeed[] = [
  { label: "Film", on: false },
  { label: "HD / Digital", on: true },
  { label: "Bid as Package", on: true },
  { label: "Provide Treatment", on: true },
  { label: "Bid Through Dailies", on: true },
  { label: "VFX Treatment Required", on: false },
];

/** Default agency-vs-production-provided checklist. */
export interface ChecklistSeed {
  label: string;
  provider: "A" | "P" | "NA";
}

export const DEFAULT_CHECKLIST: ChecklistSeed[] = [
  { label: "Casting", provider: "A" },
  { label: "Talent Payment", provider: "A" },
  { label: "Talent Travel & Per Diem", provider: "A" },
  { label: "Stylist", provider: "A" },
  { label: "Wardrobe", provider: "A" },
  { label: "Hair Stylist", provider: "A" },
  { label: "Makeup", provider: "A" },
  { label: "Script Supervisor", provider: "A" },
  { label: "Stunt Coordinator", provider: "A" },
  { label: "Set Design & Construction", provider: "P" },
  { label: "Location Search & Permits", provider: "P" },
  { label: "Props", provider: "P" },
  { label: "Sound / SFX", provider: "P" },
  { label: "Copyrighted / Licensed Materials", provider: "P" },
  { label: "Stock Footage", provider: "P" },
  { label: "Titles Layout / Art", provider: "P" },
  { label: "Animation", provider: "P" },
  { label: "VO", provider: "P" },
  { label: "Agency Transportation (Local)", provider: "P" },
  { label: "Agency Travel", provider: "P" },
  { label: "Music Tracks", provider: "P" },
  { label: "Video Conferencing", provider: "P" },
  { label: "Transcoding", provider: "P" },
  { label: "VTR with Playback", provider: "P" },
  { label: "Dailies (2 sets)", provider: "P" },
  { label: "Sync Dailies", provider: "P" },
  { label: "Shooting Boards / Pre-Pro", provider: "P" },
  { label: "Outlined Shot List", provider: "P" },
  { label: "Production Insurance", provider: "A" },
  { label: "Visual Effects / Telecine / Conform", provider: "P" },
  { label: "BTS Crew — Video", provider: "P" },
  { label: "BTS Crew — Stills", provider: "P" },
];

/** Default deliverable technical specs (sensible modern broadcast/social set). */
export const DEFAULT_TECH_SPECS: [string, string][] = [
  ["Master format", "Apple ProRes 422 HQ"],
  ["Resolution", "3840×2160 (UHD)"],
  ["Frame rate", "23.98 fps"],
  ["Color space", "Rec.709"],
  ["Aspect ratios", "16:9 broadcast · 1:1 & 9:16 social cutdowns"],
  ["Audio", "Stereo mix + split stems; -24 LKFS broadcast"],
  ["Captions / textless", "Textless master + closed captions required"],
  ["Slate & naming", "Per Agency naming convention; slate on each deliverable"],
];

/** Official AICP and adjacent resources surfaced in the Help / reference panel. */
export interface AicpResource {
  name: string;
  note: string;
  url: string;
}

export const AICP_RESOURCES: AicpResource[] = [
  {
    name: "AICP Bid Form (Excel + PDF)",
    note: "The standard A–X bid form. Updated Jan 2023.",
    url: "https://aicp.com/business-resources/business-affairs-information/bidding-resources",
  },
  {
    name: "AICP Suggested Best Practices — Bidding",
    note: "Current best-practice guidance (2026).",
    url: "https://aicp.com/business-resources/business-affairs-information/bidding-resources",
  },
  {
    name: "AICP Bidding Reference Guide",
    note: "Reference guide to the bid form (Feb 2026).",
    url: "https://aicp.com/business-resources/business-affairs-information/bidding-resources",
  },
  {
    name: "Sample Language for Bids",
    note: "AICP sample bid language (May 2025).",
    url: "https://aicp.com/business-resources/business-affairs-information/bidding-resources",
  },
  {
    name: "AICP National Guidelines (Digital / Live Action)",
    note: "Bidding sections of the national guidelines.",
    url: "https://aicp.com/business-resources/business-affairs-information/bidding-resources",
  },
  {
    name: "AICP Standard Commercial Production Agreement",
    note: "The terms backbone behind the guidelines.",
    url: "https://aicp.com/assets/editor/Standard_Commercial_Production_Agreement_1.pdf",
  },
  {
    name: "Green The Bid",
    note: "Sustainable-production pledge and resources.",
    url: "https://www.greenthebid.earth/",
  },
  {
    name: "SAG-AFTRA Commercials Contract",
    note: "Talent session & usage standards.",
    url: "https://www.sagaftra.org/production-center/contract/810/document/810",
  },
];
