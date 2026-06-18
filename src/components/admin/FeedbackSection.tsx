"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import {
  deleteFeedback,
  listFeedback,
  setFeedbackStatus,
  type FeedbackEntry,
} from "@/lib/feedback/feedback";
import type { CapturedError } from "@/lib/feedback/errorLog";
import ConfirmDialog from "../ConfirmDialog";

const KIND_LABEL: Record<string, string> = {
  bug: "Bug",
  idea: "Idea",
  praise: "Praise",
  other: "Other",
};
const KIND_CLASS: Record<string, string> = {
  bug: "bg-red-50 text-danger",
  idea: "bg-amber-50 text-amber-700",
  praise: "bg-emerald-50 text-emerald-700",
  other: "bg-paper text-ink-soft",
};

function parseErrors(raw: string | null): CapturedError[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as CapturedError[]) : [];
  } catch {
    return [];
  }
}

/** Self-service feedback queue. New reports surface first; each can be expanded
    for full context (browser, errors, screenshot), marked reviewed, or deleted. */
export default function FeedbackSection({ onCount }: { onCount?: (n: number) => void }) {
  const { user, getToken } = useAuth();
  const [items, setItems] = useState<FeedbackEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"new" | "all">("new");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteAsk, setDeleteAsk] = useState<FeedbackEntry | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const reportCount = useCallback(
    (list: FeedbackEntry[]) => onCount?.(list.reduce((n, f) => (f.status !== "reviewed" ? n + 1 : n), 0)),
    [onCount]
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const list = await listFeedback(token);
      setItems(list);
      reportCount(list);
    } catch (e) {
      setError((e as Error).message || "Could not load feedback");
    }
  }, [getToken, reportCount]);

  useEffect(() => {
    load();
  }, [load]);

  const mark = useCallback(
    async (entry: FeedbackEntry, status: "new" | "reviewed") => {
      setBusy(entry.id);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        await setFeedbackStatus(token, entry.id, status, user);
        setItems((cur) => {
          const next = cur?.map((f) => (f.id === entry.id ? { ...f, status } : f)) ?? null;
          if (next) reportCount(next);
          return next;
        });
      } catch (e) {
        setError((e as Error).message || "Action failed");
      } finally {
        setBusy(null);
      }
    },
    [getToken, user, reportCount]
  );

  const remove = useCallback(
    async (entry: FeedbackEntry) => {
      setBusy(entry.id);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        await deleteFeedback(token, entry.id);
        setItems((cur) => {
          const next = cur?.filter((f) => f.id !== entry.id) ?? null;
          if (next) reportCount(next);
          return next;
        });
      } catch (e) {
        setError((e as Error).message || "Delete failed");
      } finally {
        setBusy(null);
      }
    },
    [getToken, reportCount]
  );

  const visible = (items ?? []).filter((f) => filter === "all" || f.status !== "reviewed");
  const newCount = (items ?? []).reduce((n, f) => (f.status !== "reviewed" ? n + 1 : n), 0);

  const tab = (id: "new" | "all", label: string) => (
    <button
      className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
        filter === id ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
      }`}
      onClick={() => setFilter(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-ink-soft">
          Bug reports and ideas submitted from the app. Mark items reviewed as you work through them.
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {tab("new", `New${newCount ? ` (${newCount})` : ""}`)}
          {tab("all", "All")}
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</div>}

      {items === null ? (
        <div className="py-10 text-center text-[12.5px] text-ink-faint">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="py-6 text-center text-[12.5px] text-ink-faint">
          {filter === "new" ? "No new feedback. 🎉" : "No feedback yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((f) => {
            const errs = parseErrors(f.errors);
            const open = expanded === f.id;
            return (
              <div
                key={f.id}
                className={`overflow-hidden rounded-lg border bg-surface ${
                  f.status === "reviewed" ? "border-hairline opacity-75" : "border-hairline-strong"
                }`}
              >
                <div className="flex items-start gap-2 px-3 py-2.5">
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${KIND_CLASS[f.kind]}`}
                  >
                    {KIND_LABEL[f.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="whitespace-pre-wrap text-[13px] text-ink">{f.message}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-faint">
                      <span>{f.name || f.email || "Anonymous"}</span>
                      {f.email && f.name && <span className="text-ink-faint">· {f.email}</span>}
                      {f.app && <span>· {f.app}</span>}
                      {f.createdAt > 0 && <span>· {new Date(f.createdAt).toLocaleString()}</span>}
                      {f.screenshot && <span>· 📎 screenshot</span>}
                      {errs.length > 0 && <span className="text-danger">· {errs.length} error{errs.length === 1 ? "" : "s"}</span>}
                      {f.status === "reviewed" && <span>· reviewed</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      className="rounded-md px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:text-ink"
                      onClick={() => setExpanded(open ? null : f.id)}
                    >
                      {open ? "Hide" : "Details"}
                    </button>
                    {f.status === "reviewed" ? (
                      <button
                        className="rounded-md px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
                        disabled={busy === f.id}
                        onClick={() => mark(f, "new")}
                      >
                        Reopen
                      </button>
                    ) : (
                      <button
                        className="rounded-md bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper hover:opacity-85 disabled:opacity-50"
                        disabled={busy === f.id}
                        onClick={() => mark(f, "reviewed")}
                      >
                        {busy === f.id ? "…" : "Mark reviewed"}
                      </button>
                    )}
                    <button
                      className="rounded-md px-2 py-0.5 text-[11px] font-medium text-ink-faint hover:text-danger disabled:opacity-50"
                      disabled={busy === f.id}
                      onClick={() => setDeleteAsk(f)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-hairline bg-paper px-3 py-2.5 text-[11.5px] text-ink-soft">
                    {f.screenshot && (
                      <button className="mb-2 block" onClick={() => setLightbox(f.screenshot)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.screenshot}
                          alt="Feedback screenshot"
                          className="max-h-48 rounded-md border border-hairline"
                        />
                      </button>
                    )}
                    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5">
                      {f.viewport && (
                        <>
                          <dt className="text-ink-faint">Viewport</dt>
                          <dd>{f.viewport}</dd>
                        </>
                      )}
                      {f.path && (
                        <>
                          <dt className="text-ink-faint">Path</dt>
                          <dd className="break-all">{f.path}</dd>
                        </>
                      )}
                      {f.appVersion && (
                        <>
                          <dt className="text-ink-faint">Version</dt>
                          <dd>{f.appVersion}</dd>
                        </>
                      )}
                      {f.userAgent && (
                        <>
                          <dt className="text-ink-faint">Browser</dt>
                          <dd className="break-words">{f.userAgent}</dd>
                        </>
                      )}
                      {f.uid && (
                        <>
                          <dt className="text-ink-faint">UID</dt>
                          <dd className="break-all">{f.uid}</dd>
                        </>
                      )}
                    </dl>
                    {errs.length > 0 && (
                      <div className="mt-2">
                        <div className="mb-1 font-medium text-ink">Recent errors</div>
                        <ul className="flex flex-col gap-1">
                          {errs.map((e, i) => (
                            <li key={i} className="rounded bg-surface px-2 py-1 font-mono text-[10.5px] text-ink-soft">
                              <div className="text-danger">{e.message}</div>
                              {e.source && <div className="text-ink-faint">{e.source}</div>}
                              {e.stack && (
                                <pre className="mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap text-ink-faint">
                                  {e.stack}
                                </pre>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteAsk && (
        <ConfirmDialog
          title="Delete feedback"
          danger
          confirmLabel="Delete"
          body={<>Permanently delete this {KIND_LABEL[deleteAsk.kind].toLowerCase()} report? This can&apos;t be undone.</>}
          onConfirm={() => remove(deleteAsk)}
          onClose={() => setDeleteAsk(null)}
        />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Feedback screenshot" className="max-h-full max-w-full rounded-md" />
        </div>
      )}
    </div>
  );
}
