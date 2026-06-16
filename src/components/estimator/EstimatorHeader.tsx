"use client";

import { useState } from "react";
import { useEstimate } from "@/state/estimateStore";
import AccountButton from "../AccountButton";

export default function EstimatorHeader({ onOpenEstimates }: { onOpenEstimates: () => void }) {
  const { estimate, commit } = useEstimate();
  const [notesOpen, setNotesOpen] = useState(false);
  if (!estimate) return null;

  return (
    <header className="no-print mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            className="w-full border-none bg-transparent font-display text-[28px] font-semibold tracking-tight outline-none placeholder:text-ink-faint"
            value={estimate.title}
            placeholder="Untitled Estimate"
            aria-label="Estimate title"
            onChange={(e) => commit((est) => ({ ...est, title: e.target.value }))}
          />
          <input
            className="mt-0.5 w-full border-none bg-transparent text-[13px] text-ink-soft outline-none placeholder:text-ink-faint"
            value={estimate.subtitle}
            placeholder="Client / project — e.g. Acme x Brand / Spot 2026"
            aria-label="Estimate subtitle"
            onChange={(e) => commit((est) => ({ ...est, subtitle: e.target.value }))}
          />
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <button
            className="mt-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink"
            onClick={onOpenEstimates}
          >
            Estimates
          </button>
          <AccountButton />
        </div>
      </div>

      <button
        className="mt-1 text-[11.5px] font-medium text-ink-faint hover:text-ink-soft"
        onClick={() => setNotesOpen((v) => !v)}
        aria-expanded={notesOpen}
      >
        {notesOpen ? "▾ Notes" : "▸ Notes"}
      </button>
      {notesOpen && (
        <textarea
          className="mt-1 w-full resize-y rounded-md border border-hairline bg-surface px-2.5 py-2 text-[13px] outline-none placeholder:text-ink-faint focus:border-ink-faint"
          rows={3}
          value={estimate.notes}
          placeholder="Estimate notes…"
          onChange={(e) => commit((est) => ({ ...est, notes: e.target.value }))}
        />
      )}
    </header>
  );
}
