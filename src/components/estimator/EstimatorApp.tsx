"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/state/auth";
import { useEstimate } from "@/state/estimateStore";
import { estimateShareUrl, fetchEstimate, newShareId } from "@/lib/estimator/cloud";
import { syncEstimates } from "@/lib/estimator/account";
import { teamHeartbeat, teamLeave, teamReadOthers, fetchTeamDocUpdatedAt, loadTeamDoc } from "@/lib/teamWorkspace";
import {
  lastOpenId,
  listEstimates,
  loadEstimate,
  migrate,
  sampleEstimate,
  saveEstimate,
} from "@/lib/estimator/storage";
import ActualsGrid from "./ActualsGrid";
import AdjustmentsDialog from "./AdjustmentsDialog";
import EstimateExportDialog from "./EstimateExportDialog";
import EstimateGrid from "./EstimateGrid";
import EstimatePrintDialog from "./EstimatePrintDialog";
import EstimatePrintView, { defaultPrintConfig, type PrintConfig } from "./EstimatePrintView";
import EstimatesDialog from "./EstimatesDialog";
import EstimatorHeader from "./EstimatorHeader";
import EstimatorHelpDialog from "./EstimatorHelpDialog";
import EstimatorToolbar from "./EstimatorToolbar";
import ProjectDetailsPanel from "./ProjectDetailsPanel";
import FeedbackButton from "../feedback/FeedbackButton";
import type { ViewMode } from "./ViewToggle";

type Dialog = "estimates" | "export" | "adjustments" | "print" | "help" | null;

/** "Alex" · "Alex and Sam" · "Alex, Sam and 2 others" — for the live viewers line. */
function formatViewers(names: string[]): string {
  const u = [...new Set(names)];
  if (u.length === 1) return u[0];
  if (u.length === 2) return `${u[0]} and ${u[1]}`;
  return `${u[0]}, ${u[1]} and ${u.length - 2} other${u.length - 2 === 1 ? "" : "s"}`;
}

export default function EstimatorApp() {
  const { estimate, open, openInWorkspace, patch, undo, redo, workspace } = useEstimate();
  const { user, getToken } = useAuth();
  const [mode, setMode] = useState<ViewMode>("all");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [printConfig, setPrintConfig] = useState<PrintConfig | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewers, setViewers] = useState<string[]>([]);
  const [teamAhead, setTeamAhead] = useState(false);
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) sessionIdRef.current = newShareId();
  const estimateRef = useRef(estimate);
  estimateRef.current = estimate;
  const teamRemoteAtRef = useRef(0);
  const teamDismissedRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Boot: shared link (#e=) > last open > most recent > sample
  useEffect(() => {
    const bootDefault = () => {
      const last = lastOpenId();
      const fromLast = last ? loadEstimate(last) : null;
      if (fromLast) return open(fromLast);
      const recents = listEstimates();
      const fromRecent = recents[0] ? loadEstimate(recents[0].id) : null;
      if (fromRecent) return open(fromRecent);
      const e = sampleEstimate();
      saveEstimate(e);
      open(e);
    };

    const hash = window.location.hash;
    if (hash.startsWith("#e=")) {
      const shareId = decodeURIComponent(hash.slice(3));
      fetchEstimate(shareId)
        .then((remote) => {
          if (!remote) {
            showToast("That shared estimate no longer exists.");
            return bootDefault();
          }
          const local = loadEstimate(remote.id);
          const winner = local && local.updatedAt > remote.updatedAt ? local : remote;
          saveEstimate(winner);
          open(winner);
        })
        .catch(() => {
          showToast("Couldn't reach the shared estimate — check your connection.");
          bootDefault();
        });
      return;
    }
    bootDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Account sync: on sign-in (and tab focus) pull/push the account's estimates,
  // then reopen the freshest copy of whatever's on screen.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const run = () => {
      getToken()
        .then((token) => (token ? syncEstimates(user.uid, token) : null))
        .then((res) => {
          if (cancelled || !res) return;
          const cur = estimate?.id;
          if (cur) {
            const fresh = loadEstimate(cur);
            if (fresh && fresh.updatedAt > (estimate?.updatedAt ?? 0)) open(fresh);
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

  // Live presence on team estimates: who else is viewing, by name (member-gated),
  // plus a remote-ahead check so a teammate's newer save can be reloaded.
  const teamId = workspace.kind === "team" ? workspace.teamId : null;
  const docId = estimate?.id ?? null;
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
      await teamHeartbeat(teamId, "estimator", docId, sid, name, token);
      const list = await teamReadOthers(teamId, "estimator", docId, sid, token);
      if (!cancelled) setViewers(list.map((p) => p.name));
      const remoteAt = await fetchTeamDocUpdatedAt(teamId, "estimator", docId, token);
      const localAt = estimateRef.current?.updatedAt ?? 0;
      if (!cancelled && remoteAt !== null) {
        teamRemoteAtRef.current = remoteAt;
        setTeamAhead(remoteAt > localAt + 250 && remoteAt > teamDismissedRef.current);
      }
    };
    tick();
    const iv = setInterval(tick, 12_000);
    const onFocus = () => tick();
    const onBye = () => getToken().then((t) => t && teamLeave(teamId, "estimator", docId, sid, t));
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", onBye);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(iv);
      window.removeEventListener("pagehide", onBye);
      getToken().then((t) => t && teamLeave(teamId, "estimator", docId, sid, t));
    };
  }, [teamId, docId, user, getToken]);

  const reloadTeamDoc = useCallback(async () => {
    if (workspace.kind !== "team") return;
    const cur = estimateRef.current;
    if (!cur) return;
    const token = await getToken();
    if (!token) return;
    const raw = await loadTeamDoc(workspace.teamId, "estimator", cur.id, token);
    if (raw) {
      openInWorkspace(migrate(raw), { kind: "team", teamId: workspace.teamId });
      teamDismissedRef.current = 0;
      setTeamAhead(false);
    }
  }, [workspace, getToken, openInWorkspace]);

  // Undo/redo + help keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // "?" opens help (when not typing in a field)
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
    let shareId = estimate?.shareId;
    if (!shareId) {
      shareId = newShareId();
      patch((est) => ({ ...est, shareId }));
    }
    try {
      await navigator.clipboard.writeText(estimateShareUrl(shareId));
      showToast("Share link copied to clipboard");
    } catch {
      showToast("Share link ready — sync in progress");
    }
  }, [estimate?.shareId, patch, showToast]);

  if (!estimate) {
    return <div className="px-4 py-10 text-center text-[13px] text-ink-faint">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="no-print">
        <EstimatorHeader onOpenEstimates={() => setDialog("estimates")} />
        <EstimatorToolbar
          mode={mode}
          onModeChange={setMode}
          onAdjustments={() => setDialog("adjustments")}
          onShare={onShare}
          onExport={() => setDialog("export")}
          onPrint={() => {
            setPrintConfig((c) => c ?? defaultPrintConfig(estimate));
            setDialog("print");
          }}
        />
        {viewers.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] text-ink-soft">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            {formatViewers(viewers)} {viewers.length === 1 ? "is" : "are"} viewing this team estimate right now.
          </div>
        )}
        {teamAhead && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] text-ink">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            A teammate saved newer changes to this estimate.
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
        <ProjectDetailsPanel key={estimate.id} />
        {mode === "actuals" ? <ActualsGrid /> : <EstimateGrid mode={mode} />}

        <footer className="mt-8 hidden pb-1 text-center text-[11px] text-ink-faint sm:block">
          Estimator — auto-saved {estimate.shareId ? "& synced" : "locally"} · type to edit · Enter ↓ · Tab → · ⌘Z undo ·{" "}
          <button
            className="font-medium underline-offset-2 hover:text-ink-soft hover:underline"
            onClick={() => setDialog("help")}
          >
            ? How it works
          </button>{" "}
          · <FeedbackButton variant="footer" />
        </footer>
        <footer className="mt-8 pb-1 text-center text-[11px] text-ink-faint sm:hidden">
          Auto-saved · tap a cell to edit ·{" "}
          <button className="font-medium underline-offset-2" onClick={() => setDialog("help")}>
            How it works
          </button>{" "}
          · <FeedbackButton variant="footer" />
        </footer>
        <div className="pb-4 text-center text-[11px] text-ink-faint">©2026. Stolen from Marc Baill.</div>
      </div>

      {/* Client-ready PDF document — hidden on screen, shown only when printing */}
      <EstimatePrintView config={printConfig ?? defaultPrintConfig(estimate)} />

      {dialog === "estimates" && <EstimatesDialog onClose={() => setDialog(null)} />}
      {dialog === "export" && <EstimateExportDialog mode={mode} onClose={() => setDialog(null)} />}
      {dialog === "adjustments" && <AdjustmentsDialog onClose={() => setDialog(null)} />}
      {dialog === "print" && (
        <EstimatePrintDialog
          config={printConfig ?? defaultPrintConfig(estimate)}
          setConfig={setPrintConfig}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "help" && <EstimatorHelpDialog onClose={() => setDialog(null)} />}

      {toast && (
        <div className="no-print fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-medium text-paper shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
