"use client";

import { CATEGORIES, categoryOf } from "@/lib/categories";
import { addDaysKey, durationDays, snapWorkday } from "@/lib/dates";
import { countRounds, duplicateRound } from "@/lib/workback";
import type { CategoryId, WorkbackEvent } from "@/lib/types";
import { uid } from "@/lib/types";
import { useStore } from "@/state/store";
import Popover from "./Popover";

interface EventPopoverProps {
  event: WorkbackEvent;
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
}

const inputCls =
  "w-full rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";
const labelCls = "mb-1 block text-[10.5px] font-semibold tracking-[0.06em] text-ink-faint uppercase";

export default function EventPopover({ event, anchor, onClose }: EventPopoverProps) {
  const { commit } = useStore();

  const update = (patch: Partial<WorkbackEvent>) =>
    commit((p) => ({
      ...p,
      events: p.events.map((e) => (e.id === event.id ? { ...e, ...patch } : e)),
    }));

  const setDates = (startDate: string, endDate: string) => {
    if (startDate > endDate) endDate = startDate;
    update({ startDate, endDate });
  };

  return (
    <Popover anchor={anchor} onClose={onClose} width={304}>
      <div className="flex flex-col gap-3 p-3.5">
        <input
          className="w-full border-none bg-transparent text-[15px] font-semibold outline-none placeholder:text-ink-faint"
          value={event.title}
          placeholder="Event title"
          autoFocus
          onChange={(e) => update({ title: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onClose()}
        />

        <textarea
          className={`${inputCls} min-h-[52px] resize-y`}
          value={event.description ?? ""}
          placeholder="Description (optional)"
          onChange={(e) => update({ description: e.target.value || undefined })}
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Start</label>
            <input
              type="date"
              className={inputCls}
              value={event.startDate}
              onChange={(e) => e.target.value && setDates(e.target.value, event.endDate)}
            />
          </div>
          <div>
            <label className={labelCls}>End</label>
            <input
              type="date"
              className={inputCls}
              value={event.endDate}
              min={event.startDate}
              onChange={(e) => e.target.value && setDates(event.startDate, e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Category</label>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                title={c.label}
                aria-label={c.label}
                aria-pressed={event.category === c.id}
                className="flex h-6 w-6 items-center justify-center rounded-md transition-transform hover:scale-110"
                style={{
                  background: `color-mix(in srgb, ${c.color} 18%, white)`,
                  boxShadow: event.category === c.id ? `0 0 0 2px ${c.color}` : undefined,
                }}
                onClick={() => update({ category: c.id as CategoryId })}
              >
                <span className="h-3 w-3 rounded-[4px]" style={{ background: c.color }} />
              </button>
            ))}
          </div>
          <div className="mt-1 text-[11.5px] text-ink-soft">{categoryOf(event.category).label}</div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
            <input
              type="checkbox"
              checked={event.isMilestone}
              onChange={(e) => update({ isMilestone: e.target.checked })}
            />
            Milestone
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
            <input
              type="checkbox"
              checked={event.locked}
              onChange={(e) => update({ locked: e.target.checked })}
            />
            Lock date
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
            <input
              type="checkbox"
              checked={!event.skipWeekends}
              onChange={(e) => {
                const skip = !e.target.checked;
                if (!skip) {
                  update({ skipWeekends: false });
                  return;
                }
                // Snap both edges onto workdays when weekends are excluded
                let start = snapWorkday(event.startDate, 1);
                let end = snapWorkday(event.endDate, -1);
                if (end < start) end = start = snapWorkday(event.startDate, 1);
                update({ skipWeekends: true, startDate: start, endDate: end });
              }}
            />
            Include weekends
          </label>
        </div>

        <div className="flex items-center gap-1.5 border-t border-hairline pt-2.5">
          <button
            className="rounded-md border border-hairline px-2 py-1 text-[12px] font-medium hover:bg-paper"
            onClick={() => {
              commit((p) => {
                const dur = durationDays(event.startDate, event.endDate);
                const copy: WorkbackEvent = {
                  ...event,
                  id: uid(),
                  startDate: addDaysKey(event.endDate, 1),
                  endDate: addDaysKey(event.endDate, dur),
                  roundId: undefined,
                  roundRole: undefined,
                };
                return { ...p, events: [...p.events, copy] };
              });
              onClose();
            }}
          >
            Duplicate
          </button>

          {event.roundId && (
            <button
              className="rounded-md border border-hairline px-2 py-1 text-[12px] font-medium hover:bg-paper"
              onClick={() => {
                commit((p) => ({
                  ...p,
                  events: [
                    ...p.events,
                    ...duplicateRound(p.events, event.roundId!, countRounds(p.events) + 1),
                  ],
                }));
                onClose();
              }}
            >
              Duplicate round
            </button>
          )}

          <button
            className="ml-auto rounded-md px-2 py-1 text-[12px] font-medium text-danger hover:bg-red-50"
            onClick={() => {
              commit((p) => ({ ...p, events: p.events.filter((e) => e.id !== event.id) }));
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </Popover>
  );
}
