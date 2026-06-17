"use client";

import { useState } from "react";
import { useStore } from "@/state/store";
import { warnings as computeWarnings } from "@/lib/workback";
import Popover from "./Popover";

type Anchor = { left: number; top: number; right: number; bottom: number };
type Item = { id: string; title: string; reason: string };

const Triangle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
    <path d="M6 1 11.5 10.5H.5L6 1Zm-.6 3.5v3h1.2v-3H5.4Zm0 4v1.2h1.2V8.5H5.4Z" />
  </svg>
);

/**
 * A schedule-warning summary that sits beside the month title: a triangle with
 * the live count, opening a list of every conflict with one-click "Override
 * all" (and "Restore all" for ones already overridden). Project-wide, so it
 * only needs to appear once.
 */
export default function WarningsButton() {
  const { project, commit } = useStore();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  if (!project) return null;

  // computeWarnings ignores the override flag, so we get every real conflict
  // and split it into still-active vs. already-acknowledged.
  const all = computeWarnings(project.events);
  if (all.size === 0) return null;

  const byId = new Map(project.events.map((e) => [e.id, e]));
  const active: Item[] = [];
  const overridden: Item[] = [];
  for (const [id, reason] of all) {
    const e = byId.get(id);
    if (!e) continue;
    (e.overrideWarning ? overridden : active).push({ id, title: e.title || "Untitled", reason });
  }

  const setOverride = (ids: string[], value: boolean) => {
    const set = new Set(ids);
    commit((p) => ({
      ...p,
      events: p.events.map((e) =>
        set.has(e.id) ? { ...e, overrideWarning: value || undefined } : e
      ),
    }));
  };

  const n = active.length;
  const label =
    n > 0 ? `${n} schedule warning${n === 1 ? "" : "s"}` : "All warnings overridden";

  return (
    <>
      <button
        className={`no-print inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${
          n > 0
            ? "border-red-200 bg-red-50 text-danger hover:bg-red-100"
            : "border-hairline text-ink-faint hover:bg-paper"
        }`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        }}
        title={label}
        aria-label={label}
      >
        <Triangle className="h-3.5 w-3.5" />
        {n > 0 && <span>{n}</span>}
      </button>

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} width={340}>
          <div className="flex items-center justify-between border-b border-hairline px-3 py-2.5">
            <h3 className="font-display text-[14px] font-semibold">Schedule warnings</h3>
            {n > 0 && (
              <button
                className="text-[11.5px] font-semibold text-danger hover:underline"
                onClick={() => setOverride(active.map((a) => a.id), true)}
              >
                Override all
              </button>
            )}
          </div>

          <div className="max-h-[55vh] overflow-y-auto px-3 py-2.5">
            {active.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {active.map((w) => (
                  <li key={w.id} className="flex items-start justify-between gap-2 text-[12px]">
                    <span className="flex min-w-0 items-start gap-1.5">
                      <Triangle className="mt-px h-3 w-3 shrink-0 text-danger" />
                      <span className="min-w-0">
                        <span className="font-medium">{w.title}</span>
                        <span className="text-ink-soft"> — {w.reason}</span>
                      </span>
                    </span>
                    <button
                      className="shrink-0 text-[11px] font-medium text-ink-faint hover:text-ink"
                      onClick={() => setOverride([w.id], true)}
                    >
                      Override
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-ink-soft">Every conflict here is overridden.</p>
            )}

            {overridden.length > 0 && (
              <div className="mt-3 border-t border-hairline pt-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
                    Overridden · {overridden.length}
                  </span>
                  <button
                    className="text-[11.5px] font-semibold text-ink-soft hover:text-ink hover:underline"
                    onClick={() => setOverride(overridden.map((o) => o.id), false)}
                  >
                    Restore all
                  </button>
                </div>
                <ul className="flex flex-col gap-2">
                  {overridden.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-start justify-between gap-2 text-[12px] text-ink-soft"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{w.title}</span> — {w.reason}
                      </span>
                      <button
                        className="shrink-0 text-[11px] font-medium text-ink-faint hover:text-ink"
                        onClick={() => setOverride([w.id], false)}
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}
