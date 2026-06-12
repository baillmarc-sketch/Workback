"use client";

import { useDraggable } from "@dnd-kit/core";
import { catText, categoryOf } from "@/lib/categories";
import type { Segment } from "@/lib/layout";
import type { ProjectCategory } from "@/lib/types";

export const LANE_HEIGHT = 26;
export const LANE_GAP = 2;

interface EventBarProps {
  segment: Segment;
  categories: ProjectCategory[];
  weekStart: string;
  topOffset: number;
  selected: boolean;
  warning: boolean;
  justShifted: boolean;
  dragging: boolean;
  onSelect: (eventId: string, rect: DOMRect) => void;
  onResizeStart: (eventId: string, edge: "start" | "end", e: React.PointerEvent) => void;
  readOnly?: boolean;
}

export default function EventBar({
  segment,
  categories,
  weekStart,
  topOffset,
  selected,
  warning,
  justShifted,
  dragging,
  onSelect,
  onResizeStart,
  readOnly,
}: EventBarProps) {
  const { event, startCol, span, continuesLeft, continuesRight, lane } = segment;
  const cat = categoryOf(categories, event.category);
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `${event.id}@${weekStart}`,
    data: { eventId: event.id },
    disabled: readOnly || event.locked,
  });

  const left = `calc(${(startCol / 7) * 100}% + 3px)`;
  const widthCalc = `calc(${(span / 7) * 100}% - 6px)`;
  const top = topOffset + lane * (LANE_HEIGHT + LANE_GAP);

  const bg = event.isMilestone
    ? cat.color
    : `color-mix(in srgb, ${cat.color} 16%, white)`;
  const fg = event.isMilestone ? "#fff" : catText(cat.color);
  const border = event.isMilestone ? cat.color : `color-mix(in srgb, ${cat.color} 45%, white)`;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-event-id={event.id}
      className={`event-bar group/bar absolute flex cursor-grab items-center overflow-hidden text-[12px] font-medium leading-none select-none ${
        dragging ? "opacity-30" : ""
      } ${justShifted ? "just-shifted" : ""}`}
      style={
        {
          left,
          width: widthCalc,
          top,
          height: LANE_HEIGHT,
          background: bg,
          color: fg,
          border: `1px solid ${border}`,
          borderRadius: continuesLeft && continuesRight ? 2 : continuesLeft ? "2px 6px 6px 2px" : continuesRight ? "6px 2px 2px 6px" : 6,
          boxShadow: selected
            ? `0 0 0 2px ${cat.color}, 0 2px 8px rgba(0,0,0,0.10)`
            : warning
              ? "0 0 0 2px var(--color-danger)"
              : undefined,
          "--cat-color": cat.color,
          zIndex: selected ? 5 : undefined,
          touchAction: "manipulation",
        } as React.CSSProperties
      }
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event.id, (e.currentTarget as HTMLElement).getBoundingClientRect());
      }}
      title={event.title}
    >
      {/* Resize handles on true start/end edges only */}
      {!readOnly && !event.locked && !continuesLeft && (
        <div
          className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 pointer-coarse:w-5 pointer-coarse:opacity-60"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeStart(event.id, "start", e);
          }}
        >
          <div className="mx-auto mt-1.5 h-3.5 w-[3px] rounded-full bg-current opacity-40" />
        </div>
      )}
      {!readOnly && !event.locked && !continuesRight && (
        <div
          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 pointer-coarse:w-5 pointer-coarse:opacity-60"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeStart(event.id, "end", e);
          }}
        >
          <div className="mx-auto mt-1.5 h-3.5 w-[3px] rounded-full bg-current opacity-40" />
        </div>
      )}

      <span className="flex min-w-0 items-center gap-1.5 px-2">
        {event.isMilestone && (
          <svg className="milestone-diamond h-2.5 w-2.5 shrink-0" viewBox="0 0 10 10" aria-label="Milestone">
            <rect x="2" y="2" width="6" height="6" transform="rotate(45 5 5)" fill="currentColor" />
          </svg>
        )}
        {event.locked && (
          <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-label="Locked">
            <path d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5H9a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h.5Zm1.2 0h2.6V3.5a1.3 1.3 0 0 0-2.6 0V5Z" />
          </svg>
        )}
        {warning && (
          <svg className="h-3 w-3 shrink-0 text-danger" viewBox="0 0 12 12" fill="currentColor" aria-label="Schedule conflict">
            <path d="M6 1 11.5 10.5H.5L6 1Zm-.6 3.5v3h1.2v-3H5.4Zm0 4v1.2h1.2V8.5H5.4Z" />
          </svg>
        )}
        <span className="truncate">{event.title}</span>
      </span>
    </div>
  );
}
