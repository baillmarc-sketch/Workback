"use client";

import { useState } from "react";
import { useBid } from "@/state/aicpStore";
import { CURRENCIES } from "@/lib/estimator/currencies";
import { uid } from "@/lib/types";
import type { Bid } from "@/lib/aicp/types";

/** Editable cover details: job-information fields (Client, Agency, Job #, …),
    currency, and the bid notes/assumptions that print on the cover. Collapsible
    so it stays out of the way while building the grid. */
export default function AicpDetailsPanel() {
  const { bid, patch } = useBid();
  const [open, setOpen] = useState(false);
  if (!bid) return null;

  const setField = (id: string, key: "label" | "value", v: string) =>
    patch((b: Bid) => ({ ...b, fields: b.fields.map((f) => (f.id === id ? { ...f, [key]: v } : f)) }));
  const addField = () => patch((b: Bid) => ({ ...b, fields: [...b.fields, { id: uid(), label: "", value: "" }] }));
  const removeField = (id: string) => patch((b: Bid) => ({ ...b, fields: b.fields.filter((f) => f.id !== id) }));

  const filled = bid.fields.filter((f) => f.value).length;

  return (
    <div className="mb-4 rounded-lg border border-hairline bg-paper">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-ink-faint">{open ? "▾" : "▸"}</span>
          <span className="font-display text-[13px] font-semibold">Cover &amp; job information</span>
        </span>
        <span className="text-[11px] text-ink-faint">
          {filled > 0 ? `${filled} field${filled === 1 ? "" : "s"} · ` : ""}
          {bid.currency}
        </span>
      </button>

      {open && (
        <div className="border-t border-hairline px-3 py-3">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {bid.fields.map((f) => (
              <div key={f.id} className="group flex items-center gap-1.5">
                <input
                  value={f.label}
                  onChange={(e) => setField(f.id, "label", e.target.value)}
                  placeholder="Label"
                  className="w-28 shrink-0 rounded-sm bg-surface px-1.5 py-1 text-[11.5px] font-medium text-ink-soft outline-none focus:ring-1 focus:ring-hairline-strong"
                  aria-label="Field label"
                />
                <input
                  value={f.value}
                  onChange={(e) => setField(f.id, "value", e.target.value)}
                  placeholder="…"
                  className="min-w-0 flex-1 rounded-sm bg-transparent px-1.5 py-1 text-[12px] outline-none focus:bg-surface focus:ring-1 focus:ring-hairline-strong"
                  aria-label="Field value"
                />
                <button
                  onClick={() => removeField(f.id)}
                  className="invisible shrink-0 text-[11px] text-ink-faint hover:text-danger group-hover:visible"
                  title="Remove field"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button onClick={addField} className="text-[11.5px] font-medium text-ink-faint hover:text-ink">
              + Add field
            </button>
            <label className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
              Currency
              <select
                value={bid.currency}
                onChange={(e) => patch((b) => ({ ...b, currency: e.target.value }))}
                className="rounded-md border border-hairline bg-surface px-1.5 py-0.5 text-[12px] outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Notes &amp; assumptions</div>
            <textarea
              value={bid.notes}
              onChange={(e) => patch((b) => ({ ...b, notes: e.target.value }))}
              placeholder="One assumption per line — these print on the cover."
              rows={3}
              className="w-full resize-y rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] outline-none placeholder:text-ink-faint focus:border-ink-faint"
            />
          </div>
        </div>
      )}
    </div>
  );
}
