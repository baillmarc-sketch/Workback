"use client";

import { isCoarsePointer } from "@/lib/device";
import type { ColumnRole, EstimateColumn } from "@/lib/estimator/types";
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

export default function ColumnEditorPopover({ column, anchor, onClose }: ColumnEditorPopoverProps) {
  const { estimate, commit, patch } = useEstimate();
  if (!estimate) return null;
  const isBaseline = estimate.baselineColumnId === column.id;

  const update = (changes: Partial<EstimateColumn>) =>
    commit((e) => ({
      ...e,
      columns: e.columns.map((c) => (c.id === column.id ? { ...c, ...changes } : c)),
    }));

  return (
    <Popover anchor={anchor} onClose={onClose} width={280}>
      <div className="flex flex-col gap-3 p-3.5">
        <input
          className="w-full border-none bg-transparent text-[15px] font-semibold outline-none placeholder:text-ink-faint"
          value={column.name}
          placeholder="Column name"
          autoFocus={!isCoarsePointer()}
          onChange={(e) => update({ name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onClose()}
        />

        <div>
          <label className={labelCls}>Type</label>
          <div className="flex overflow-hidden rounded-md border border-hairline" role="group" aria-label="Column type">
            {(["version", "vendor"] as ColumnRole[]).map((role) => (
              <button
                key={role}
                aria-pressed={column.role === role}
                className={`flex-1 px-2.5 py-1.5 text-[12px] font-medium capitalize ${
                  column.role === role ? "bg-ink text-paper" : "bg-surface text-ink-soft hover:text-ink"
                }`}
                onClick={() => update({ role })}
              >
                {role === "version" ? "Version" : "Vendor bid"}
              </button>
            ))}
          </div>
        </div>

        {column.role === "vendor" && (
          <div>
            <label className={labelCls}>Company</label>
            <input
              className={inputCls}
              value={column.vendor ?? ""}
              placeholder="Production company name"
              onChange={(e) => update({ vendor: e.target.value || undefined })}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Markup %</label>
            <input
              type="number"
              className={inputCls}
              value={Number.isFinite(column.markupPct) ? column.markupPct : 0}
              min={0}
              step="0.5"
              onChange={(e) => update({ markupPct: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className={labelCls}>Contingency %</label>
            <input
              type="number"
              className={inputCls}
              value={Number.isFinite(column.contingencyPct) ? column.contingencyPct : 0}
              min={0}
              step="0.5"
              onChange={(e) => update({ contingencyPct: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={isBaseline}
            onChange={(e) =>
              // Baseline is a view setting (it drives the delta row), so patch
              // rather than commit — no need to clutter undo history.
              patch((est) => ({ ...est, baselineColumnId: e.target.checked ? column.id : undefined }))
            }
          />
          Use as baseline for deltas
        </label>

        <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={estimate.awardedColumnId === column.id}
            onChange={(e) =>
              // Awarding is a real decision — commit it. It also becomes the
              // default Estimate source in the Actuals view.
              commit((est) => ({ ...est, awardedColumnId: e.target.checked ? column.id : undefined }))
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
                const columns = e.columns.filter((c) => c.id !== column.id);
                // Drop the deleted column's cells so they don't linger.
                const cells = Object.fromEntries(
                  Object.entries(e.cells).filter(([k]) => !k.endsWith(`:${column.id}`))
                );
                const baselineColumnId =
                  e.baselineColumnId === column.id ? columns[0]?.id : e.baselineColumnId;
                const awardedColumnId = e.awardedColumnId === column.id ? undefined : e.awardedColumnId;
                const actualsSourceColumnId =
                  e.actualsSourceColumnId === column.id ? undefined : e.actualsSourceColumnId;
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
