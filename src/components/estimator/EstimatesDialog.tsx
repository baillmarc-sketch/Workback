"use client";

import { useState } from "react";
import { useAuth } from "@/state/auth";
import { deleteRemoteEstimate } from "@/lib/estimator/account";
import {
  deleteEstimate,
  duplicateEstimate,
  listEstimates,
  loadEstimate,
  newEstimate,
  resetToSampleProjects,
  saveEstimate,
} from "@/lib/estimator/storage";
import { ESTIMATE_TEMPLATES } from "@/lib/estimator/templates";
import { useEstimate } from "@/state/estimateStore";
import Modal from "../Modal";

export default function EstimatesDialog({ onClose }: { onClose: () => void }) {
  const { estimate, open } = useEstimate();
  const { user, getToken } = useAuth();
  const [, bump] = useState(0);
  const [picking, setPicking] = useState(false);
  const estimates = listEstimates();

  return (
    <Modal title="Estimates" onClose={onClose} width={440}>
      <div className="flex flex-col gap-3">
        {!picking ? (
          <button
            className="self-start rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            onClick={() => setPicking(true)}
          >
            + New estimate
          </button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
              Start from
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ESTIMATE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  title={t.description}
                  className="rounded-md border border-hairline px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-paper"
                  onClick={() => {
                    const e = newEstimate(t.id);
                    saveEstimate(e);
                    open(e);
                    onClose();
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {estimates.length === 0 ? (
          <div className="py-4 text-center text-[12.5px] text-ink-faint">No saved estimates yet.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hairline">
            {estimates.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0 ${
                  s.id === estimate?.id ? "bg-paper" : ""
                }`}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    const e = loadEstimate(s.id);
                    if (e) {
                      open(e);
                      onClose();
                    }
                  }}
                >
                  <div className="truncate text-[13px] font-semibold">
                    {s.title || "Untitled Estimate"}
                    {s.id === estimate?.id && (
                      <span className="ml-2 text-[10.5px] font-medium text-ink-faint">current</span>
                    )}
                  </div>
                  <div className="truncate text-[11.5px] text-ink-soft">
                    {s.subtitle || `${s.lineItemCount} line item${s.lineItemCount === 1 ? "" : "s"}`}
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
                    const e = duplicateEstimate(s.id);
                    if (e) {
                      open(e);
                      onClose();
                    }
                  }}
                >
                  Duplicate
                </button>
                {s.id !== estimate?.id && (
                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
                    onClick={() => {
                      if (confirm(`Delete “${s.title || "Untitled Estimate"}”? You can recover it from the admin trash.`)) {
                        // Capture the doc before the local delete so the remote
                        // soft-delete can stash it for recovery.
                        const doc = loadEstimate(s.id);
                        deleteEstimate(s.id);
                        if (user) {
                          getToken()
                            .then((t) => (t ? deleteRemoteEstimate(user.uid, t, s.id, doc) : undefined))
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
          {user ? (
            <span className="text-[11px] text-ink-faint">Synced to {user.email}</span>
          ) : (
            <span />
          )}
          <button
            className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
            title="Delete every estimate and load the film + activation samples"
            onClick={() => {
              if (
                !confirm(
                  "Reset all estimates? This deletes every project (including synced copies) and loads two fresh samples — Film and Activation. This can't be undone."
                )
              )
                return;
              const oldIds = listEstimates().map((s) => s.id);
              const { film } = resetToSampleProjects();
              if (user) {
                getToken()
                  .then((t) => {
                    if (t) for (const id of oldIds) deleteRemoteEstimate(user.uid, t, id).catch(() => {});
                  })
                  .catch(() => {});
              }
              open(film);
              onClose();
            }}
          >
            Reset &amp; load samples
          </button>
        </div>
      </div>
    </Modal>
  );
}
