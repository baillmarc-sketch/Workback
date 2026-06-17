"use client";

import { useState } from "react";
import { useAuth } from "@/state/auth";
import { deleteRemoteBidSpec } from "@/lib/bidSpecs/account";
import {
  deleteBidSpec,
  duplicateBidSpec,
  listBidSpecs,
  loadBidSpec,
  newBidSpec,
  resetToSample,
  saveBidSpec,
} from "@/lib/bidSpecs/storage";
import { useBidSpec } from "@/state/bidSpecsStore";
import Modal from "../Modal";

export default function BidSpecsListDialog({ onClose }: { onClose: () => void }) {
  const { spec, open } = useBidSpec();
  const { user, getToken } = useAuth();
  const [, bump] = useState(0);
  const specs = listBidSpecs();

  return (
    <Modal title="Bid Specs" onClose={onClose} width={460}>
      <div className="flex flex-col gap-3">
        <button
          className="self-start rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
          onClick={() => {
            const s = newBidSpec();
            saveBidSpec(s);
            open(s);
            onClose();
          }}
        >
          + New bid specs
        </button>

        {specs.length === 0 ? (
          <div className="py-4 text-center text-[12.5px] text-ink-faint">No saved bid specs yet.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hairline">
            {specs.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0 ${
                  s.id === spec?.id ? "bg-paper" : ""
                }`}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    const loaded = loadBidSpec(s.id);
                    if (loaded) {
                      open(loaded);
                      onClose();
                    }
                  }}
                >
                  <div className="truncate text-[13px] font-semibold">
                    {s.title || "Untitled Bid Specs"}
                    {s.id === spec?.id && <span className="ml-2 text-[10.5px] font-medium text-ink-faint">current</span>}
                  </div>
                  <div className="truncate text-[11.5px] text-ink-soft">
                    {s.subtitle || `${s.specCount} spot${s.specCount === 1 ? "" : "s"}`}
                    <span className="text-ink-faint">
                      {" · "}
                      {s.clauseCount} term{s.clauseCount === 1 ? "" : "s"}
                      {" · "}
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
                <button
                  className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-paper hover:text-ink"
                  title="Make an independent copy"
                  onClick={() => {
                    const copy = duplicateBidSpec(s.id);
                    if (copy) {
                      open(copy);
                      onClose();
                    }
                  }}
                >
                  Duplicate
                </button>
                {s.id !== spec?.id && (
                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
                    onClick={() => {
                      if (confirm(`Delete “${s.title || "Untitled Bid Specs"}”? This can't be undone.`)) {
                        deleteBidSpec(s.id);
                        if (user) {
                          getToken()
                            .then((t) => (t ? deleteRemoteBidSpec(user.uid, t, s.id) : undefined))
                            .catch(() => {});
                        }
                        bump((n) => n + 1);
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2.5">
          {user ? <span className="text-[11px] text-ink-faint">Synced to {user.email}</span> : <span />}
          <button
            className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
            title="Delete every bid spec and load the scrubbed sample"
            onClick={() => {
              if (!confirm("Reset all bid specs? This deletes every sheet (including synced copies) and loads a fresh sample. This can't be undone.")) return;
              const oldIds = listBidSpecs().map((s) => s.id);
              const sample = resetToSample();
              if (user) {
                getToken()
                  .then((t) => {
                    if (t) for (const id of oldIds) deleteRemoteBidSpec(user.uid, t, id).catch(() => {});
                  })
                  .catch(() => {});
              }
              open(sample);
              onClose();
            }}
          >
            Reset &amp; load sample
          </button>
        </div>
      </div>
    </Modal>
  );
}
