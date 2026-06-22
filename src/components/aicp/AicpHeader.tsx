"use client";

import { useBid } from "@/state/aicpStore";
import { createBid } from "@/lib/aicp/builder";
import { studioShootSample } from "@/lib/aicp/sample";
import { saveBid } from "@/lib/aicp/storage";
import AccountButton from "../AccountButton";

const SYNC_LABEL: Record<string, string> = {
  idle: "Saved locally",
  syncing: "Syncing…",
  synced: "Saved & synced",
  offline: "Offline — will retry",
};
const SYNC_DOT: Record<string, string> = {
  idle: "bg-ink-faint",
  syncing: "bg-amber-500",
  synced: "bg-[#10B981]",
  offline: "bg-danger",
};

/** Cover header: editable bid title/subtitle, a New action, share, and the
    save-status pill. */
export default function AicpHeader({ onShare, onOpenBids }: { onShare: () => void; onOpenBids: () => void }) {
  const { bid, open, patch, syncState } = useBid();
  if (!bid) return null;

  const onNew = () => {
    const b = createBid("Untitled AICP Bid");
    saveBid(b);
    open(b);
  };
  const onNewTemplate = () => {
    const b = studioShootSample();
    saveBid(b);
    open(b);
  };

  return (
    <div className="no-print mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <input
            value={bid.title}
            onChange={(e) => patch((b) => ({ ...b, title: e.target.value }))}
            placeholder="Bid title"
            className="w-full bg-transparent font-display text-[22px] font-semibold tracking-tight outline-none placeholder:text-ink-faint"
            aria-label="Bid title"
          />
          <input
            value={bid.subtitle}
            onChange={(e) => patch((b) => ({ ...b, subtitle: e.target.value }))}
            placeholder="Client / Job # / Version"
            className="w-full bg-transparent text-[13px] text-ink-soft outline-none placeholder:text-ink-faint"
            aria-label="Bid subtitle"
          />
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2 py-1 text-[11.5px] text-ink-soft"
            aria-live="polite"
          >
            <span className={`h-2 w-2 rounded-full ${SYNC_DOT[syncState]}`} />
            {SYNC_LABEL[syncState]}
          </span>
          <button
            onClick={onOpenBids}
            className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
          >
            Bids
          </button>
          <button
            onClick={onNewTemplate}
            title="Start a new bid from the studio-shoot template"
            className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
          >
            New template
          </button>
          <button
            onClick={onNew}
            title="Start a new blank AICP form"
            className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
          >
            New blank
          </button>
          <button
            onClick={onShare}
            className="rounded-md bg-ink px-2.5 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
          >
            Share
          </button>
          <AccountButton />
        </div>
      </div>
    </div>
  );
}
