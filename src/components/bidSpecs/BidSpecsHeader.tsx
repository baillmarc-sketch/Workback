"use client";

import { useState } from "react";
import { duplicateBidSpec, saveBidSpec } from "@/lib/bidSpecs/storage";
import { useBidSpec } from "@/state/bidSpecsStore";
import AccountButton from "../AccountButton";
import FeedbackButton from "../feedback/FeedbackButton";

export default function BidSpecsHeader({ onOpenList }: { onOpenList: () => void }) {
  const { spec, open, commit } = useBidSpec();
  const [notesOpen, setNotesOpen] = useState(false);
  if (!spec) return null;

  const onDuplicate = () => {
    saveBidSpec(spec, { setLastOpen: false });
    const copy = duplicateBidSpec(spec.id);
    if (copy) open(copy);
  };

  return (
    <header className="no-print mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            className="w-full border-none bg-transparent font-display text-[28px] font-semibold tracking-tight outline-none placeholder:text-ink-faint"
            value={spec.title}
            placeholder="Untitled Bid Specs"
            aria-label="Bid specs title"
            onChange={(e) => commit((s) => ({ ...s, title: e.target.value }))}
          />
          <input
            className="mt-0.5 w-full border-none bg-transparent text-[13px] text-ink-soft outline-none placeholder:text-ink-faint"
            value={spec.subtitle}
            placeholder="Client / product — e.g. [Client] / [Product] · :30 + cutdowns"
            aria-label="Bid specs subtitle"
            onChange={(e) => commit((s) => ({ ...s, subtitle: e.target.value }))}
          />
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <button
            className="mt-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink"
            onClick={onDuplicate}
            title="Make an independent copy of this spec sheet (a new version)"
          >
            Duplicate
          </button>
          <button
            className="mt-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink"
            onClick={onOpenList}
          >
            Bid Specs
          </button>
          <FeedbackButton variant="inline" className="mt-1.5" />
          <AccountButton />
        </div>
      </div>

      <div className="mt-1 flex items-center gap-4">
        <button
          className="text-[11.5px] font-medium text-ink-faint hover:text-ink-soft"
          onClick={() => setNotesOpen((v) => !v)}
          aria-expanded={notesOpen}
        >
          {notesOpen ? "▾ Internal notes" : "▸ Internal notes"}
        </button>
      </div>
      {notesOpen && (
        <textarea
          className="mt-1 w-full resize-y rounded-md border border-hairline bg-surface px-2.5 py-2 text-[13px] outline-none placeholder:text-ink-faint focus:border-ink-faint"
          rows={3}
          value={spec.notes}
          placeholder="Internal notes — not shown on the printed sheet…"
          onChange={(e) => commit((s) => ({ ...s, notes: e.target.value }))}
        />
      )}
    </header>
  );
}
