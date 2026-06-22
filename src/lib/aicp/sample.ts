/**
 * A realistic starter bid — a one-day, non-union studio shoot landing around
 * $250k production + $130k post. It is built by "coloring in" the standard AICP
 * form: every canonical line keeps its AICP number and name, we just put
 * realistic values on the lines this job uses and leave the rest blank. Rates
 * are mid-market non-union ballparks (LA/NY), not a quote. The production-company
 * name is intentionally left blank.
 */
import { uid } from "../types";
import { createBid, evalCell } from "./builder";
import { cellKey } from "./types";
import type { Bid } from "./types";

/** [standard line label, units, rate, qty] — matched against the canonical line. */
type Fill = [string, number, number, number];

const PRODUCTION: Record<string, Fill[]> = {
  A: [
    ["Line Producer", 4, 900, 1],
    ["Production Supervisor", 3, 650, 1],
    ["Assistant Production Supervisor", 3, 550, 1],
    ["Production Assistant", 3, 350, 2],
    ["Location Scout", 1, 600, 1],
    ["Wardrobe Stylist", 2, 650, 1],
    ["Prop Master", 2, 650, 1],
    ["Make-Up/Hair", 1, 750, 1],
  ],
  B: [
    ["Director of Photography", 1, 4000, 1],
    ["1st Assistant Camera", 1, 850, 1],
    ["2nd Assistant Camera", 1, 650, 1],
    ["DIT", 1, 750, 1],
    ["Camera Op", 1, 1200, 1],
    ["Steadi Cam Op", 1, 1200, 1],
    ["Gaffer", 1, 950, 1],
    ["Best Boy Electric", 1, 750, 1],
    ["3rd Electric", 1, 600, 2],
    ["Key Grip", 1, 950, 1],
    ["Best Boy Grip", 1, 750, 1],
    ["3rd Grip", 1, 600, 2],
    ["Sound Mixer", 1, 900, 1],
    ["Make-Up/Hair", 1, 850, 2],
    ["Wardrobe Stylist", 1, 850, 1],
    ["Asst Wardrobe", 1, 550, 1],
    ["Prop Master", 1, 850, 1],
    ["Asst Props", 1, 550, 1],
    ["Script Supervisor", 1, 750, 1],
    ["Production Assistant", 1, 400, 4],
    ["Medic", 1, 650, 1],
    ["Craft Service", 1, 650, 1],
  ],
  C: [
    ["Casting Director", 2, 400, 1],
    ["Casting Facility", 1, 1100, 1],
    ["Scouting Expenses", 1, 900, 1],
    ["Working Meals", 1, 800, 1],
    ["Car Rental", 1, 500, 1],
    ["Messengers", 1, 450, 1],
    ["Telephone & Cable", 1, 400, 1],
    ["Home Econ Supplies", 1, 600, 1],
  ],
  D: [
    ["Breakfast", 40, 18, 1],
    ["Lunch", 45, 28, 1],
    ["Dinner", 30, 26, 1],
    ["Production Trucking", 1, 1500, 1],
    ["Cargo Van", 2, 175, 1],
    ["Production MoHo", 1, 1800, 1],
    ["Parking/Tolls/Gas", 1, 600, 1],
    ["Cabs/ Ubers/ Lyfts / Other Transportation", 1, 500, 1],
    ["Kit Rental", 1, 1500, 1],
    ["Sustainable Practices", 1, 750, 1],
  ],
  E: [
    ["Prop Rental", 1, 4500, 1],
    ["Prop Purchase", 1, 3500, 1],
    ["Wardrobe Rental", 1, 1800, 1],
    ["Wardrobe Purchase", 1, 2400, 1],
    ["Product Prep / Color Correct", 1, 1800, 1],
    ["Greens", 1, 1800, 1],
  ],
  F: [
    ["Rental for Shoot Days", 1, 9000, 1],
    ["Rental For Build Days", 2, 3500, 1],
    ["Rental for Pre-Lite Days", 1, 4500, 1],
    ["Power Charges", 1, 1200, 1],
    ["Stage Manager/Studio Security", 1, 1222, 1],
    ["Crew Parking", 1, 800, 1],
  ],
  G: [
    ["Production Designer/Art Director", 3, 1000, 1],
    ["Set Decorator", 2, 850, 1],
    ["Art Dept Coordinator", 2, 700, 1],
    ["Leadman", 2, 650, 1],
    ["Set Dresser", 2, 600, 2],
    ["Scenics", 1, 750, 2],
    ["Grips / Riggers", 2, 650, 2],
  ],
  H: [
    ["Set Dressing Rentals", 1, 4500, 1],
    ["Set Dressing Purchases", 1, 3800, 1],
    ["Outside Construction", 1, 5500, 1],
    ["Special Effects Rental", 1, 2500, 1],
    ["Art Dept Prod Supplies", 1, 2000, 1],
    ["Art Dept Kit Rental", 1, 900, 1],
    ["Art Dept Trucking", 1, 1200, 1],
  ],
  I: [
    ["Camera Rental", 1, 4500, 1],
    ["Lenses", 1, 1800, 1],
    ["Lighting Rental", 1, 7500, 1],
    ["Grip Rental", 1, 5500, 1],
    ["Generator Rental", 1, 1200, 1],
    ["Dolly Rental", 1, 850, 1],
    ["SteadiCam", 1, 1500, 1],
    ["Jib Arm", 1, 1200, 1],
    ["Camera Car", 1, 2500, 1],
    ["Sound Rental", 1, 650, 1],
    ["Walkie Talkie Rental", 1, 450, 1],
    ["VTR Rental", 1, 950, 1],
    ["Expendables", 1, 2500, 1],
  ],
  J: [
    ["Media / Drives", 1, 1400, 1],
    ["Transcode / Transfer", 8, 95, 1],
    ["Dailies", 1, 950, 1],
  ],
  K: [
    ["Petty Cash", 1, 1500, 1],
    ["Air Shipping and Carriers", 1, 800, 1],
    ["Cell Phones", 1, 450, 1],
    ["Special Insurance", 1, 900, 1],
  ],
  L: [
    ["Director Prep", 2, 3500, 1],
    ["Director Shoot", 1, 6500, 1],
    ["Director Post", 1, 2500, 1],
  ],
  M: [
    ["O/C Principals", 1, 2750, 3],
    ["Fitting Fees", 1, 400, 3],
    ["Voice Over", 1, 1500, 1],
  ],
  N: [
    ["Talent Per Diem", 3, 75, 1],
    ["Talent Gd Transportation", 1, 500, 1],
  ],
};

const POST: Record<string, Fill[]> = {
  Q: [
    ["Offline Edit System", 20, 450, 1],
    ["Off-Line Graphics System", 5, 450, 1],
    ["Conform", 8, 250, 1],
    ["Hi-Res Conform", 6, 350, 1],
    ["Color Prep", 1, 1500, 1],
    ["Stock Footage Search", 6, 250, 1],
    ["Data Backup / Restore", 1, 800, 1],
    ["Archiving", 1, 600, 1],
    ["Digital Media", 1, 1500, 1],
  ],
  R: [
    ["Reframing 1 x 1", 8, 150, 1],
    ["Reframing  9 x 16", 8, 150, 1],
    ["Reformatting 4 x 3", 4, 150, 1],
    ["File Versioning / Compression", 4, 150, 1],
    ["Social mixes", 4, 200, 1],
    ["Postings / Digital Delivery / QC", 1, 1500, 1],
  ],
  S: [
    ["Sound Design", 1, 3500, 1],
    ["Record and Mix", 16, 220, 1],
    ["Pre-Load, Encode and Mix Prep", 8, 180, 1],
    ["VO Record", 4, 350, 1],
    ["Music Licensing (Stock/Original)", 1, 2500, 1],
  ],
  T: [
    ["Color Grading Prep", 4, 350, 1],
    ["Color Grading", 16, 450, 1],
    ["Final Conform", 8, 350, 1],
    ["Motion Graphics", 8, 250, 1],
    ["Retouching", 1, 2500, 1],
    ["Master", 1, 1800, 1],
    ["Deliverables", 1, 1500, 1],
    ["Drives / Media", 1, 1500, 1],
  ],
  V: [
    ["Stock Footage", 1, 1500, 1],
    ["Storage Devices", 1, 1200, 1],
    ["Working Meals", 1, 600, 1],
  ],
  W: [
    ["Editor Labor", 20, 950, 1],
    ["Assistant Labor", 12, 450, 1],
    ["Producer/ Coordinator", 12, 750, 1],
    ["Set Supervision", 2, 750, 1],
    ["Creative Fees", 1, 6000, 1],
  ],
};

/** X (Visual Effects) has no standard lines — seed a small VFX sub-section. */
const X_LINES: [string, string, number, number, number][] = [
  ["VFX Supervisor", "days", 3, 1500, 1],
  ["Compositor", "days", 8, 750, 1],
  ["Cleanup / Roto", "allow", 1, 3500, 1],
];

const FIELDS: Record<string, string> = {
  "Client / Advertiser": "Northwind Beverages",
  Product: "Crisp Sparkling Water",
  Agency: "Mercer & Vine",
  "Job #": "NW-2614",
  Director: "Dana Cole",
  "Shoot Dates": "Aug 14, 2026",
  Location: "Stage 4, Quixote Studios — Los Angeles",
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function studioShootSample(): Bid {
  const bid = createBid("1-Day Studio Shoot");
  bid.subtitle = "Sample — non-union";
  const col = bid.columns.find((c) => c.kind === "estimate")!.id;

  // Color in a standard line by its canonical label (keeps its number + name).
  const setByLabel = (letter: string, label: string, units: number, rate: number, qty: number) => {
    const cat = bid.categories.find((c) => c.letter === letter);
    if (!cat) return;
    const ids = cat.subSections ? cat.subSections.flatMap((s) => s.lineIds) : cat.lineIds;
    const target = norm(label);
    const id = ids.find((i) => bid.lines[i] && norm(bid.lines[i].label) === target);
    if (id) bid.cells[cellKey(id, col)] = evalCell(String(units), String(rate), String(qty));
  };

  for (const [letter, fills] of Object.entries(PRODUCTION)) {
    for (const [label, u, r, q] of fills) setByLabel(letter, label, u, r, q);
  }
  for (const [letter, fills] of Object.entries(POST)) {
    for (const [label, u, r, q] of fills) setByLabel(letter, label, u, r, q);
  }

  // X: add a VFX sub-section (no canonical lines on the standard form).
  const X = bid.categories.find((c) => c.letter === "X");
  if (X?.subSections?.[0]) {
    const sub = X.subSections[0];
    sub.name = "Visual Effects";
    for (const [label, unitType, u, r, q] of X_LINES) {
      const id = uid();
      bid.lines[id] = { id, label, unitType, order: sub.lineIds.length };
      bid.cells[cellKey(id, col)] = evalCell(String(u), String(r), String(q));
      sub.lineIds.push(id);
    }
  }

  // Below-the-line: non-union fringes, a 22% production fee, insurance, post markup.
  bid.rates = {
    fringePct: 22,
    handlingPct: 0,
    productionFeePct: 22,
    insuranceProdPct: 2.5,
    sectionXFeePct: 0,
    postInsurancePct: 1,
    postMarkupPct: 10,
    postTaxPct: 0,
  };
  // Director and post creative are loan-out — no fringes on L and W.
  for (const cat of bid.categories) {
    if (cat.letter === "L" || cat.letter === "W") cat.fringePct = 0;
  }

  bid.fields = bid.fields.map((f) => ({ ...f, value: FIELDS[f.label] ?? "" }));
  bid.notes = [
    "Non-union. One studio shoot day, plus 2 build days and a pre-light.",
    "Three non-union on-camera principals; talent buyout per terms.",
    "Production fee 22%; insurance 2.5%; below-the-line fringes 22% on crew.",
    "Post: ~3-week offline, online/color finish, mix, and social cutdowns.",
  ].join("\n");

  bid.updatedAt = Date.now();
  return bid;
}
