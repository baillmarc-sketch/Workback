"use client";

import { useState } from "react";
import { evalOrZero } from "@/lib/estimator/formula";
import { formatCurrency } from "@/lib/estimator/format";
import type { LedgerEntry, LedgerKind } from "@/lib/estimator/types";
import { uid } from "@/lib/types";
import { useEstimate } from "@/state/estimateStore";
import Popover from "../Popover";

interface LedgerPopoverProps {
  lineItemId: string;
  kind: LedgerKind;
  lineItemLabel: string;
  currency: string;
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
}

/** A local, editable row. `amountText` allows arithmetic (e.g. "3*8000"); the
    numeric value is evaluated from it. */
interface Row {
  id: string;
  amountText: string;
  ref: string;
  vendor: string;
  date: string;
}

const inputCls =
  "rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";

function toRows(entries: LedgerEntry[]): Row[] {
  return entries.map((e) => ({
    id: e.id,
    amountText: e.amount ? String(e.amount) : "",
    ref: e.ref ?? "",
    vendor: e.vendor ?? "",
    date: e.date ?? "",
  }));
}

/**
 * Edits the PO (or invoice) ledger for one line item. Committed / Actual on the
 * grid are the sum of these entries. Rows are kept in local state so inputs
 * never lag the store; every change writes the cleaned set back via commit.
 */
export default function LedgerPopover({ lineItemId, kind, lineItemLabel, currency, anchor, onClose }: LedgerPopoverProps) {
  const { estimate, commit } = useEstimate();
  const [rows, setRows] = useState<Row[]>(() => {
    const existing = toRows((estimate?.ledger ?? []).filter((x) => x.lineItemId === lineItemId && x.kind === kind));
    // Open ready to type: an empty cell starts with one blank row focused.
    return existing.length ? existing : [{ id: uid(), amountText: "", ref: "", vendor: "", date: "" }];
  });

  const noun = kind === "po" ? "PO" : "Invoice";

  const writeRows = (next: Row[]) => {
    setRows(next);
    commit((e) => {
      const others = e.ledger.filter((x) => !(x.lineItemId === lineItemId && x.kind === kind));
      const mine: LedgerEntry[] = next
        .filter((r) => r.amountText.trim() !== "" || r.ref.trim() || r.vendor.trim() || r.date)
        .map((r) => ({
          id: r.id,
          lineItemId,
          kind,
          amount: evalOrZero(r.amountText),
          ref: r.ref.trim() || undefined,
          vendor: r.vendor.trim() || undefined,
          date: r.date || undefined,
        }));
      return { ...e, ledger: [...others, ...mine] };
    });
  };

  const update = (id: string, patch: Partial<Row>) =>
    writeRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const total = rows.reduce((sum, r) => sum + evalOrZero(r.amountText), 0);

  return (
    <Popover anchor={anchor} onClose={onClose} width={320}>
      <div className="flex max-h-[80vh] flex-col gap-2.5 overflow-y-auto p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            {noun}s · {lineItemLabel || "Line item"}
          </span>
          <span className="font-display text-[14px] font-semibold tabular-nums">{formatCurrency(total, currency)}</span>
        </div>

        {rows.length === 0 && (
          <div className="py-1 text-[12px] text-ink-faint">No {noun.toLowerCase()}s yet.</div>
        )}

        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-1 rounded-md border border-hairline p-2">
            <div className="flex items-center gap-1.5">
              <input
                className={`${inputCls} w-24 text-right tabular-nums`}
                value={r.amountText}
                placeholder="0"
                inputMode="text"
                autoFocus
                onChange={(e) => update(r.id, { amountText: e.target.value })}
              />
              <input
                className={`${inputCls} min-w-0 flex-1`}
                value={r.ref}
                placeholder={`${noun} #`}
                onChange={(e) => update(r.id, { ref: e.target.value })}
              />
              <button
                className="shrink-0 px-1 text-[13px] text-ink-faint hover:text-danger"
                title={`Remove ${noun.toLowerCase()}`}
                onClick={() => writeRows(rows.filter((x) => x.id !== r.id))}
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                className={`${inputCls} min-w-0 flex-1`}
                value={r.vendor}
                placeholder="Vendor"
                onChange={(e) => update(r.id, { vendor: e.target.value })}
              />
              <input
                type="date"
                className={`${inputCls} w-[130px]`}
                value={r.date}
                onChange={(e) => update(r.id, { date: e.target.value })}
              />
            </div>
          </div>
        ))}

        <button
          className="self-start text-[12px] font-medium text-ink-soft hover:text-ink"
          onClick={() => writeRows([...rows, { id: uid(), amountText: "", ref: "", vendor: "", date: "" }])}
        >
          + Add {noun.toLowerCase()}
        </button>
      </div>
    </Popover>
  );
}
