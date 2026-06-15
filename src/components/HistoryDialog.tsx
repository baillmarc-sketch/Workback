"use client";

import { useState } from "react";
import { clearHistory, loadHistory } from "@/lib/history";
import { useStore } from "@/state/store";
import Modal from "./Modal";

function relTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function HistoryDialog({ onClose }: { onClose: () => void }) {
  const { project, commit } = useStore();
  const [, bump] = useState(0);
  if (!project) return null;

  // Newest first; the very latest entry is the current state, so it's not a
  // "restore" target — mark it as current instead.
  const entries = loadHistory(project.id).slice().reverse();

  return (
    <Modal title="History" onClose={onClose} width={460}>
      <div className="flex flex-col gap-3">
        <p className="text-[12px] text-ink-soft">
          Every change is saved here — restore any point, even after a reload. Restoring is
          itself undoable (⌘Z).
        </p>

        {entries.length === 0 ? (
          <div className="py-6 text-center text-[12.5px] text-ink-faint">No history yet.</div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-hairline">
            {entries.map((e, i) => (
              <div
                key={e.id}
                className="flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{e.label}</div>
                  <div className="text-[11px] text-ink-faint">{relTime(e.ts)}</div>
                </div>
                {i === 0 ? (
                  <span className="shrink-0 text-[10.5px] font-medium text-ink-faint">current</span>
                ) : (
                  <button
                    className="shrink-0 rounded-md border border-hairline px-2 py-1 text-[11.5px] font-medium hover:bg-paper"
                    onClick={() => {
                      commit(() => e.snapshot);
                      onClose();
                    }}
                  >
                    Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <button
            className="self-start text-[11.5px] font-medium text-ink-faint hover:text-danger"
            onClick={() => {
              if (confirm("Clear this project's saved history? This can't be undone.")) {
                clearHistory(project.id);
                bump((n) => n + 1);
              }
            }}
          >
            Clear history
          </button>
        )}
      </div>
    </Modal>
  );
}
