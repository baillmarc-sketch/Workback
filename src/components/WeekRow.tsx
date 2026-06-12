"use client";

import { useDroppable } from "@dnd-kit/core";
import { layoutWeek } from "@/lib/layout";
import { isInMonth, todayKey } from "@/lib/dates";
import type { WorkbackEvent } from "@/lib/types";
import EventBar, { LANE_HEIGHT, LANE_GAP } from "./EventBar";

const DAY_HEADER = 26;
const ROW_PAD = 6;
const MIN_LANES = 3;

interface WeekRowProps {
  days: string[];
  monthKey: string;
  events: WorkbackEvent[];
  selectedId: string | null;
  warningIds: Set<string>;
  shiftedIds: Set<string>;
  draggingId: string | null;
  readOnly?: boolean;
  onSelectEvent: (id: string, rect: DOMRect) => void;
  onResizeStart: (id: string, edge: "start" | "end", e: React.PointerEvent) => void;
  onDayClick: (dayKey: string, rect: DOMRect) => void;
  onMoreClick: (dayKey: string, hidden: WorkbackEvent[], rect: DOMRect) => void;
}

function DayCell({
  dayKey,
  inMonth,
  isToday,
  readOnly,
  onDayClick,
}: {
  dayKey: string;
  inMonth: boolean;
  isToday: boolean;
  readOnly?: boolean;
  onDayClick: (dayKey: string, rect: DOMRect) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dayKey}`, data: { dayKey } });
  const dayNum = parseInt(dayKey.slice(8), 10);

  return (
    <div
      ref={setNodeRef}
      data-day={dayKey}
      className={`relative border-r border-hairline last:border-r-0 ${
        inMonth ? "" : "bg-paper"
      } ${isOver ? "bg-[#f1efe9]" : ""} ${readOnly ? "" : "cursor-pointer"}`}
      onClick={(e) => {
        if (readOnly) return;
        onDayClick(dayKey, (e.currentTarget as HTMLElement).getBoundingClientRect());
      }}
    >
      <div className="pointer-events-none flex justify-end px-1.5 pt-1">
        <span
          className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] tabular-nums ${
            isToday
              ? "bg-ink font-semibold text-paper"
              : inMonth
                ? "text-ink-soft"
                : "text-ink-faint"
          }`}
        >
          {dayNum}
        </span>
      </div>
    </div>
  );
}

export default function WeekRow({
  days,
  monthKey,
  events,
  selectedId,
  warningIds,
  shiftedIds,
  draggingId,
  readOnly,
  onSelectEvent,
  onResizeStart,
  onDayClick,
  onMoreClick,
}: WeekRowProps) {
  const weekStart = days[0];
  const weekEnd = days[6];
  const layout = layoutWeek(events, weekStart, weekEnd);
  const today = todayKey();

  // Row height auto-expands with event density
  const lanes = Math.max(layout.laneCount, MIN_LANES);
  const overflowRow = layout.overflow.size > 0 ? 18 : 0;
  const height = DAY_HEADER + lanes * (LANE_HEIGHT + LANE_GAP) + overflowRow + ROW_PAD;

  return (
    <div className="week-row relative border-b border-hairline last:border-b-0" style={{ height }}>
      <div className="absolute inset-0 grid grid-cols-7">
        {days.map((d) => (
          <DayCell
            key={d}
            dayKey={d}
            inMonth={isInMonth(d, monthKey)}
            isToday={d === today}
            readOnly={readOnly}
            onDayClick={onDayClick}
          />
        ))}
      </div>

      {layout.segments.map((seg) => (
        <EventBar
          key={`${seg.event.id}@${weekStart}`}
          segment={seg}
          weekStart={weekStart}
          topOffset={DAY_HEADER}
          selected={seg.event.id === selectedId}
          warning={warningIds.has(seg.event.id)}
          justShifted={shiftedIds.has(seg.event.id)}
          dragging={seg.event.id === draggingId}
          onSelect={onSelectEvent}
          onResizeStart={onResizeStart}
          readOnly={readOnly}
        />
      ))}

      {/* "+N more" per overflowing day */}
      {[...layout.overflow.entries()].map(([dayKey, hidden]) => {
        const col = days.indexOf(dayKey);
        if (col < 0) return null;
        return (
          <button
            key={dayKey}
            className="no-print absolute bottom-1 z-10 truncate rounded px-1.5 text-[11px] font-medium text-ink-soft hover:bg-paper hover:text-ink"
            style={{ left: `calc(${(col / 7) * 100}% + 3px)`, width: `calc(${100 / 7}% - 6px)` }}
            onClick={(e) => {
              e.stopPropagation();
              onMoreClick(dayKey, hidden, (e.currentTarget as HTMLElement).getBoundingClientRect());
            }}
          >
            +{hidden.length} more
          </button>
        );
      })}
    </div>
  );
}
