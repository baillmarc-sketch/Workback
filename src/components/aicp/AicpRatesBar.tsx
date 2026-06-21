"use client";

import { useBid } from "@/state/aicpStore";
import { setRate } from "@/lib/aicp/mutations";
import type { Bid, BidRates } from "@/lib/aicp/types";
import CellInput from "./CellInput";

const FIELDS: { key: keyof BidRates; label: string; group: "production" | "post" }[] = [
  { key: "fringePct", label: "Fringes %", group: "production" },
  { key: "handlingPct", label: "Handling %", group: "production" },
  { key: "productionFeePct", label: "Production Fee %", group: "production" },
  { key: "insuranceProdPct", label: "Insurance %", group: "production" },
  { key: "sectionXFeePct", label: "Section X Fee %", group: "post" },
  { key: "postInsurancePct", label: "Post Insurance %", group: "post" },
  { key: "postMarkupPct", label: "Post Markup %", group: "post" },
  { key: "postTaxPct", label: "Post Tax %", group: "post" },
];

function num(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Compact editor for the global below-the-line percentages that drive the
    recap. Per-category fringe overrides and fee/insurance applicability are set
    on the categories themselves. */
export default function AicpRatesBar() {
  const { bid, commit } = useBid();
  if (!bid) return null;

  const field = (f: (typeof FIELDS)[number]) => (
    <label key={f.key} className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-paper px-2 py-1">
      <span className="text-[11px] text-ink-soft">{f.label}</span>
      <span className="w-14">
        <CellInput
          value={String((bid.rates as BidRates)[f.key] ?? 0)}
          onCommit={(v) => commit((b: Bid) => setRate(b, f.key, num(v)))}
          ariaLabel={f.label}
        />
      </span>
    </label>
  );

  return (
    <div className="mb-4 rounded-lg border border-hairline bg-surface px-3 py-2.5">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Rates &amp; fees</div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {FIELDS.map(field)}
      </div>
    </div>
  );
}
