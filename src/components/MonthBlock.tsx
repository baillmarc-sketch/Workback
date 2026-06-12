"use client";

import { monthLabel, weeksOfMonth } from "@/lib/dates";
import type { Project, WorkbackEvent } from "@/lib/types";
import WeekRow from "./WeekRow";
import Legend from "./Legend";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthBlockProps {
  mKey: string;
  project: Project;
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

export default function MonthBlock({ mKey, project, ...rest }: MonthBlockProps) {
  const weeks = weeksOfMonth(mKey);

  return (
    <section className="month-block">
      {/* Print-only header: project info repeats on every exported page */}
      <div className="print-only mb-3">
        <div className="flex items-baseline justify-between border-b border-hairline-strong pb-2">
          <div>
            <span className="font-display text-[20px] font-semibold">{project.title}</span>
            {project.subtitle && (
              <span className="ml-3 text-[12px] text-ink-soft">{project.subtitle}</span>
            )}
          </div>
          <span className="text-[12px] text-ink-soft">{monthLabel(mKey)}</span>
        </div>
        {project.showLegend && (
          <Legend categories={project.categories} events={project.events} className="mt-2" />
        )}
      </div>

      <h2 className="no-print mb-2 px-1 font-display text-[17px] font-semibold tracking-tight">
        {monthLabel(mKey)}
      </h2>

      <div className="overflow-hidden rounded-lg border border-hairline-strong bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-7 border-b border-hairline">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="border-r border-hairline px-2 py-1.5 text-center text-[10.5px] font-semibold tracking-[0.08em] text-ink-faint uppercase last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>
        {weeks.map((w) => (
          <WeekRow
            key={w.start}
            days={w.days}
            monthKey={mKey}
            events={project.events}
            categories={project.categories}
            {...rest}
          />
        ))}
      </div>
    </section>
  );
}
