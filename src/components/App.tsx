"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDaysKey, durationDays } from "@/lib/dates";
import { decodeShareCode } from "@/lib/share";
import {
  lastOpenId,
  listProjects,
  loadProject,
  sampleProject,
  saveProject,
} from "@/lib/storage";
import type { WorkbackEvent } from "@/lib/types";
import { uid } from "@/lib/types";
import { useStore } from "@/state/store";
import Calendar from "./Calendar";
import CompressDialog from "./CompressDialog";
import CreatePopover from "./CreatePopover";
import EventPopover from "./EventPopover";
import Header from "./Header";
import Legend from "./Legend";
import MorePopover from "./MorePopover";
import ProjectsDialog from "./ProjectsDialog";
import ReviewRoundDialog from "./ReviewRoundDialog";
import ShareDialog from "./ShareDialog";
import Toolbar from "./Toolbar";

type Anchor = { left: number; top: number; right: number; bottom: number };
type Dialog = "share" | "compress" | "round" | "projects" | null;

function rectToAnchor(r: DOMRect): Anchor {
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

export default function App() {
  const { project, open, commit, undo, redo } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editAnchor, setEditAnchor] = useState<Anchor | null>(null);
  const [create, setCreate] = useState<{ dayKey: string; anchor: Anchor } | null>(null);
  const [more, setMore] = useState<{ dayKey: string; events: WorkbackEvent[]; anchor: Anchor } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [downstreamMode, setDownstreamMode] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const clipboardRef = useRef<WorkbackEvent | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Boot: share code in URL > last open project > most recent > fresh sample
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#wb=")) {
      try {
        const p = decodeShareCode(hash.slice(4));
        saveProject(p);
        open(p);
        history.replaceState(null, "", window.location.pathname);
        return;
      } catch {
        // fall through to normal boot
      }
    }
    const last = lastOpenId();
    const fromLast = last ? loadProject(last) : null;
    if (fromLast) {
      open(fromLast);
      return;
    }
    const recents = listProjects();
    const fromRecent = recents[0] ? loadProject(recents[0].id) : null;
    if (fromRecent) {
      open(fromRecent);
      if (recents.length > 1) setDialog("projects");
      return;
    }
    const p = sampleProject();
    saveProject(p);
    open(p);
  }, [open]);

  // Mobile = read-only view for v1
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setReadOnly(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const selected = project?.events.find((e) => e.id === selectedId) ?? null;

  const closePopovers = useCallback(() => {
    setEditAnchor(null);
    setCreate(null);
    setMore(null);
  }, []);

  const handleSelectEvent = useCallback((id: string, rect: DOMRect) => {
    setSelectedId(id);
    setCreate(null);
    setMore(null);
    setEditAnchor(rectToAnchor(rect));
  }, []);

  const handleDayClick = useCallback((dayKey: string, rect: DOMRect) => {
    setSelectedId(null);
    setEditAnchor(null);
    setMore(null);
    setCreate({ dayKey, anchor: rectToAnchor(rect) });
  }, []);

  const handleMoreClick = useCallback(
    (dayKey: string, events: WorkbackEvent[], rect: DOMRect) => {
      setCreate(null);
      setEditAnchor(null);
      setMore({ dayKey, events, anchor: rectToAnchor(rect) });
    },
    []
  );

  // Global keyboard: undo/redo, copy/paste, delete
  useEffect(() => {
    function dayUnderMouse(): string | null {
      for (const el of document.elementsFromPoint(mouseRef.current.x, mouseRef.current.y)) {
        const day = (el as HTMLElement).dataset?.day;
        if (day) return day;
      }
      return null;
    }

    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing =
        t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      if (typing || readOnly) return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "c" && selectedId) {
        const ev = project?.events.find((x) => x.id === selectedId);
        if (ev) clipboardRef.current = { ...ev };
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && clipboardRef.current) {
        e.preventDefault();
        const src = clipboardRef.current;
        const dur = durationDays(src.startDate, src.endDate);
        const target = dayUnderMouse() ?? addDaysKey(src.endDate, 1);
        const copy: WorkbackEvent = {
          ...src,
          id: uid(),
          startDate: target,
          endDate: addDaysKey(target, dur - 1),
          roundId: undefined,
          roundRole: undefined,
        };
        commit((p) => ({ ...p, events: [...p.events, copy] }));
        setSelectedId(copy.id);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !editAnchor) {
        e.preventDefault();
        commit((p) => ({ ...p, events: p.events.filter((x) => x.id !== selectedId) }));
        setSelectedId(null);
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, selectedId, editAnchor, readOnly, commit, undo, redo]);

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-faint">
        Loading…
      </div>
    );
  }

  return (
    <div className="calendar-scroll mx-auto min-h-screen max-w-[1200px] px-4 py-6 md:px-8">
      {readOnly && (
        <div className="no-print mb-3 rounded-md border border-hairline bg-surface px-3 py-2 text-[12px] text-ink-soft">
          Read-only view — open on a larger screen to edit this workback.
        </div>
      )}

      <Header onOpenProjects={() => setDialog("projects")} />

      <Toolbar
        downstreamMode={downstreamMode}
        onToggleDownstream={() => setDownstreamMode((v) => !v)}
        onAddRound={() => setDialog("round")}
        onCompress={() => setDialog("compress")}
        onShare={() => setDialog("share")}
        readOnly={readOnly}
      />

      {project.showLegend && <Legend className="no-print mb-4 px-1" />}

      {project.events.length === 0 && !readOnly && (
        <div className="no-print mb-4 rounded-lg border border-dashed border-hairline-strong bg-surface px-4 py-3 text-center text-[13px] text-ink-soft">
          Click any day to add your first event. Drag bars to move them — hold{" "}
          <kbd className="rounded border border-hairline bg-paper px-1 text-[11px]">Shift</kbd>{" "}
          while dragging to shift everything downstream too.
        </div>
      )}

      <Calendar
        project={project}
        selectedId={selectedId}
        downstreamMode={downstreamMode}
        readOnly={readOnly}
        onSelectEvent={handleSelectEvent}
        onDayClick={handleDayClick}
        onMoreClick={handleMoreClick}
      />

      <footer className="no-print mt-8 pb-4 text-center text-[11px] text-ink-faint">
        Workback Builder — auto-saved locally · ⌘Z undo · ⌘C/⌘V copy events · Shift-drag shifts
        downstream
      </footer>

      {selected && editAnchor && !readOnly && (
        <EventPopover event={selected} anchor={editAnchor} onClose={closePopovers} />
      )}
      {create && !readOnly && (
        <CreatePopover
          dayKey={create.dayKey}
          anchor={create.anchor}
          onClose={closePopovers}
          onCreated={setSelectedId}
        />
      )}
      {more && (
        <MorePopover
          dayKey={more.dayKey}
          events={more.events}
          anchor={more.anchor}
          onClose={closePopovers}
          onPick={handleSelectEvent}
        />
      )}

      {dialog === "share" && <ShareDialog onClose={() => setDialog(null)} />}
      {dialog === "compress" && <CompressDialog onClose={() => setDialog(null)} />}
      {dialog === "round" && <ReviewRoundDialog onClose={() => setDialog(null)} />}
      {dialog === "projects" && <ProjectsDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
