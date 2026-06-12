"use client";

import { useState } from "react";
import { addDaysKey, todayKey } from "@/lib/dates";
import { countRounds, createReviewRound } from "@/lib/workback";
import { useStore } from "@/state/store";
import Modal from "./Modal";

const inputCls =
  "rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";

export default function ReviewRoundDialog({ onClose }: { onClose: () => void }) {
  const { project, commit } = useStore();
  const lastEnd = project?.events.reduce(
    (m, e) => (e.endDate > m ? e.endDate : m),
    project.events[0]?.endDate ?? todayKey()
  );
  const [start, setStart] = useState(lastEnd ? addDaysKey(lastEnd, 1) : todayKey());
  const [type, setType] = useState<"client-review" | "internal-review">("client-review");
  const [reviewDays, setReviewDays] = useState(2);
  const [revisionDays, setRevisionDays] = useState(2);

  if (!project) return null;

  return (
    <Modal title="Add review round" onClose={onClose} width={420}>
      <div className="flex flex-col gap-4">
        <p className="text-[12px] leading-relaxed text-ink-soft">
          Creates a linked pair: a review window (48-hour cycle by default) followed by a
          revisions block. Durations are editable per round; duplicate a round from its event
          popover to chain rounds downstream.
        </p>

        <div className="flex overflow-hidden rounded-md border border-hairline self-start">
          {(
            [
              ["client-review", "Client review"],
              ["internal-review", "Internal review"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`px-3 py-1.5 text-[12.5px] font-medium ${
                type === id ? "bg-ink text-paper" : "bg-surface text-ink-soft hover:text-ink"
              }`}
              onClick={() => setType(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            Starts
            <input
              type="date"
              className={inputCls}
              value={start}
              onChange={(e) => e.target.value && setStart(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            Review days
            <input
              type="number"
              min={1}
              max={14}
              className={inputCls}
              value={reviewDays}
              onChange={(e) => setReviewDays(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            Revision days
            <input
              type="number"
              min={1}
              max={14}
              className={inputCls}
              value={revisionDays}
              onChange={(e) => setRevisionDays(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            className="rounded-md bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            onClick={() => {
              commit((p) => ({
                ...p,
                events: [
                  ...p.events,
                  ...createReviewRound(start, type, countRounds(p.events) + 1, reviewDays, revisionDays),
                ],
              }));
              onClose();
            }}
          >
            Add round
          </button>
        </div>
      </div>
    </Modal>
  );
}
