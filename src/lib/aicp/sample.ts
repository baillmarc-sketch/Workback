/**
 * A realistic starter bid: a one-day, non-union studio shoot that lands around
 * $250k production + $130k post, with fringes, a production fee, insurance and a
 * post markup applied — so a new user sees a believable AICP bid rather than a
 * blank form. Rates are mid-market non-union ballparks (LA/NY), not a quote.
 * Only the lines that carry cost are filled (the rest of the form stays empty),
 * and the production-company name is intentionally left blank.
 */
import { uid } from "../types";
import { createBid, evalCell } from "./builder";
import { cellKey } from "./types";
import type { Bid } from "./types";

/** [label, unitType, units, rate, qty] */
type Entry = [string, string, number, number, number];

/** First AICP line number of each lettered production category (post has none). */
const BASE: Record<string, number> = {
  A: 1, B: 51, C: 101, D: 114, E: 140, F: 151, G: 168, H: 181, I: 193, J: 211, K: 217, L: 227, M: 234, N: 271,
};

const PRODUCTION: Record<string, Entry[]> = {
  A: [
    ["Line Producer", "days", 4, 900, 1],
    ["Production Supervisor", "days", 3, 650, 1],
    ["Production Coordinator", "days", 3, 550, 1],
    ["Production Assistant", "days", 3, 350, 2],
    ["Location Scout", "days", 1, 600, 1],
    ["Wardrobe Stylist — prep", "days", 2, 650, 1],
    ["Prop Master — prep", "days", 2, 650, 1],
    ["Glam test — Make-Up/Hair", "days", 1, 750, 1],
  ],
  B: [
    ["Director of Photography", "days", 1, 4000, 1],
    ["1st Assistant Camera", "days", 1, 850, 1],
    ["2nd Assistant Camera", "days", 1, 650, 1],
    ["DIT", "days", 1, 750, 1],
    ["Camera Operator", "days", 1, 1200, 1],
    ["Gaffer", "days", 1, 950, 1],
    ["Best Boy Electric", "days", 1, 750, 1],
    ["3rd Electric", "days", 1, 600, 2],
    ["Key Grip", "days", 1, 950, 1],
    ["Best Boy Grip", "days", 1, 750, 1],
    ["3rd Grip", "days", 1, 600, 2],
    ["Sound Mixer", "days", 1, 900, 1],
    ["Make-Up/Hair", "days", 1, 850, 2],
    ["Wardrobe Stylist", "days", 1, 850, 1],
    ["Asst Wardrobe", "days", 1, 550, 1],
    ["Prop Master", "days", 1, 850, 1],
    ["Asst Props", "days", 1, 550, 1],
    ["Script Supervisor", "days", 1, 750, 1],
    ["Steadicam Operator", "days", 1, 1200, 1],
    ["Production Assistant", "days", 1, 400, 4],
    ["Medic / COVID", "days", 1, 650, 1],
    ["Craft Service", "days", 1, 650, 1],
  ],
  C: [
    ["Casting Director", "days", 2, 400, 1],
    ["Casting Facility", "days", 1, 1100, 1],
    ["Scouting Expenses", "allow", 1, 900, 1],
    ["Working Meals — prep", "allow", 1, 800, 1],
    ["Car Rental — prep", "each", 1, 500, 1],
    ["Messengers / Deliveries", "each", 1, 450, 1],
    ["Telephone & Cable", "each", 1, 400, 1],
    ["Home Econ / Studio Supplies", "each", 1, 600, 1],
  ],
  D: [
    ["Breakfast", "ppl", 40, 18, 1],
    ["Lunch", "ppl", 45, 28, 1],
    ["Dinner", "ppl", 30, 26, 1],
    ["Production Trucking", "each", 1, 1500, 1],
    ["Cargo Van", "each", 2, 175, 1],
    ["Production MoHo / Dressing Room", "each", 1, 1800, 1],
    ["Parking / Tolls / Gas", "each", 1, 600, 1],
    ["Cabs / Ubers", "each", 1, 500, 1],
    ["Kit Rentals", "each", 1, 1500, 1],
    ["Sustainable Practices", "allow", 1, 750, 1],
  ],
  E: [
    ["Prop Rental", "each", 1, 4500, 1],
    ["Prop Purchase", "each", 1, 3500, 1],
    ["Wardrobe Rental", "each", 1, 1800, 1],
    ["Wardrobe Purchase", "each", 1, 2400, 1],
    ["Product Prep / Color Correct", "each", 1, 1800, 1],
    ["Greens", "each", 1, 1800, 1],
  ],
  F: [
    ["Stage Rental — shoot day", "days", 1, 9000, 1],
    ["Stage Rental — build days", "days", 2, 3500, 1],
    ["Stage Rental — pre-light", "days", 1, 4500, 1],
    ["Power Charges", "days", 1, 1200, 1],
    ["Stage Manager / Studio Security", "days", 1, 1222, 1],
    ["Crew Parking", "days", 1, 800, 1],
  ],
  G: [
    ["Production Designer / Art Director", "days", 3, 1000, 1],
    ["Set Decorator", "days", 2, 850, 1],
    ["Art Dept Coordinator", "days", 2, 700, 1],
    ["Leadman", "days", 2, 650, 1],
    ["Set Dresser", "days", 2, 600, 2],
    ["Scenics", "days", 1, 750, 2],
    ["Grips / Riggers — build", "days", 2, 650, 2],
  ],
  H: [
    ["Set Dressing Rentals", "each", 1, 4500, 1],
    ["Set Dressing Purchases", "each", 1, 3800, 1],
    ["Outside Construction", "each", 1, 5500, 1],
    ["Special Effects Rental", "each", 1, 2500, 1],
    ["Art Dept Prod Supplies", "each", 1, 2000, 1],
    ["Art Dept Kit Rental", "each", 1, 900, 1],
    ["Art Dept Trucking", "each", 1, 1200, 1],
  ],
  I: [
    ["Camera Rental — package", "days", 1, 4500, 1],
    ["Lenses", "days", 1, 1800, 1],
    ["Additional Camera Body", "days", 1, 2000, 1],
    ["Lighting Rental", "days", 1, 7500, 1],
    ["Grip Rental", "days", 1, 5500, 1],
    ["Generator Rental", "days", 1, 1200, 1],
    ["Dolly Rental", "days", 1, 850, 1],
    ["SteadiCam", "days", 1, 1500, 1],
    ["Jib Arm", "days", 1, 1200, 1],
    ["Camera Car / Process Trailer", "days", 1, 2500, 1],
    ["Sound Rental", "days", 1, 650, 1],
    ["Walkie Talkie Rental", "days", 1, 450, 1],
    ["VTR Rental", "days", 1, 950, 1],
    ["Production Supplies / Expendables", "days", 1, 2500, 1],
  ],
  J: [
    ["Media / Drives", "each", 1, 1400, 1],
    ["Transcode / Transfer", "hrs", 8, 95, 1],
    ["Dailies", "each", 1, 950, 1],
  ],
  K: [
    ["Petty Cash", "each", 1, 1500, 1],
    ["Air Shipping & Carriers", "each", 1, 800, 1],
    ["Cell Phones", "each", 1, 450, 1],
    ["Special Insurance Rider", "each", 1, 900, 1],
  ],
  L: [
    ["Director — Prep", "days", 2, 3500, 1],
    ["Director — Shoot", "days", 1, 6500, 1],
    ["Director — Post", "days", 1, 2500, 1],
  ],
  M: [
    ["O/C Principals", "days", 1, 2750, 3],
    ["Fitting Fees", "days", 1, 400, 3],
    ["Voice Over", "days", 1, 1500, 1],
  ],
  N: [
    ["Talent Per Diem", "each", 3, 75, 1],
    ["Talent Gd Transportation", "each", 1, 500, 1],
  ],
};

const POST: Record<string, Entry[]> = {
  Q: [
    ["Editor — Offline", "days", 20, 950, 1],
    ["Offline Edit System", "days", 20, 450, 1],
    ["Assistant Editor", "days", 12, 450, 1],
    ["Conform", "hrs", 8, 250, 1],
    ["Color Prep", "flat", 1, 1500, 1],
    ["Stock Footage Search", "allow", 1, 1500, 1],
    ["Data Backup / Restore", "allow", 1, 800, 1],
    ["Archiving", "flat", 1, 600, 1],
  ],
  R: [
    ["Social Cutdowns", "each", 6, 900, 1],
    ["Versioning / Captioning", "each", 1, 2500, 1],
  ],
  S: [
    ["Sound Design", "flat", 1, 3500, 1],
    ["Mix", "days", 2, 1800, 1],
    ["Mix Prep", "flat", 1, 2500, 1],
    ["VO Record", "flat", 1, 1500, 1],
  ],
  T: [
    ["Colorist", "days", 3, 3500, 1],
    ["Online / Conform", "days", 2, 2500, 1],
    ["Finishing Suite", "days", 3, 1500, 1],
    ["Titles / Graphics", "flat", 1, 1800, 1],
    ["Deliverables / Mastering", "flat", 1, 1800, 1],
  ],
  V: [
    ["Hard Drives", "each", 1, 1500, 1],
    ["Music License", "allow", 1, 1500, 1],
  ],
  W: [
    ["Post Producer", "days", 12, 750, 1],
    ["Creative Director — Post", "days", 5, 1200, 1],
    ["Post Coordinator", "days", 8, 450, 1],
  ],
  X: [
    ["Compositor", "days", 8, 750, 1],
    ["VFX Supervisor", "days", 3, 1500, 1],
    ["Cleanup / Roto", "allow", 1, 3500, 1],
  ],
};

const FIELDS: Record<string, string> = {
  "Client / Advertiser": "Northwind Beverages",
  Product: "Crisp Sparkling Water",
  Agency: "Mercer & Vine",
  "Job #": "NW-2614",
  Director: "Dana Cole",
  "Shoot Dates": "Aug 14, 2026",
  Location: "Stage 4, Quixote Studios — Los Angeles",
};

export function studioShootSample(): Bid {
  const bid = createBid("1-Day Studio Shoot");
  bid.subtitle = "Sample bid — non-union";
  const col = bid.columns.find((c) => c.kind === "estimate")!.id;

  // Rebuild from scratch so only the filled lines exist (a clean, real-looking bid).
  bid.lines = {};
  bid.cells = {};

  const fill = (letter: string, entries: Entry[]) => {
    const cat = bid.categories.find((c) => c.letter === letter);
    if (!cat) return;
    const base = BASE[letter];
    const ids = entries.map(([label, unitType, units, rate, qty], i) => {
      const id = uid();
      bid.lines[id] = { id, no: base !== undefined ? String(base + i) : undefined, label, unitType, order: i };
      bid.cells[cellKey(id, col)] = evalCell(String(units), String(rate), String(qty));
      return id;
    });
    if (cat.subSections) cat.subSections = [{ id: uid(), name: cat.name, lineIds: ids, order: 0 }];
    else cat.lineIds = ids;
  };

  // Empty every category first, then fill the ones with content.
  for (const cat of bid.categories) {
    if (cat.subSections) cat.subSections = [{ id: uid(), name: cat.name, lineIds: [], order: 0 }];
    else cat.lineIds = [];
  }
  for (const [letter, entries] of Object.entries(PRODUCTION)) fill(letter, entries);
  for (const [letter, entries] of Object.entries(POST)) fill(letter, entries);

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
    "Non-union. One studio shoot day at stage, plus 2 build days and a pre-light.",
    "Three non-union on-camera principals; talent buyout per terms.",
    "Production fee 22%; insurance 2.5%; below-the-line fringes 22% on crew.",
    "Post: ~3-week offline, online/color finish, mix, and social cutdowns.",
  ].join("\n");

  bid.updatedAt = Date.now();
  return bid;
}
