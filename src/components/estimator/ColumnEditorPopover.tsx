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

const inputCls =
  "w-full rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";
const labelCls = "mb-1 block text-[10.5px] font-semibold tracking-[0.06em] text-ink-faint uppercase";

/** Add a scheme so a bare "drive.google.com/…" still opens as an absolute URL. */
function hrefOf(url: string): string {
  const u = url.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : `https://${u}`;
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
  const [markup, setMarkup] = useState(String(columnProp.markupPct ?? 0));
  const [contingency, setContingency] = useState(String(columnProp.contingencyPct ?? 0));
  const [notes, setNotes] = useState(columnProp.notes ?? "");
  const [links, setLinks] = useState<ColumnLink[]>(columnProp.links ?? []);

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

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Markup %</label>
            <input
              type="number"
              className={inputCls}
              value={markup}
              min={0}
              step="0.5"
              onChange={(e) => {
                setMarkup(e.target.value);
                update({ markupPct: Number(e.target.value) || 0 });
              }}
            />
          </div>
          <div>
            <label className={labelCls}>Contingency %</label>
            <input
              type="number"
              className={inputCls}
              value={contingency}
              min={0}
              step="0.5"
              onChange={(e) => {
                setContingency(e.target.value);
                update({ contingencyPct: Number(e.target.value) || 0 });
              }}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Links</label>
          <div className="flex flex-col gap-1.5">
            {links.map((l, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  className={`${inputCls} w-[88px] shrink-0`}
                  value={l.label}
                  placeholder="Label"
                  onChange={(e) => writeLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  className={`${inputCls} min-w-0 flex-1`}
                  value={l.url}
                  placeholder="https://… (treatment, bid, reel)"
                  inputMode="url"
                  onChange={(e) => writeLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                />
                {l.url.trim() && (
                  <a
                    href={hrefOf(l.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-1 text-[13px] text-ink-faint hover:text-ink"
                    title="Open link"
                  >
                    ↗
                  </a>
                )}
                <button
                  className="shrink-0 px-1 text-[13px] text-ink-faint hover:text-danger"
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
