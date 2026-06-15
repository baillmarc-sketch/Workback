"use client";

import { useState } from "react";
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
  const [includeWeekends, setIncludeWeekends] = useState(true);
  const [time, setTime] = useState<string | undefined>(undefined);
  const [showTime, setShowTime] = useState(false);

  const presetTime = time?.toUpperCase() === "AM" || time?.toUpperCase() === "EOD";

  const add = () => {
    if (!title.trim()) return;
    // Weekend-excluded events can't start on a weekend — land on Monday
    const day = includeWeekends ? dayKey : snapWorkday(dayKey, 1);
    const ev: WorkbackEvent = {
      id: uid(),
      title: title.trim(),
      startDate: day,
      endDate: day,
      category,
      isMilestone,
      locked: false,
      skipWeekends: includeWeekends ? undefined : true,
      time: time?.trim() || undefined,
    };
    commit((p) => ({ ...p, events: [...p.events, ev] }));
    if (project) setLastCategoryId(project.id, category);
    onCreated(ev.id);
    onClose();
  };

  return (
    <Popover anchor={anchor} onClose={onClose} width={300}>
      <div className="flex flex-col gap-2.5 p-3.5">
        <div className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
          {fmtLong(dayKey)}
        </div>
        <input
          className="w-full border-none bg-transparent text-[15px] font-semibold outline-none placeholder:text-ink-faint"
          placeholder="Event title…"
          value={title}
          autoFocus={!isCoarsePointer()}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
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
            onClick={add}
          >
            Add event
          </button>
        </div>
      </div>
    </Popover>
  );
}
