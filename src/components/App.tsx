"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { syncAccount } from "@/lib/account";
import { fetchShared, newShareId, publishProject, shareUrl } from "@/lib/cloud";
import { addDaysKey, durationDays } from "@/lib/dates";
import { decodeShareCode, encodeShareCode } from "@/lib/share";
import {
  lastOpenId,
  listProjects,
  loadProject,
  sampleProject,
  saveProject,
} from "@/lib/storage";
import type { WorkbackEvent } from "@/lib/types";
import { uid } from "@/lib/types";
import { useAuth } from "@/state/auth";
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
  const { project, open, commit, patch, undo, redo } = useStore();
  const { user, getToken } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editAnchor, setEditAnchor] = useState<Anchor | null>(null);
  const [create, setCreate] = useState<{ dayKey: string; anchor: Anchor } | null>(null);
  const [more, setMore] = useState<{ dayKey: string; events: WorkbackEvent[]; anchor: Anchor } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [downstreamMode, setDownstreamMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clipboardRef = useRef<WorkbackEvent | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // Boot: shared link in URL > share code in URL > last open > most recent > sample
  useEffect(() => {
    const bootDefault = () => {
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
    };

    const hash = window.location.hash;
    if (hash.startsWith("#p=")) {
      // Shared cloud link: open the live copy (the hash stays in the URL so
      // a refresh re-syncs). Keep the local version if it's newer.
      fetchShared(decodeURIComponent(hash.slice(3)))
        .then((remote) => {
          if (!remote) {
            showToast("That shared calendar no longer exists.");
            bootDefault();
            return;
          }
          const local = loadProject(remote.id);
          const winner = local && local.updatedAt > remote.updatedAt ? local : remote;
          saveProject(winner);
          open(winner);
        })
        .catch(() => {
          showToast("Couldn't reach the shared calendar — check your connection.");
          bootDefault();
        });
      return;
    }
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
    bootDefault();
  }, [open, showToast]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Shared projects: pull the cloud copy when the tab regains focus, so a
  // collaborator's edits show up when you come back to the calendar
  useEffect(() => {
    if (!project?.shareId) return;
    const { shareId, updatedAt } = project;
    let cancelled = false;
    const pull = () => {
      fetchShared(shareId)
        .then((remote) => {
          if (cancelled || !remote) return;
          if (remote.updatedAt > updatedAt) {
            saveProject(remote);
            open(remote);
            showToast("Updated with the latest shared changes");
          }
        })
        .catch(() => {});
    };
    const onVisible = () => document.visibilityState === "visible" && pull();
    window.addEventListener("focus", pull);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", pull);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [project, open, showToast]);

  // Account sync: merge the signed-in user's projects on login and when the
  // tab regains focus (throttled), mirroring the shared-link pull pattern
  const lastAccountSyncRef = useRef(0);
  const projectIdRef = useRef<string | null>(null);
  projectIdRef.current = project?.id ?? null;
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const sync = (force = false) => {
      const now = Date.now();
      if (!force && now - lastAccountSyncRef.current < 30_000) return;
      lastAccountSyncRef.current = now;
      getToken()
        .then((token) => (token ? syncAccount(user.uid, token) : null))
        .then((result) => {
          if (cancelled || !result) return;
          const current = projectIdRef.current;
          if (current && result.pulledIds.includes(current)) {
            const fresh = loadProject(current);
            if (fresh) open(fresh);
          }
          if (result.pulledIds.length > 0) {
            const n = result.pulledIds.length;
            showToast(`Synced ${n} project${n === 1 ? "" : "s"} from your account`);
          }
        })
        .catch(() => {});
    };
    sync(true);
    const onFocus = () => sync();
    const onVisible = () => document.visibilityState === "visible" && sync();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, getToken, open, showToast]);

  // Share: publish to the cloud and hand the short link to the native share
  // sheet (text it straight from the phone). Falls back to a long
  // self-contained #wb= link if the cloud isn't reachable/configured.
  const handleShareLink = useCallback(async () => {
    let p = project;
    if (!p) return;
    if (!p.shareId) {
      const sid = newShareId();
      patch((pp) => ({ ...pp, shareId: sid }));
      p = { ...p, shareId: sid };
    }
    let url: string;
    let note = "Link copied — text it to anyone";
    try {
      await publishProject(p);
      url = shareUrl(p.shareId!);
    } catch {
      url = `${location.origin}${location.pathname}#wb=${encodeShareCode(p)}`;
      note = "Cloud share unavailable — copied a full link instead";
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: p.title || "Workback", url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast(note);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // user closed share sheet
      try {
        await navigator.clipboard.writeText(url);
        showToast(note);
      } catch {
        showToast("Couldn't open the share sheet — use Share options instead");
      }
    }
  }, [project, patch, showToast]);

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
      if (typing) return;
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
  }, [project, selectedId, editAnchor, commit, undo, redo]);

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-faint">
        Loading…
      </div>
    );
  }

  return (
    <div className="calendar-scroll mx-auto min-h-screen max-w-[1200px] px-3 py-5 sm:px-4 sm:py-6 md:px-8">
      <Header onOpenProjects={() => setDialog("projects")} />

      <Toolbar
        downstreamMode={downstreamMode}
        onToggleDownstream={() => setDownstreamMode((v) => !v)}
        onAddRound={() => setDialog("round")}
        onCompress={() => setDialog("compress")}
        onShare={() => setDialog("share")}
        onShareLink={handleShareLink}
      />

      {project.showLegend && (
        <Legend categories={project.categories} editable className="no-print mb-4 px-1" />
      )}

      {project.events.length === 0 && (
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
        onSelectEvent={handleSelectEvent}
        onDayClick={handleDayClick}
        onMoreClick={handleMoreClick}
      />

      <footer className="no-print mt-8 hidden pb-4 text-center text-[11px] text-ink-faint sm:block">
        Workback Builder — auto-saved locally · ⌘Z undo · ⌘C/⌘V copy events · Shift-drag shifts
        downstream
      </footer>
      <footer className="no-print mt-8 pb-4 text-center text-[11px] text-ink-faint sm:hidden">
        Auto-saved · tap a day to add · hold an event to drag it
      </footer>

      {selected && editAnchor && (
        <EventPopover event={selected} anchor={editAnchor} onClose={closePopovers} />
      )}
      {create && (
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

      {dialog === "share" && (
        <ShareDialog onClose={() => setDialog(null)} onShareLink={handleShareLink} />
      )}
      {dialog === "compress" && <CompressDialog onClose={() => setDialog(null)} />}
      {dialog === "round" && <ReviewRoundDialog onClose={() => setDialog(null)} />}
      {dialog === "projects" && <ProjectsDialog onClose={() => setDialog(null)} />}

      {toast && (
        <div
          role="status"
          className="no-print fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-medium text-paper shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
