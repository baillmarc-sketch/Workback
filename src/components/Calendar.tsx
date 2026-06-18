"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { addMonthsKey, diffDays } from "@/lib/dates";
import { compareSameDay } from "@/lib/eventTime";
import { moveEvent, resizeEvent, warnings as computeWarnings } from "@/lib/workback";
import { catText, categoryOf } from "@/lib/categories";
import type { Project, WorkbackEvent } from "@/lib/types";
import { useStore } from "@/state/store";
import MonthBlock from "./MonthBlock";

interface CalendarProps {
  project: Project;
  selectedId: string | null;
  downstreamMode: boolean;
  readOnly?: boolean;
  /** Render exactly these months instead of anchorMonth..monthsVisible (print) */
  monthsOverride?: string[];
  /** Print render: taller wrapped bars, and warnings are never drawn */
  forPrint?: boolean;
  onSelectEvent: (id: string, rect: DOMRect) => void;
  onDayClick: (dayKey: string, rect: DOMRect) => void;
  onMoreClick: (dayKey: string, hidden: WorkbackEvent[], rect: DOMRect) => void;
}

function dayKeyAtPoint(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const day = (el as HTMLElement).dataset?.day;
    if (day) return day;
  }
  return null;
}

export default function Calendar({
  project,
  selectedId,
  downstreamMode,
  readOnly,
  monthsOverride,
  forPrint,
  onSelectEvent,
  onDayClick,
  onMoreClick,
}: CalendarProps) {
  const { commit } = useStore();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [shiftedIds, setShiftedIds] = useState<Set<string>>(new Set());
  const [resizing, setResizing] = useState<{ id: string; edge: "start" | "end"; dayKey: string } | null>(null);
  const grabDayRef = useRef<string | null>(null);
  const grabPointRef = useRef<{ x: number; y: number } | null>(null);
  const shiftKeyRef = useRef(false);
  const shiftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the shift-pulse timer on unmount so it can't fire setState afterwards.
  useEffect(() => () => {
    if (shiftTimer.current) clearTimeout(shiftTimer.current);
  }, []);

  // Mouse drags start after 4px of travel; touch needs a 250ms hold so the
  // page still scrolls when you swipe across the calendar
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  // Modifier key during drag toggles downstream shift
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftKeyRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftKeyRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const pulse = useCallback((ids: Set<string>) => {
    if (shiftTimer.current) clearTimeout(shiftTimer.current);
    setShiftedIds(ids);
    shiftTimer.current = setTimeout(() => setShiftedIds(new Set()), 950);
  }, []);

  function handleDragStart(e: DragStartEvent) {
    const eventId = e.active.data.current?.eventId as string;
    setDraggingId(eventId);
    const act = e.activatorEvent as PointerEvent | TouchEvent;
    let point: { x: number; y: number } | null = null;
    if (act && "touches" in act && act.touches[0]) {
      point = { x: act.touches[0].clientX, y: act.touches[0].clientY };
    } else if (act && "clientX" in act) {
      point = { x: act.clientX, y: act.clientY };
    }
    grabDayRef.current = point ? dayKeyAtPoint(point.x, point.y) : null;
    grabPointRef.current = point;
  }

  // Same-day reorder: drop point = grab point + drag delta. Only single-day
  // events participate; other single-day events that day are measured via
  // their rendered bars to find the insertion index.
  function reorderSameDay(eventId: string, dayKey: string, dropY: number) {
    const event = project.events.find((ev) => ev.id === eventId);
    if (!event || event.startDate !== event.endDate) return;

    const dayEvents = project.events
      .filter((ev) => ev.startDate === dayKey && ev.endDate === dayKey)
      .sort(compareSameDay);
    const others = dayEvents.filter((ev) => ev.id !== eventId);

    let insertIndex = others.length;
    for (let i = 0; i < others.length; i++) {
      const el = document.querySelector(`[data-event-id="${others[i].id}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (dropY < (rect.top + rect.bottom) / 2) {
        insertIndex = i;
        break;
      }
    }

    const newOrder = [...others];
    newOrder.splice(insertIndex, 0, event);
    if (newOrder.every((ev, i) => ev.id === dayEvents[i]?.id)) return;

    commit((p) => ({
      ...p,
      events: p.events.map((ev) => {
        const idx = newOrder.findIndex((o) => o.id === ev.id);
        return idx >= 0 ? { ...ev, dayOrder: idx } : ev;
      }),
    }));
  }

  function handleDragEnd(e: DragEndEvent) {
    const eventId = e.active.data.current?.eventId as string;
    setDraggingId(null);
    const overDay = e.over?.data.current?.dayKey as string | undefined;
    const fromDay = grabDayRef.current;
    const grabPoint = grabPointRef.current;
    grabDayRef.current = null;
    grabPointRef.current = null;
    if (!overDay || !fromDay) return;

    if (overDay === fromDay) {
      if (grabPoint) reorderSameDay(eventId, fromDay, grabPoint.y + e.delta.y);
      return;
    }

    const delta = diffDays(fromDay, overDay);
    const downstream = downstreamMode || shiftKeyRef.current;

    commit((p) => {
      const next = moveEvent(p.events, eventId, delta, downstream);
      const movedIds = new Set<string>();
      next.forEach((ev, i) => {
        if (ev.startDate !== p.events[i]?.startDate || ev.id !== p.events[i]?.id) {
          movedIds.add(ev.id);
        }
      });
      pulse(movedIds);
      return { ...p, events: next };
    });
  }

  // Edge-drag resize via raw pointer tracking
  const handleResizeStart = useCallback(
    (id: string, edge: "start" | "end", e: React.PointerEvent) => {
      e.preventDefault();
      const onMove = (ev: PointerEvent) => {
        const day = dayKeyAtPoint(ev.clientX, ev.clientY);
        if (day) setResizing({ id, edge, dayKey: day });
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const day = dayKeyAtPoint(ev.clientX, ev.clientY);
        setResizing(null);
        if (day) {
          commit((p) => ({ ...p, events: resizeEvent(p.events, id, edge, day) }));
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [commit]
  );

  // Live preview while resizing
  const displayProject = resizing
    ? { ...project, events: resizeEvent(project.events, resizing.id, resizing.edge, resizing.dayKey) }
    : project;

  // Warnings never print; on screen, an overridden conflict is acknowledged
  // and kept off the grid (its reason still shows in the event popover).
  const warnings = forPrint ? new Map<string, string>() : computeWarnings(displayProject.events);
  if (!forPrint) {
    for (const e of displayProject.events) if (e.overrideWarning) warnings.delete(e.id);
  }
  // date → closure label ("" when unlabeled); presence of the key = day closed
  const closures = new Map((displayProject.closures ?? []).map((c) => [c.date, c.label ?? ""]));
  const months: string[] = [];
  if (monthsOverride) {
    months.push(...monthsOverride);
  } else {
    for (let i = 0; i < project.monthsVisible; i++) {
      months.push(addMonthsKey(project.anchorMonth, i));
    }
  }

  const draggedEvent = draggingId ? project.events.find((ev) => ev.id === draggingId) : null;
  const draggedCat = draggedEvent ? categoryOf(project.categories, draggedEvent.category) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="flex flex-col gap-6 print:gap-0">
        {months.map((m, i) => (
          <MonthBlock
            key={m}
            mKey={m}
            project={displayProject}
            selectedId={selectedId}
            showWarnings={!forPrint && i === 0}
            warnings={warnings}
            closures={closures}
            shiftedIds={shiftedIds}
            draggingId={draggingId}
            readOnly={readOnly}
            forPrint={forPrint}
            onSelectEvent={onSelectEvent}
            onResizeStart={handleResizeStart}
            onDayClick={onDayClick}
            onMoreClick={onMoreClick}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggedEvent && draggedCat && (
          <div className="flex flex-col items-start gap-1">
            <div
              className="flex h-[26px] items-center gap-1.5 rounded-md px-2 text-[12px] font-medium shadow-lg"
              style={{
                background: draggedEvent.isMilestone
                  ? draggedCat.color
                  : `color-mix(in srgb, ${draggedCat.color} 22%, white)`,
                color: draggedEvent.isMilestone ? "#fff" : catText(draggedCat.color),
                border: `1px solid ${draggedCat.color}`,
              }}
            >
              <span className="truncate">{draggedEvent.title}</span>
              {(downstreamMode || shiftKeyRef.current) && (
                <span className="rounded bg-black/15 px-1 text-[10px]">+ downstream</span>
              )}
            </div>
            {!(downstreamMode || shiftKeyRef.current) && (
              <div className="whitespace-nowrap rounded bg-ink/85 px-1.5 py-0.5 text-[10px] font-medium text-paper shadow">
                ⇧ Shift-drag to move everything downstream
              </div>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
