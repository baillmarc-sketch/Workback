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
  {
    group: "Bid & Overages",
    title: "Weather contingency",
    body: "A weather-contingency bid must be submitted for all outdoor location shoots.",
    on: false,
  },
  {
    group: "Payment",
    title: "Paperwork before final payment",
    body: "All paperwork — approved overage reports, rehearsal/shoot dates, the A.D. report for each pre-light, prop/wardrobe inventories, and talent documents — must be received by the Agency business manager before the final 25% of the contract price is processed and paid.",
    on: false,
  },
  {
    group: "Bid & Overages",
    title: "AICP & Client Guidelines",
    body: "Where applicable, and absent Client Guidelines to the contrary, AICP Guidelines apply. In the event of a conflict, Client Guidelines control. The terms and conditions of the Agency's Television Commercial Contract apply; a copy is available on request.",
    on: false,
  },
  {
    group: "Post & VFX",
    title: "Editorial subcontract",
    body: "Editorial may or may not be subcontracted through the Production Company. Unless otherwise noted, payment will be made directly to the editorial company by the Agency. If a foreign shoot uses a local subcontractor, include a copy of the subcontractor's bid in US$ with the US bid.",
    on: false,
  },
  {
    group: "Security",
    title: "PR & distribution consent",
    body: "Any supplier request for PR must be cleared through the Agency before information is passed to the media. No distribution of any supplied or produced materials — including on supplier reels, websites, or promotional outlets — without express written Agency (and Client) consent.",
    on: false,
  },
  {
    group: "Talent",
    title: "Talent releases & images",
    body: "The Production Company is responsible for complete and accurate preparation of all talent releases and talent reports. A digital image of talent in costume must be attached to each release; completed releases and reports are returned to the business manager.",
    on: false,
  },
];

/** Default bidding-format flags (the "X" checkboxes on a spec sheet), grouped
    into the columns of the format grid (Gauge / Capture / Color / Sound /
    Distribution), mirroring the classic AICP header. */
export interface FlagSeed {
  label: string;
  on: boolean;
  group: string;
}

export const DEFAULT_FORMAT_FLAGS: FlagSeed[] = [
  { group: "Gauge", label: "35mm", on: false },
  { group: "Gauge", label: "16mm", on: false },
  { group: "Gauge", label: "HDTV", on: true },
  { group: "Capture", label: "Videotape", on: false },
  { group: "Capture", label: "Digital Video", on: true },
  { group: "Capture", label: "Animation", on: false },
  { group: "Color", label: "Color", on: true },
  { group: "Color", label: "B&W", on: false },
  { group: "Sound", label: "Sync Sound", on: true },
  { group: "Sound", label: "Wild Sound", on: false },
  { group: "Sound", label: "MOS", on: false },
  { group: "Distribution", label: "Network", on: false },
  { group: "Distribution", label: "Spot", on: false },
  { group: "Distribution", label: "Cable", on: false },
  { group: "Distribution", label: "Cinema", on: false },
  { group: "Distribution", label: "Internet", on: true },
  { group: "Distribution", label: "Global", on: false },
];

/** Default provided-by checklist. Each item names who supplies it
    (A=Agency, P=Production Co., E=Editor, O=Outside facility) and which grid it
    sits in (Production vs Editorial/Post), per the AICP-style template. */
export interface ChecklistSeed {
  label: string;
  provider: "A" | "P" | "E" | "O" | "NA";
  group: "production" | "editorial";
}

export const DEFAULT_CHECKLIST: ChecklistSeed[] = [
  // --- Production ---
  { group: "production", label: "Casting — On-Camera", provider: "A" },
  { group: "production", label: "Casting — Hand Model", provider: "A" },
  { group: "production", label: "Casting — VO", provider: "A" },
  { group: "production", label: "Talent Payment — OCPs", provider: "A" },
  { group: "production", label: "Talent Payment — Union EXBs", provider: "A" },
  { group: "production", label: "Talent Payment — Non-Union EXBs", provider: "A" },
  { group: "production", label: "Talent Payment — VO", provider: "A" },
  { group: "production", label: "Talent Payment — Hand Model", provider: "A" },
  { group: "production", label: "Talent Travel / Per Diem", provider: "A" },
  { group: "production", label: "Location Search & Photos", provider: "P" },
  { group: "production", label: "Sets", provider: "P" },
  { group: "production", label: "Props", provider: "P" },
  { group: "production", label: "Picture Vehicles", provider: "P" },
  { group: "production", label: "Stylist", provider: "P" },
  { group: "production", label: "Wardrobe", provider: "P" },
  { group: "production", label: "Hair & Makeup", provider: "P" },
  { group: "production", label: "Food Stylist / Home Economist", provider: "P" },
  { group: "production", label: "Animals / Trainers", provider: "P" },
  { group: "production", label: "Celebrity Service", provider: "A" },
  { group: "production", label: "Nurse / Medic", provider: "P" },
  { group: "production", label: "Teacher / Social Worker", provider: "P" },
  { group: "production", label: "Baby Wrangler", provider: "P" },
  { group: "production", label: "Still Photographer", provider: "P" },
  { group: "production", label: "VTR w/ Playback", provider: "P" },
  { group: "production", label: "Stock Footage", provider: "P" },
  { group: "production", label: "PPE / Sanitation", provider: "P" },
  { group: "production", label: "Production Insurance", provider: "A" },
  { group: "production", label: "BTS Crew — Video / Stills", provider: "P" },
  // --- Editorial / Post (full list per the AICP template's EDITORIAL/POST column) ---
  { group: "editorial", label: "Dailies", provider: "P" },
  { group: "editorial", label: "Sync Dailies", provider: "P" },
  { group: "editorial", label: "Edit — Off-Line", provider: "E" },
  { group: "editorial", label: "Edit — On-Line", provider: "E" },
  { group: "editorial", label: "EDL / Auto Conform", provider: "E" },
  { group: "editorial", label: "FTP", provider: "E" },
  { group: "editorial", label: "Record", provider: "O" },
  { group: "editorial", label: "ISDN", provider: "O" },
  { group: "editorial", label: "Mix", provider: "O" },
  { group: "editorial", label: "Stock Music", provider: "O" },
  { group: "editorial", label: "Original Music", provider: "O" },
  { group: "editorial", label: "Sound FX / Sound Design", provider: "O" },
  { group: "editorial", label: "Titles", provider: "E" },
  { group: "editorial", label: "Graphics", provider: "E" },
  { group: "editorial", label: "Animation", provider: "O" },
  { group: "editorial", label: "Color / Telecine / Conform", provider: "O" },
  { group: "editorial", label: "Master", provider: "E" },
  { group: "editorial", label: "Protection", provider: "E" },
  { group: "editorial", label: "Generic Master", provider: "E" },
  { group: "editorial", label: "Audio Split Tracks", provider: "E" },
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
