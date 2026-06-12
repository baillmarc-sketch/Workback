"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { fmtLong, snapWorkday } from "@/lib/dates";
import { isCoarsePointer } from "@/lib/device";
import type { CategoryId, WorkbackEvent } from "@/lib/types";
import { uid } from "@/lib/types";
import { useStore } from "@/state/store";
import Popover from "./Popover";

interface CreatePopoverProps {
  dayKey: string;
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
  onCreated: (id: string) => void;
}

export default function CreatePopover({ dayKey, anchor, onClose, onCreated }: CreatePopoverProps) {
  const { commit } = useStore();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CategoryId>("creative");
  const [isMilestone, setIsMilestone] = useState(false);
  const [includeWeekends, setIncludeWeekends] = useState(true);

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
    };
    commit((p) => ({ ...p, events: [...p.events, ev] }));
    onCreated(ev.id);
    onClose();
  };

  return (
    <Popover anchor={anchor} onClose={onClose} width={272}>
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
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              title={c.label}
              aria-label={c.label}
              aria-pressed={category === c.id}
              className="flex h-6 w-6 items-center justify-center rounded-md transition-transform hover:scale-110"
              style={{
                background: `color-mix(in srgb, ${c.color} 18%, white)`,
                boxShadow: category === c.id ? `0 0 0 2px ${c.color}` : undefined,
              }}
              onClick={() => setCategory(c.id as CategoryId)}
            >
              <span className="h-3 w-3 rounded-[4px]" style={{ background: c.color }} />
            </button>
          ))}
        </div>
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
