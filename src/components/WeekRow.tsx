"use client";

import { useDroppable } from "@dnd-kit/core";
import { layoutWeek, MAX_LANES } from "@/lib/layout";
import { isInMonth, isWeekendKey, todayKey } from "@/lib/dates";
import type { ProjectCategory, WorkbackEvent } from "@/lib/types";
import EventBar, { LANE_HEIGHT, LANE_GAP, PRINT_LANE_HEIGHT } from "./EventBar";

const DAY_HEADER = 26;
const ROW_PAD = 6;
const MIN_LANES = 3;

interface WeekRowProps {
  days: string[];
  monthKey: string;
  events: WorkbackEvent[];
  categories: ProjectCategory[];
  selectedId: string | null;
  /** event id → reason it conflicts with a locked date */
  warnings: Map<string, string>;
  /** date key → closure label ("" when unlabeled); presence = day closed */
  closures: Map<string, string>;
  shiftedIds: Set<string>;
  draggingId: string | null;
  readOnly?: boolean;
  /** Print render: taller lanes + wrapped labels */
  forPrint?: boolean;
  onSelectEvent: (id: string, rect: DOMRect) => void;
  onResizeStart: (id: string, edge: "start" | "end", e: React.PointerEvent) => void;
  onDayClick: (dayKey: string, rect: DOMRect) => void;
  onMoreClick: (dayKey: string, hidden: WorkbackEvent[], rect: DOMRect) => void;
}

// Diagonal hatch marks a closed day as "blocked" without drowning out any
// bars that still sit on it.
const CLOSED_HATCH =
  "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.035) 5px, rgba(0,0,0,0.035) 6px)";

function DayCell({
  dayKey,
  inMonth,
  isToday,
  closureLabel,
  readOnly,
  onDayClick,
}: {
  dayKey: string;
  inMonth: boolean;
  isToday: boolean;
  /** undefined = open; a string (possibly "") = office closed that day */
  closureLabel?: string;
  readOnly?: boolean;
  onDayClick: (dayKey: string, rect: DOMRect) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dayKey}`, data: { dayKey } });
  const dayNum = parseInt(dayKey.slice(8), 10);
  const closed = closureLabel !== undefined && inMonth;

  return (
    <div
      ref={setNodeRef}
      data-day={dayKey}
      title={closed ? `Office closed${closureLabel ? ` — ${closureLabel}` : ""}` : undefined}
      className={`relative border-r border-hairline last:border-r-0 ${
        !inMonth ? "bg-paper" : closed ? "bg-[#edebe4]" : isWeekendKey(dayKey) ? "bg-[#f6f5f1]" : ""
      } ${isOver ? "!bg-[#f1efe9]" : ""} ${readOnly ? "" : "cursor-pointer"}`}
      style={closed ? { backgroundImage: CLOSED_HATCH } : undefined}
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
      {closed && (
        <div className="pointer-events-none absolute top-1 right-7 left-1.5 truncate text-[10px] font-semibold tracking-[0.03em] text-ink-faint uppercase">
          {closureLabel || "Closed"}
        </div>
      )}
    </div>
  );
}

export default function WeekRow({
  days,
  monthKey,
  events,
  categories,
  selectedId,
  warnings,
  closures,
  shiftedIds,
  draggingId,
  readOnly,
  forPrint,
  onSelectEvent,
  onResizeStart,
  onDayClick,
  onMoreClick,
}: WeekRowProps) {
  const weekStart = days[0];
  const weekEnd = days[6];
  // Print shows every event (no "+N more", which is screen-only) and lets
  // empty weeks collapse instead of reserving a fixed block of blank lanes.
  const layout = layoutWeek(events, weekStart, weekEnd, forPrint ? Infinity : MAX_LANES);
  const today = todayKey();

  // Row height auto-expands with event density
  const laneHeight = forPrint ? PRINT_LANE_HEIGHT : LANE_HEIGHT;
  const minLanes = forPrint ? 1 : MIN_LANES;
  const lanes = Math.max(layout.laneCount, minLanes);
  const overflowRow = layout.overflow.size > 0 ? 18 : 0;
  const height = DAY_HEADER + lanes * (laneHeight + LANE_GAP) + overflowRow + ROW_PAD;

  return (
    <div className="week-row relative border-b border-hairline last:border-b-0" style={{ height }}>
      <div className="absolute inset-0 grid grid-cols-7">
        {days.map((d) => (
          <DayCell
            key={d}
            dayKey={d}
            inMonth={isInMonth(d, monthKey)}
            isToday={d === today}
            closureLabel={closures.get(d)}
            readOnly={readOnly}
            onDayClick={onDayClick}
          />
        ))}
      </div>

      {layout.segments.map((seg) => (
        <EventBar
          key={`${seg.event.id}@${weekStart}`}
          segment={seg}
          categories={categories}
          weekStart={weekStart}
          topOffset={DAY_HEADER}
          selected={seg.event.id === selectedId}
          warningReason={warnings.get(seg.event.id)}
          justShifted={shiftedIds.has(seg.event.id)}
          dragging={seg.event.id === draggingId}
          onSelect={onSelectEvent}
          onResizeStart={onResizeStart}
          readOnly={readOnly}
          forPrint={forPrint}
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
