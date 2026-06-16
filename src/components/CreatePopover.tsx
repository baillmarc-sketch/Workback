"use client";

import { useEffect, useRef, useState } from "react";
import { fmtLong, snapWorkday } from "@/lib/dates";
import { isCoarsePointer } from "@/lib/device";
import { lastCategoryId, setLastCategoryId } from "@/lib/storage";
import type { WorkbackEvent } from "@/lib/types";
import { uid } from "@/lib/types";
import { useStore } from "@/state/store";
import CategorySwatches from "./CategorySwatches";
import Popover from "./Popover";

interface CreatePopoverProps {
  dayKey: string;
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
  onCreated: (id: string) => void;
}

const inputCls =
  "w-full rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";

export default function CreatePopover({ dayKey, anchor, onClose, onCreated }: CreatePopoverProps) {
  const { project, commit } = useStore();
  const categories = project?.categories ?? [];
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(() => {
    const last = project ? lastCategoryId(project.id) : null;
    return last && categories.some((c) => c.id === last) ? last : categories[0]?.id ?? "";
  });
  const [isMilestone, setIsMilestone] = useState(false);
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [time, setTime] = useState<string | undefined>(undefined);
  const [showTime, setShowTime] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);
  // Latest values for the unmount-time auto-save (refs avoid stale closures)
  const latest = useRef({ title, category, isMilestone, includeWeekends, time });
  latest.current = { title, category, isMilestone, includeWeekends, time };

  const presetTime = time?.toUpperCase() === "AM" || time?.toUpperCase() === "EOD";

  // Land focus straight in the title field so you can just start typing
  useEffect(() => {
    if (!isCoarsePointer()) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, []);

  const commitEvent = () => {
    const v = latest.current;
    if (savedRef.current || !v.title.trim()) return;
    savedRef.current = true;
    const day = v.includeWeekends ? dayKey : snapWorkday(dayKey, 1);
    const ev: WorkbackEvent = {
      id: uid(),
      title: v.title.trim(),
      startDate: day,
      endDate: day,
      category: v.category,
      isMilestone: v.isMilestone,
      locked: false,
      skipWeekends: v.includeWeekends ? undefined : true,
      time: v.time?.trim() || undefined,
    };
    commit((p) => ({ ...p, events: [...p.events, ev] }));
    if (project) setLastCategoryId(project.id, v.category);
    onCreated(ev.id);
  };

  // Click-out / Add / Enter: keep the event if it has a title
  const save = () => {
    commitEvent();
    onClose();
  };

  const closure = (project?.closures ?? []).find((c) => c.date === dayKey);

  // Mark/clear an office closure for this day. Marking flips savedRef so the
  // unmount auto-save won't also drop an event onto the day being closed.
  const markClosed = () => {
    savedRef.current = true;
    const label = title.trim() || undefined;
    commit((p) => ({
      ...p,
      closures: [...(p.closures ?? []).filter((c) => c.date !== dayKey), { date: dayKey, label }],
    }));
    onClose();
  };
  const reopen = () => {
    savedRef.current = true;
    commit((p) => ({ ...p, closures: (p.closures ?? []).filter((c) => c.date !== dayKey) }));
    onClose();
  };

  // Escape cancels without saving. Register in capture before Popover's own
  // Escape handler (which is added on a 0ms timeout) and stop it firing too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        savedRef.current = true; // ensure the unmount path won't re-save
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <Popover anchor={anchor} onClose={save} width={344}>
      <div className="flex flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            {fmtLong(dayKey)}
          </span>
          {closure ? (
            <button
              className="shrink-0 text-[11px] font-medium text-ink-soft hover:text-ink"
              onClick={reopen}
              title="Reopen this day — removes the office closure"
            >
              ✕ Reopen day
            </button>
          ) : (
            <button
              className="shrink-0 text-[11px] font-medium text-ink-soft hover:text-ink"
              onClick={markClosed}
              title="Grey out this day as an office closure / holiday. Uses the title above as its label, if set."
            >
              Mark office closed
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          className="w-full border-none bg-transparent text-[15px] font-semibold outline-none placeholder:text-ink-faint"
          placeholder="Event title…"
          value={title}
          autoFocus={!isCoarsePointer()}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
        <CategorySwatches categories={categories} value={category} onChange={setCategory} />

        {!showTime ? (
          <button
            className="self-start text-[12px] font-medium text-ink-soft hover:text-ink"
            onClick={() => setShowTime(true)}
          >
            + Add time
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            {(["AM", "EOD"] as const).map((t) => (
              <button
                key={t}
                aria-pressed={time?.toUpperCase() === t}
                className={`rounded-md border px-2 py-1 text-[12px] font-medium ${
                  time?.toUpperCase() === t
                    ? "border-ink bg-ink text-paper"
                    : "border-hairline bg-paper text-ink-soft hover:text-ink"
                }`}
                onClick={() => setTime(time?.toUpperCase() === t ? undefined : t)}
              >
                {t}
              </button>
            ))}
            <input
              className={`${inputCls} flex-1`}
              placeholder="2:30 PM"
              value={presetTime ? "" : time ?? ""}
              onChange={(e) => setTime(e.target.value || undefined)}
            />
            {time && (
              <button
                className="text-[12px] font-medium text-ink-faint hover:text-ink"
                aria-label="Clear time"
                onClick={() => setTime(undefined)}
              >
                ×
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
              <input
                type="checkbox"
                checked={isMilestone}
                onChange={(e) => setIsMilestone(e.target.checked)}
              />
              Milestone
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
              <input
                type="checkbox"
                checked={includeWeekends}
                onChange={(e) => setIncludeWeekends(e.target.checked)}
              />
              Include weekends
            </label>
          </div>
          <button
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85 disabled:opacity-40"
            disabled={!title.trim()}
            onClick={save}
            title="Add event (Enter)"
          >
            Add ⏎
          </button>
        </div>
      </div>
    </Popover>
  );
}
