"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/state/auth";
import { useEstimate } from "@/state/estimateStore";
import { estimateShareUrl, fetchEstimate, newShareId } from "@/lib/estimator/cloud";
import { syncEstimates } from "@/lib/estimator/account";
import {
  lastOpenId,
  listEstimates,
  loadEstimate,
  sampleEstimate,
  saveEstimate,
} from "@/lib/estimator/storage";
import ActualsGrid from "./ActualsGrid";
import EstimateExportDialog from "./EstimateExportDialog";
import EstimateGrid from "./EstimateGrid";
import EstimatesDialog from "./EstimatesDialog";
import EstimatorHeader from "./EstimatorHeader";
import EstimatorToolbar from "./EstimatorToolbar";
import type { ViewMode } from "./ViewToggle";

type Dialog = "estimates" | "export" | null;

export default function EstimatorApp() {
  const { estimate, open, patch, undo, redo } = useEstimate();
  const { user, getToken } = useAuth();
  const [mode, setMode] = useState<ViewMode>("all");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      <EstimatorHeader onOpenEstimates={() => setDialog("estimates")} />
      <EstimatorToolbar
        mode={mode}
        onModeChange={setMode}
        onShare={onShare}
        onExport={() => setDialog("export")}
      />
      {mode === "actuals" ? <ActualsGrid /> : <EstimateGrid mode={mode} />}

      {dialog === "estimates" && <EstimatesDialog onClose={() => setDialog(null)} />}
      {dialog === "export" && <EstimateExportDialog mode={mode} onClose={() => setDialog(null)} />}

      {toast && (
        <div className="no-print fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-medium text-paper shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
