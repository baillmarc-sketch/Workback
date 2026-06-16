"use client";

import { uid } from "@/lib/types";
import type { Adjustment, AdjustmentType } from "@/lib/estimator/types";
import { useEstimate } from "@/state/estimateStore";
import Modal from "../Modal";

const input =
  "rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";

/**
 * Edit the estimate's below-the-line adjustments (markup, contingency,
 * insurance, sales tax, …). Each is a percent of the column subtotal or a flat
 * amount, applied to every column and rolled into the Total.
 */
export default function AdjustmentsDialog({ onClose }: { onClose: () => void }) {
  const { estimate, commit } = useEstimate();
  if (!estimate) return null;

  const set = (id: string, patch: Partial<Adjustment>) =>
    commit((e) => ({ ...e, adjustments: e.adjustments.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const add = () =>
    commit((e) => ({ ...e, adjustments: [...e.adjustments, { id: uid(), label: "New adjustment", type: "percent", value: 0 }] }));
  const remove = (id: string) => commit((e) => ({ ...e, adjustments: e.adjustments.filter((a) => a.id !== id) }));

  return (
    <Modal title="Adjustments" onClose={onClose} width={460}>
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-ink-soft">
          Applied to every column&apos;s Net Subtotal and rolled into the Total. Use percent for markup,
          contingency, insurance, and sales tax; flat for fixed fees.
        </p>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="flex-1 px-1 text-[10px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Label</span>
            <span className="w-24 px-1 text-[10px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Type</span>
            <span className="w-20 px-1 text-right text-[10px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Value</span>
            <span className="w-4" />
          </div>
          {estimate.adjustments.map((a) => (
            <div key={a.id} className="flex items-center gap-1.5">
              <input
                className={`${input} min-w-0 flex-1`}
                value={a.label}
                placeholder="Label"
                onChange={(e) => set(a.id, { label: e.target.value })}
              />
              <select
                className={`${input} w-24`}
                value={a.type}
                onChange={(e) => set(a.id, { type: e.target.value as AdjustmentType })}
              >
                <option value="percent">%</option>
                <option value="flat">Flat $</option>
              </select>
              <input
                type="number"
                className={`${input} w-20 text-right tabular-nums`}
                value={Number.isFinite(a.value) ? a.value : 0}
                step={a.type === "percent" ? "0.5" : "100"}
                onChange={(e) => set(a.id, { value: Number(e.target.value) || 0 })}
              />
              <button
                className="shrink-0 px-1 text-[13px] leading-none text-ink-faint hover:text-danger"
                title="Remove adjustment"
                onClick={() => remove(a.id)}
              >
                ×
              </button>
            </div>
          ))}
          {estimate.adjustments.length === 0 && (
            <div className="py-1 text-[12px] text-ink-faint">No adjustments — totals equal the net subtotal.</div>
          )}
        </div>

        <button className="self-start text-[12.5px] font-medium text-ink-soft hover:text-ink" onClick={add}>
          + Add adjustment
        </button>
      </div>
    </Modal>
  );
}
