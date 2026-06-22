"use client";

import { useState } from "react";
import { useAuth } from "@/state/auth";
import { useBid } from "@/state/aicpStore";
import { createBid } from "@/lib/aicp/builder";
import { studioShootSample } from "@/lib/aicp/sample";
import { deleteBid, duplicateBid, listBids, loadBid, saveBid } from "@/lib/aicp/storage";
import { deleteRemoteBid } from "@/lib/aicp/account";
import Modal from "../Modal";

/** Open, duplicate, delete, and create AICP bids (personal workspace). */
export default function AicpBidsDialog({ onClose }: { onClose: () => void }) {
  const { bid, open } = useBid();
  const { user, getToken } = useAuth();
  const [, bump] = useState(0);
  const bids = listBids();

  const start = (b: ReturnType<typeof createBid>) => {
    saveBid(b);
    open(b);
    onClose();
  };

  return (
    <Modal title="AICP Bids" onClose={onClose} width={460}>
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Start a new bid</div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
              onClick={() => start(studioShootSample())}
              title="A realistic 1-day studio shoot, pre-filled"
            >
              + New from sample
            </button>
            <button
              className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
              onClick={() => start(createBid("Untitled AICP Bid"))}
              title="A blank AICP form to fill in yourself"
            >
              + Blank AICP form
            </button>
          </div>
        </div>

        {bids.length === 0 ? (
          <div className="py-4 text-center text-[12.5px] text-ink-faint">No saved bids yet.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hairline">
            {bids.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0 ${
                  s.id === bid?.id ? "bg-paper" : ""
                }`}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    const b = loadBid(s.id);
                    if (b) {
                      open(b);
                      onClose();
                    }
                  }}
                >
                  <div className="truncate text-[13px] font-semibold">
                    {s.title || "Untitled AICP Bid"}
                    {s.id === bid?.id && <span className="ml-2 text-[10.5px] font-medium text-ink-faint">current</span>}
                  </div>
                  <div className="truncate text-[11.5px] text-ink-soft">
                    {s.subtitle || `${s.lineCount} line${s.lineCount === 1 ? "" : "s"}`}
                    <span className="text-ink-faint">
                      {" · "}
                      {s.columnCount} column{s.columnCount === 1 ? "" : "s"}
                      {" · "}
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
                <button
                  className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-paper hover:text-ink"
                  title="Make an independent copy"
                  onClick={() => {
                    const b = duplicateBid(s.id);
                    if (b) {
                      open(b);
                      onClose();
                    }
                  }}
                >
                  Duplicate
                </button>
                {s.id !== bid?.id && (
                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
                    onClick={() => {
                      if (!confirm(`Delete “${s.title || "Untitled AICP Bid"}”? This can't be undone.`)) return;
                      const doc = loadBid(s.id);
                      deleteBid(s.id);
                      if (user) {
                        getToken()
                          .then((t) => (t ? deleteRemoteBid(user.uid, t, s.id, doc) : undefined))
                          .catch(() => {});
                      }
                      bump((n) => n + 1);
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {user && <div className="text-[11px] text-ink-faint">Synced to {user.email}</div>}
      </div>
    </Modal>
  );
}
