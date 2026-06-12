"use client";

import { useMemo, useState } from "react";
import { categoryOf } from "@/lib/categories";
import { fmtShort } from "@/lib/dates";
import { applyChanges, compressTimeline } from "@/lib/workback";
import { useStore } from "@/state/store";
import Modal from "./Modal";

export default function CompressDialog({ onClose }: { onClose: () => void }) {
  const { project, commit } = useStore();
  const [days, setDays] = useState(5);
  const [mode, setMode] = useState<"compress" | "extend">("compress");

  const delta = mode === "compress" ? -days : days;
  const changes = useMemo(
    () => (project ? compressTimeline(project.events, delta) : []),
    [project, delta]
  );

  if (!project) return null;
  const hasLock = project.events.some((e) => e.locked);

  return (
    <Modal title="Compress / extend timeline" onClose={onClose} width={520}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-md border border-hairline">
            {(["compress", "extend"] as const).map((m) => (
              <button
                key={m}
                className={`px-3 py-1.5 text-[12.5px] font-medium capitalize ${
                  mode === m ? "bg-ink text-paper" : "bg-surface text-ink-soft hover:text-ink"
                }`}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            by
            <input
              type="number"
              min={1}
              max={120}
              className="w-16 rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint"
              value={days}
              onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
            />
            days
          </label>
        </div>

        <p className="text-[12px] leading-relaxed text-ink-soft">
          {hasLock
            ? "Unlocked events redistribute proportionally, anchored to the locked delivery date — the project start moves, the delivery never does."
            : "No locked delivery date — events redistribute proportionally from the project start."}
        </p>

        <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-hairline">
          {changes.length === 0 ? (
            <div className="p-4 text-center text-[12.5px] text-ink-faint">
              Nothing would move.
            </div>
          ) : (
            changes
              .slice()
              .sort((a, b) => (a.oldStart < b.oldStart ? -1 : 1))
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 border-b border-hairline px-3 py-2 text-[12.5px] last:border-b-0"
                >
                  <span
                    className="cat-dot h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: categoryOf(c.category).color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                  <span className="text-ink-faint line-through">
                    {fmtShort(c.oldStart)}
                    {c.oldStart !== c.oldEnd && `–${fmtShort(c.oldEnd)}`}
                  </span>
                  <span className="text-ink-faint">→</span>
                  <span className="font-semibold">
                    {fmtShort(c.newStart)}
                    {c.newStart !== c.newEnd && `–${fmtShort(c.newEnd)}`}
                  </span>
                </div>
              ))
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            className="rounded-md border border-hairline px-3 py-1.5 text-[12.5px] font-medium hover:bg-paper"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85 disabled:opacity-40"
            disabled={changes.length === 0}
            onClick={() => {
              commit((p) => ({ ...p, events: applyChanges(p.events, changes) }));
              onClose();
            }}
          >
            Apply — {changes.length} event{changes.length === 1 ? "" : "s"} move
          </button>
        </div>
      </div>
    </Modal>
  );
}
