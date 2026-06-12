"use client";

import { categoryOf } from "@/lib/categories";
import { fmtLong, fmtShort } from "@/lib/dates";
import type { WorkbackEvent } from "@/lib/types";
import { useStore } from "@/state/store";
import Popover from "./Popover";

interface MorePopoverProps {
  dayKey: string;
  events: WorkbackEvent[];
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
  onPick: (id: string, rect: DOMRect) => void;
}

export default function MorePopover({ dayKey, events, anchor, onClose, onPick }: MorePopoverProps) {
  const { project } = useStore();
  const categories = project?.categories ?? [];
  return (
    <Popover anchor={anchor} onClose={onClose} width={252}>
      <div className="p-2.5">
        <div className="px-1 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
          {fmtLong(dayKey)}
        </div>
        <div className="flex flex-col gap-0.5">
          {events.map((e) => {
            const cat = categoryOf(categories, e.category);
            return (
              <button
                key={e.id}
                className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12.5px] hover:bg-paper"
                onClick={(ev) => {
                  onClose();
                  onPick(e.id, (ev.currentTarget as HTMLElement).getBoundingClientRect());
                }}
              >
                <span className="cat-dot h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: cat.color }} />
                <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                <span className="shrink-0 text-[11px] text-ink-faint">
                  {e.startDate === e.endDate ? fmtShort(e.startDate) : `${fmtShort(e.startDate)}–${fmtShort(e.endDate)}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Popover>
  );
}
