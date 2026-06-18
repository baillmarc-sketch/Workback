"use client";

import { useState } from "react";
import { isCoarsePointer } from "@/lib/device";
import type { ColumnLink, ColumnRole, EstimateColumn } from "@/lib/estimator/types";
import { useEstimate } from "@/state/estimateStore";
import Popover from "../Popover";

interface ColumnEditorPopoverProps {
  column: EstimateColumn;
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
}

const fieldCls =
  "rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";
const inputCls = `w-full ${fieldCls}`;
const labelCls = "mb-1 block text-[10.5px] font-semibold tracking-[0.06em] text-ink-faint uppercase";

/** Add a scheme so a bare "drive.google.com/…" still opens as an absolute URL,
    and only ever return an http(s) link. Column links are stored on shared/team
    estimates, so a crafted `javascript:`/`data:` URL would be a stored XSS when a
    viewer clicks it — anything that doesn't resolve to http(s) becomes inert. */
function hrefOf(url: string): string {
  const u = url.trim();
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "about:blank";
  } catch {
    return "about:blank";
  }
}

export default function ColumnEditorPopover({ column: columnProp, anchor, onClose }: ColumnEditorPopoverProps) {
  const { estimate, commit, patch } = useEstimate();
  const columnId = columnProp.id;

  // Text/number fields are backed by LOCAL state so the input always shows
  // exactly what's typed — committing to the store on every keystroke and
  // reading the value back races (the field lags the store by a character).
  // We seed once from the column and write through to the store on change.
  const [name, setName] = useState(columnProp.name);
  const [vendor, setVendor] = useState(columnProp.vendor ?? "");
  const [notes, setNotes] = useState(columnProp.notes ?? "");
  const [links, setLinks] = useState<ColumnLink[]>(columnProp.links ?? []);
  const [ovr, setOvr] = useState<Record<string, { off: boolean; text: string }>>(() => {
    const m: Record<string, { off: boolean; text: string }> = {};
    for (const [k, v] of Object.entries(columnProp.adjustmentOverrides ?? {})) {
      if (v === null) m[k] = { off: true, text: "" };
      else if (typeof v === "number") m[k] = { off: false, text: String(v) };
    }
    return m;
  });

  const writeLinks = (next: ColumnLink[]) => {
    setLinks(next); // keep half-typed rows visible while editing
    const cleaned = next.filter((l) => l.url.trim());
    update({ links: cleaned.length ? cleaned : undefined });
  };

  if (!estimate) return null;
  // Role, baseline, and awarded are click-driven, so read them live from the
  // store for correct active state.
  const live = estimate.columns.find((c) => c.id === columnId);
  if (!live) return null;
  const isBaseline = estimate.baselineColumnId === columnId;

  const update = (changes: Partial<EstimateColumn>) =>
    commit((e) => ({
      ...e,
      columns: e.columns.map((c) => (c.id === columnId ? { ...c, ...changes } : c)),
    }));

  const writeOvr = (next: Record<string, { off: boolean; text: string }>) => {
    setOvr(next);
    const built: Record<string, number | null> = {};
    for (const adj of estimate.adjustments) {
      const row = next[adj.id];
      if (!row) continue;
      if (row.off) built[adj.id] = null;
      else if (row.text.trim() !== "") {
        const n = Number(row.text);
        if (Number.isFinite(n)) built[adj.id] = n;
      }
    }
    update({ adjustmentOverrides: Object.keys(built).length ? built : undefined });
  };
  const setOvrVal = (id: string, text: string) => writeOvr({ ...ovr, [id]: { off: ovr[id]?.off ?? false, text } });
  const setOvrOff = (id: string, off: boolean) => writeOvr({ ...ovr, [id]: { off, text: ovr[id]?.text ?? "" } });

  // Per-(adjustment × section) toggle for this column. Click-driven, so read the
  // live column rather than mirroring into local state.
  const sectionOff = (adjId: string, sectionId: string) =>
    !!live.adjustmentSectionsOff?.[`${adjId}:${sectionId}`];
  const toggleSection = (adjId: string, sectionId: string) =>
    commit((e) => ({
      ...e,
      columns: e.columns.map((c) => {
        if (c.id !== columnId) return c;
        const key = `${adjId}:${sectionId}`;
        const next = { ...(c.adjustmentSectionsOff ?? {}) };
        if (next[key]) delete next[key];
        else next[key] = true;
        return { ...c, adjustmentSectionsOff: Object.keys(next).length ? next : undefined };
      }),
    }));

  return (
    <Popover anchor={anchor} onClose={onClose} width={300}>
      <div className="flex max-h-[80vh] flex-col gap-3 overflow-y-auto p-3.5">
        <input
          className="w-full border-none bg-transparent text-[15px] font-semibold outline-none placeholder:text-ink-faint"
          value={name}
          placeholder="Column name"
          autoFocus={!isCoarsePointer()}
          onChange={(e) => {
            setName(e.target.value);
            update({ name: e.target.value });
          }}
          onKeyDown={(e) => e.key === "Enter" && onClose()}
        />

        <div>
          <label className={labelCls}>Type</label>
          <div className="flex overflow-hidden rounded-md border border-hairline" role="group" aria-label="Column type">
            {(["version", "vendor"] as ColumnRole[]).map((role) => (
              <button
                key={role}
                aria-pressed={live.role === role}
                className={`flex-1 px-2.5 py-1.5 text-[12px] font-medium capitalize ${
                  live.role === role ? "bg-ink text-paper" : "bg-surface text-ink-soft hover:text-ink"
                }`}
                onClick={() => update({ role })}
              >
                {role === "version" ? "Version" : "Vendor bid"}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={!!live.range}
            onChange={(e) => update({ range: e.target.checked || undefined })}
          />
          Ballpark range column (low–high)
        </label>

        {live.role === "vendor" && (
          <div>
            <label className={labelCls}>Company</label>
            <input
              className={inputCls}
              value={vendor}
              placeholder="Production company name"
              onChange={(e) => {
                setVendor(e.target.value);
                update({ vendor: e.target.value || undefined });
              }}
            />
          </div>
        )}

        <div>
          <label className={labelCls}>Links</label>
          <div className="flex flex-col gap-1.5">
            {links.map((l, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  className={`${fieldCls} w-[64px] shrink-0 text-[12px]`}
                  value={l.label}
                  placeholder="Note"
                  onChange={(e) => writeLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  className={`${fieldCls} w-0 min-w-0 flex-1`}
                  value={l.url}
                  placeholder="https://…"
                  inputMode="url"
                  onChange={(e) => writeLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                />
                {l.url.trim() && (
                  <a
                    href={hrefOf(l.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-0.5 text-[13px] text-ink-faint hover:text-ink"
                    title="Open link"
                  >
                    ↗
                  </a>
                )}
                <button
                  className="shrink-0 px-0.5 text-[13px] text-ink-faint hover:text-danger"
                  title="Remove link"
                  onClick={() => writeLinks(links.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="self-start text-[12px] font-medium text-ink-soft hover:text-ink"
              onClick={() => writeLinks([...links, { label: "", url: "" }])}
            >
              + Add link
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            className={`${inputCls} min-h-[48px] resize-y`}
            value={notes}
            placeholder="Notes about this bid / version…"
            onChange={(e) => {
              setNotes(e.target.value);
              update({ notes: e.target.value || undefined });
            }}
          />
        </div>

        {estimate.adjustments.length > 0 && (
          <div>
            <label className={labelCls}>Adjustments for this column</label>
            <div className="flex flex-col gap-2">
              {estimate.adjustments.map((adj) => {
                const row = ovr[adj.id];
                const on = !row?.off;
                const unit = adj.type === "percent" ? "%" : estimate.currency;
                return (
                  <div key={adj.id} className="rounded-md border border-hairline px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => setOvrOff(adj.id, !e.target.checked)}
                        />
                        <span className="truncate text-[13px] font-medium">{adj.label}</span>
                      </label>
                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          className={`${fieldCls} w-14 text-right tabular-nums disabled:opacity-40`}
                          type="number"
                          step={adj.type === "percent" ? "0.5" : "100"}
                          value={on ? (row?.text ?? "") : ""}
                          placeholder={String(adj.value)}
                          disabled={!on}
                          onChange={(e) => setOvrVal(adj.id, e.target.value)}
                        />
                        <span className="w-6 text-[11px] text-ink-faint">{unit}</span>
                      </div>
                    </div>
                    {/* Per-section matrix: percent adjustments can skip individual
                        sections for this column. Hidden when off for the column,
                        flat, or there's only one section. */}
                    {on && adj.type === "percent" && estimate.sections.length > 1 && (
                      <div className="mt-1.5 border-t border-hairline pt-1.5">
                        <div className="mb-1 text-[10px] tracking-[0.04em] text-ink-faint uppercase">Applies to</div>
                        <div className="flex flex-wrap gap-1">
                          {estimate.sections.map((s) => {
                            const off = sectionOff(adj.id, s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                aria-pressed={!off}
                                title={off ? `Include ${s.name}` : `Exclude ${s.name}`}
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                  off
                                    ? "border-hairline bg-surface text-ink-faint line-through"
                                    : "border-ink-faint bg-paper text-ink-soft"
                                }`}
                                onClick={() => toggleSection(adj.id, s.id)}
                              >
                                {s.name || "Section"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              Leave the value blank to use the estimate default. Uncheck to drop the adjustment
              for this column, or tap a section to exclude just that part.
            </p>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={isBaseline}
            onChange={(e) =>
              // Baseline is a view setting (it drives the delta row), so patch
              // rather than commit — no need to clutter undo history.
              patch((est) => ({ ...est, baselineColumnId: e.target.checked ? columnId : undefined }))
            }
          />
          Use as baseline for deltas
        </label>

        <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={estimate.awardedColumnId === columnId}
            onChange={(e) =>
              // Awarding is a real decision — commit it. It also becomes the
              // default Estimate source in the Actuals view.
              commit((est) => ({ ...est, awardedColumnId: e.target.checked ? columnId : undefined }))
            }
          />
          Mark as awarded bid
        </label>

        <div className="flex items-center border-t border-hairline pt-2.5">
          <button
            className="ml-auto rounded-md px-2 py-1 text-[12px] font-medium text-danger hover:bg-red-50 disabled:opacity-35"
            disabled={estimate.columns.length <= 1}
            title={estimate.columns.length <= 1 ? "An estimate needs at least one column" : undefined}
            onClick={() => {
              commit((e) => {
                const columns = e.columns.filter((c) => c.id !== columnId);
                // Drop the deleted column's cells so they don't linger.
                const cells = Object.fromEntries(
                  Object.entries(e.cells).filter(([k]) => !k.endsWith(`:${columnId}`))
                );
                const baselineColumnId =
                  e.baselineColumnId === columnId ? columns[0]?.id : e.baselineColumnId;
                const awardedColumnId = e.awardedColumnId === columnId ? undefined : e.awardedColumnId;
                const actualsSourceColumnId =
                  e.actualsSourceColumnId === columnId ? undefined : e.actualsSourceColumnId;
                return { ...e, columns, cells, baselineColumnId, awardedColumnId, actualsSourceColumnId };
              });
              onClose();
            }}
          >
            Delete column
          </button>
        </div>
      </div>
    </Popover>
  );
}
