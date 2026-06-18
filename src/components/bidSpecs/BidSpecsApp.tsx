"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/state/auth";
import { useBidSpec } from "@/state/bidSpecsStore";
import { bidSpecShareUrl, fetchBidSpec, newShareId } from "@/lib/bidSpecs/cloud";
import { syncBidSpecs } from "@/lib/bidSpecs/account";
import { lastOpenId, listBidSpecs, loadBidSpec, migrate, sampleBidSpec, saveBidSpec } from "@/lib/bidSpecs/storage";
import { teamHeartbeat, teamLeave, teamReadOthers, fetchTeamDocUpdatedAt, loadTeamDoc } from "@/lib/teamWorkspace";
import BidSpecsExportDialog from "./BidSpecsExportDialog";
import BidSpecsHeader from "./BidSpecsHeader";
import BidSpecsHelpDialog from "./BidSpecsHelpDialog";
import BidSpecsListDialog from "./BidSpecsListDialog";
import BidSpecsPrintView from "./BidSpecsPrintView";
import BidSpecsToolbar from "./BidSpecsToolbar";
import SpecEditor from "./SpecEditor";

type Dialog = "list" | "export" | "help" | null;

/** "Alex" · "Alex and Sam" · "Alex, Sam and 2 others" — for the live viewers line. */
function formatViewers(names: string[]): string {
  const u = [...new Set(names)];
  if (u.length === 1) return u[0];
  if (u.length === 2) return `${u[0]} and ${u[1]}`;
  return `${u[0]}, ${u[1]} and ${u.length - 2} other${u.length - 2 === 1 ? "" : "s"}`;
}

export default function BidSpecsApp() {
  const { spec, open, openInWorkspace, patch, undo, redo, workspace } = useBidSpec();
  const { user, getToken } = useAuth();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewers, setViewers] = useState<string[]>([]);
  const [teamAhead, setTeamAhead] = useState(false);
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) sessionIdRef.current = newShareId();
  const specRef = useRef(spec);
  specRef.current = spec;
  const teamRemoteAtRef = useRef(0);
  const teamDismissedRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Boot: shared link (#bs=) > last open > most recent > sample
  useEffect(() => {
    const bootDefault = () => {
      const last = lastOpenId();
      const fromLast = last ? loadBidSpec(last) : null;
      if (fromLast) return open(fromLast);
      const recents = listBidSpecs();
      const fromRecent = recents[0] ? loadBidSpec(recents[0].id) : null;
      if (fromRecent) return open(fromRecent);
      const s = sampleBidSpec();
      saveBidSpec(s);
      open(s);
    };

    const hash = window.location.hash;
    if (hash.startsWith("#bs=")) {
      const shareId = decodeURIComponent(hash.slice(4));
      fetchBidSpec(shareId)
        .then((remote) => {
          if (!remote) {
            showToast("That shared bid spec no longer exists.");
            return bootDefault();
          }
          const local = loadBidSpec(remote.id);
          const winner = local && local.updatedAt > remote.updatedAt ? local : remote;
          saveBidSpec(winner);
          open(winner);
        })
        .catch(() => {
          showToast("Couldn't reach the shared bid spec — check your connection.");
          bootDefault();
        });
      return;
    }
    bootDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Account sync on sign-in / focus.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const run = () => {
      getToken()
        .then((token) => (token ? syncBidSpecs(user.uid, token) : null))
        .then((res) => {
          if (cancelled || !res) return;
          const cur = spec?.id;
          if (cur) {
            const fresh = loadBidSpec(cur);
            if (fresh && fresh.updatedAt > (spec?.updatedAt ?? 0)) open(fresh);
          }
        })
        .catch(() => {});
    };
    run();
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Live presence on team bid specs: who's viewing (by name) + remote-ahead guard.
  const teamId = workspace.kind === "team" ? workspace.teamId : null;
  const docId = spec?.id ?? null;
  useEffect(() => {
    if (!teamId || !docId) {
      setViewers([]);
      setTeamAhead(false);
      return;
    }
    teamDismissedRef.current = 0;
    const sid = sessionIdRef.current;
    const name = (user?.name || user?.email || "A teammate").trim();
    let cancelled = false;
    const tick = async () => {
      const token = await getToken();
      if (!token) return;
      await teamHeartbeat(teamId, "bid-specs", docId, sid, name, token);
      const list = await teamReadOthers(teamId, "bid-specs", docId, sid, token);
      if (!cancelled) setViewers(list.map((p) => p.name));
      const remoteAt = await fetchTeamDocUpdatedAt(teamId, "bid-specs", docId, token);
      const localAt = specRef.current?.updatedAt ?? 0;
      if (!cancelled && remoteAt !== null) {
        teamRemoteAtRef.current = remoteAt;
        setTeamAhead(remoteAt > localAt + 250 && remoteAt > teamDismissedRef.current);
      }
    };
    tick();
    const iv = setInterval(tick, 12_000);
    const onFocus = () => tick();
    const onBye = () => getToken().then((t) => t && teamLeave(teamId, "bid-specs", docId, sid, t));
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onBye);
    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onBye);
      getToken().then((t) => t && teamLeave(teamId, "bid-specs", docId, sid, t));
    };
  }, [teamId, docId, user, getToken]);

  const reloadTeamDoc = useCallback(async () => {
    if (workspace.kind !== "team") return;
    const cur = specRef.current;
    if (!cur) return;
    const token = await getToken();
    if (!token) return;
    const raw = await loadTeamDoc(workspace.teamId, "bid-specs", cur.id, token);
    if (raw) {
      openInWorkspace(migrate(raw), { kind: "team", teamId: workspace.teamId });
      teamDismissedRef.current = 0;
      setTeamAhead(false);
    }
  }, [workspace, getToken, openInWorkspace]);

  // Undo/redo + help shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        e.preventDefault();
        setDialog((d) => d ?? "help");
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const onShare = useCallback(async () => {
    let shareId = spec?.shareId;
    if (!shareId) {
      shareId = newShareId();
      patch((s) => ({ ...s, shareId }));
    }
    try {
      await navigator.clipboard.writeText(bidSpecShareUrl(shareId));
      showToast("Share link copied to clipboard");
    } catch {
      showToast("Share link ready — sync in progress");
    }
  }, [spec?.shareId, patch, showToast]);

  if (!spec) {
    return <div className="px-4 py-10 text-center text-[13px] text-ink-faint">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      <div className="no-print">
        <BidSpecsHeader onOpenList={() => setDialog("list")} />
        <BidSpecsToolbar
          onShare={onShare}
          onExport={() => setDialog("export")}
          onPrint={() => window.print()}
          onHelp={() => setDialog("help")}
        />
        {viewers.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] text-ink-soft">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            {formatViewers(viewers)} {viewers.length === 1 ? "is" : "are"} viewing this team bid spec right now.
          </div>
        )}
        {teamAhead && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] text-ink">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            A teammate saved newer changes to this bid spec.
            <button
              className="rounded-md bg-ink px-2 py-0.5 text-[11.5px] font-semibold text-paper hover:opacity-85"
              onClick={reloadTeamDoc}
            >
              Reload theirs
            </button>
            <button
              className="rounded-md border border-hairline px-2 py-0.5 text-[11.5px] font-medium text-ink-soft hover:text-ink"
              onClick={() => {
                teamDismissedRef.current = teamRemoteAtRef.current;
                setTeamAhead(false);
              }}
            >
              Keep mine
            </button>
          </div>
        )}
        <SpecEditor />

        <footer className="mt-8 hidden pb-1 text-center text-[11px] text-ink-faint sm:block">
          Bid Specs — auto-saved {spec.shareId ? "& synced" : "locally"} · toggle terms · ⌘Z undo ·{" "}
          <button className="font-medium underline-offset-2 hover:text-ink-soft hover:underline" onClick={() => setDialog("help")}>
            ? AICP guides
          </button>
        </footer>
        <div className="pb-4 text-center text-[11px] text-ink-faint">©2026. Stolen from Marc Baill.</div>
      </div>

      {/* Clean print-only spec sheet */}
      <BidSpecsPrintView />

      {dialog === "list" && <BidSpecsListDialog onClose={() => setDialog(null)} />}
      {dialog === "export" && <BidSpecsExportDialog onClose={() => setDialog(null)} />}
      {dialog === "help" && <BidSpecsHelpDialog onClose={() => setDialog(null)} />}

      {toast && (
        <div className="no-print fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-medium text-paper shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
