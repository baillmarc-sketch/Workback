"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import { useBid } from "@/state/aicpStore";
import { bidShareUrl, fetchBid, newShareId } from "@/lib/aicp/cloud";
import { syncBids } from "@/lib/aicp/account";
import { lastOpenId, listBids, loadBid, saveBid, sampleBid } from "@/lib/aicp/storage";
import AicpHeader from "./AicpHeader";
import AicpSummary from "./AicpSummary";
import AicpGrid from "./AicpGrid";
import AicpRatesBar from "./AicpRatesBar";
import AicpDetailsPanel from "./AicpDetailsPanel";
import AicpBidsDialog from "./AicpBidsDialog";
import AicpPrintView, { defaultPrintConfig, type PrintConfig } from "./AicpPrintView";
import AicpPrintDialog from "./AicpPrintDialog";
import AicpHelpDialog from "./AicpHelpDialog";
import { addVersionColumn } from "@/lib/aicp/mutations";
import { buildBidCsv } from "@/lib/aicp/exportCsv";
import { downloadFile } from "@/lib/share";

type View = "bid" | "summary";

/**
 * AICP Bid app shell: boots a bid (shared link #a= > last open > most recent >
 * a fresh seeded bid), keeps it auto-saved/synced via the store, and renders the
 * cover header + the live summary recap. The editable category grid mounts here
 * next; the summary already exercises the full recap engine end-to-end.
 */
export default function AicpApp() {
  const { bid, open, patch, commit, undo, redo } = useBid();
  const { user, getToken } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<View>("bid");
  const [printOpen, setPrintOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState<PrintConfig | null>(null);
  const [bidsOpen, setBidsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  // Boot
  useEffect(() => {
    const bootDefault = () => {
      const last = lastOpenId();
      const fromLast = last ? loadBid(last) : null;
      if (fromLast) return open(fromLast);
      const recents = listBids();
      const fromRecent = recents[0] ? loadBid(recents[0].id) : null;
      if (fromRecent) return open(fromRecent);
      const b = sampleBid();
      saveBid(b);
      open(b);
    };

    const hash = window.location.hash;
    if (hash.startsWith("#a=")) {
      const shareId = decodeURIComponent(hash.slice(3));
      fetchBid(shareId)
        .then((remote) => {
          if (!remote) {
            showToast("That shared bid no longer exists.");
            return bootDefault();
          }
          const local = loadBid(remote.id);
          const winner = local && local.updatedAt > remote.updatedAt ? local : remote;
          saveBid(winner);
          open(winner);
        })
        .catch(() => {
          showToast("Couldn't reach the shared bid — check your connection.");
          bootDefault();
        });
      return;
    }
    bootDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Account sync on sign-in + focus
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const run = () => {
      getToken()
        .then((token) => (token ? syncBids(user.uid, token) : null))
        .then((res) => {
          if (cancelled || !res) return;
          const cur = bid?.id;
          if (cur) {
            const fresh = loadBid(cur);
            if (fresh && fresh.updatedAt > (bid?.updatedAt ?? 0)) open(fresh);
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

  // Undo/redo shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        e.preventDefault();
        setHelpOpen(true);
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
    let shareId = bid?.shareId;
    if (!shareId) {
      shareId = newShareId();
      patch((b) => ({ ...b, shareId }));
    }
    try {
      await navigator.clipboard.writeText(bidShareUrl(shareId));
      showToast("Share link copied to clipboard");
    } catch {
      showToast("Share link ready — sync in progress");
    }
  }, [bid?.shareId, patch, showToast]);

  if (!bid) {
    return <div className="px-4 py-10 text-center text-[13px] text-ink-faint">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="no-print">
      <AicpHeader onShare={onShare} onOpenBids={() => setBidsOpen(true)} />

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-hairline bg-surface p-0.5" role="tablist" aria-label="View">
          {(["bid", "summary"] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded px-3 py-1 text-[12.5px] font-medium capitalize transition-colors ${
                view === v ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view === "bid" && (
            <button
              onClick={() => commit((b) => addVersionColumn(b))}
              className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink"
            >
              + Version column
            </button>
          )}
          <button
            onClick={() => {
              const name = `${(bid.title || "aicp-bid").replace(/[^\w.-]+/g, "_")}.csv`;
              downloadFile(name, buildBidCsv(bid), "text/csv");
              showToast("CSV downloaded");
            }}
            className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink"
          >
            CSV
          </button>
          <button
            onClick={() => {
              setPrintConfig((c) => c ?? defaultPrintConfig(bid));
              setPrintOpen(true);
            }}
            className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {view === "bid" ? (
        <>
          <AicpDetailsPanel />
          <AicpRatesBar />
          <AicpGrid />
          <div className="mt-4">
            <AicpSummary />
          </div>
        </>
      ) : (
        <AicpSummary />
      )}

      <footer className="mt-8 hidden pb-1 text-center text-[11px] text-ink-faint sm:block">
        AICP Bid — auto-saved {bid.shareId ? "& synced" : "locally"} · ⌘Z undo ·{" "}
        <button className="font-medium underline-offset-2 hover:text-ink-soft hover:underline" onClick={() => setHelpOpen(true)}>
          ? How it works
        </button>
      </footer>
      <div className="pb-4 text-center text-[11px] text-ink-faint">©2026. Stolen from Marc Baill.</div>
      </div>

      {/* Print-only document; rendered always so the browser print dialog has it */}
      <AicpPrintView config={printConfig ?? defaultPrintConfig(bid)} />

      {printOpen && printConfig && (
        <AicpPrintDialog config={printConfig} setConfig={setPrintConfig} onClose={() => setPrintOpen(false)} />
      )}
      {bidsOpen && <AicpBidsDialog onClose={() => setBidsOpen(false)} />}
      {helpOpen && <AicpHelpDialog onClose={() => setHelpOpen(false)} />}

      {toast && (
        <div className="no-print fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-medium text-paper shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
