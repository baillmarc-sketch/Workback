/* End-to-end checks for the Bid Specs app: the storage round-trip, migration
   self-healing, the default clause/checklist seeds, and the text export.
   Run: npx tsx scripts/verify-bidspecs.ts */

// --- localStorage mock (must be installed before importing storage) ---
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

import {
  saveBidSpec,
  loadBidSpec,
  listBidSpecs,
  duplicateBidSpec,
  deleteBidSpec,
  migrate,
  newBidSpec,
  sampleBidSpec,
  resetToSample,
} from "../src/lib/bidSpecs/storage.ts";
import { checklistToCsv, specToText } from "../src/lib/bidSpecs/export.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`✗ ${name}`, detail ?? "");
  } else {
    console.log(`✓ ${name}`);
  }
}

// 1. Constructors are well-formed
{
  const s = newBidSpec();
  check("newBidSpec has clauses", s.clauses.length > 0);
  check("newBidSpec has checklist", s.checklist.length > 0);
  check("newBidSpec has format flags", s.format.flags.length > 0);
  check("newBidSpec default firm bid", s.format.bidType === "firm");
  check("newBidSpec ids are unique", new Set(s.clauses.map((c) => c.id)).size === s.clauses.length);
  // grid model: both checklist groups present; flags carry a group; specs carry counts
  check("checklist has production group", s.checklist.some((c) => c.group === "production"));
  check("checklist has editorial group", s.checklist.some((c) => c.group === "editorial"));
  check("checklist uses E/O providers", s.checklist.some((c) => c.provider === "E" || c.provider === "O"));
  check("format flags carry a group", s.format.flags.every((f) => typeof f.group === "string" && f.group));
  check("commercial spec has talent-count fields", s.specs.every((c) => "ocp" in c && "hm" in c));
}

// 2. Sample is scrubbed — no real brand/agency/contact names (both templates) + no "big game"
{
  const text = specToText(sampleBidSpec()).toLowerCase();
  for (const banned of [
    "fanduel", "bartle", "hegarty", "bbh", "hungryman", "dewitt", "caputo", "mackler",
    "unilever", "edelman", "groth", "big game",
  ]) {
    check(`sample scrubbed of "${banned}"`, !text.includes(banned), banned);
  }
  check("sample uses placeholders", text.includes("[client]") && text.includes("[agency]"));
}

// 3. Storage round-trip
{
  store.clear();
  const s = sampleBidSpec();
  saveBidSpec(s);
  const loaded = loadBidSpec(s.id);
  check("round-trip loads", !!loaded);
  check("round-trip preserves title", loaded?.title === s.title);
  check("round-trip preserves clause count", loaded?.clauses.length === s.clauses.length);
  check("index lists the spec", listBidSpecs().some((x) => x.id === s.id));
  check("summary spot count", listBidSpecs().find((x) => x.id === s.id)?.specCount === s.specs.length);
}

// 4. Migration self-heals a sparse/garbage doc (simulates RTDB dropping fields)
{
  const healed = migrate({ id: "x1", updatedAt: 123, title: "Sparse" });
  check("migrate fills clauses", healed.clauses.length > 0);
  check("migrate fills checklist default empty array ok", Array.isArray(healed.checklist));
  check("migrate fills format", healed.format.bidType === "firm");
  check("migrate keeps id/updatedAt", healed.id === "x1" && healed.updatedAt === 123);
  check("migrate provides signature default", healed.signatureNote.length > 0);

  const bad = migrate({ clauses: "nope", fields: 5, format: { bidType: "weird" } });
  check("migrate tolerates wrong types", Array.isArray(bad.clauses) && Array.isArray(bad.fields));
  check("migrate normalizes bad bidType to firm", bad.format.bidType === "firm");

  // Forward-compat: a legacy A/P-only spec widens cleanly and backfills new fields.
  const legacy = migrate({
    id: "leg",
    updatedAt: 1,
    checklist: [{ id: "c1", label: "Casting", provider: "A" }],
    specs: [{ id: "sp1", title: "Old Spot", length: ":30", versions: "" }],
    format: { flags: [{ id: "f1", label: "HDTV", on: true }] },
  });
  check("legacy checklist keeps provider", legacy.checklist[0].provider === "A");
  check("legacy checklist gets group", legacy.checklist[0].group === "production");
  check("legacy spec backfills counts", legacy.specs[0].ocp === "" && legacy.specs[0].hm === "");
  check("legacy flag backfills group", typeof legacy.format.flags[0].group === "string" && !!legacy.format.flags[0].group);
}

// 5. Duplicate is independent + version-bumped
{
  store.clear();
  const s = sampleBidSpec();
  s.title = "Acme Specs";
  saveBidSpec(s);
  const copy = duplicateBidSpec(s.id);
  check("duplicate created", !!copy);
  check("duplicate has new id", copy?.id !== s.id);
  check("duplicate version-bumped", copy?.title === "Acme Specs v2");
  check("duplicate clears share link", copy?.shareId === undefined);
  // mutating the copy must not touch the original
  if (copy) {
    copy.clauses[0].title = "CHANGED";
    saveBidSpec(copy);
    check("duplicate is deep-copied", loadBidSpec(s.id)?.clauses[0].title !== "CHANGED");
  }
}

// 6. Delete + reset
{
  store.clear();
  const a = newBidSpec();
  const b = newBidSpec();
  saveBidSpec(a);
  saveBidSpec(b);
  deleteBidSpec(a.id);
  check("delete removes one", !loadBidSpec(a.id) && !!loadBidSpec(b.id));
  const sample = resetToSample();
  check("reset wipes others", !loadBidSpec(b.id));
  check("reset seeds sample", !!loadBidSpec(sample.id) && listBidSpecs().length === 1);
}

// 7. Exports
{
  const s = sampleBidSpec();
  const csv = checklistToCsv(s);
  check("csv has header", csv.startsWith("Group,Element,Provided by"));
  check("csv has agency rows", csv.includes("Agency"));
  check("csv has editorial group", csv.includes("Editorial/Post"));
  const text = specToText(s);
  check("text has production terms section", text.includes("## Production terms"));
  check("text has talent counts", text.includes("OCP"));
  check("text excludes off clauses", !text.includes("Sustainable production")); // off by default
}

console.log("");
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log("All Bid Specs checks passed.");
