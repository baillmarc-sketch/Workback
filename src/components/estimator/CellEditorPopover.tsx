"use client";

import { useEffect, useRef, useState } from "react";
import { isCoarsePointer } from "@/lib/device";
import { evalExpr } from "@/lib/estimator/formula";
import { formatCurrency } from "@/lib/estimator/format";
import { cellKey, type CellValue } from "@/lib/estimator/types";
import { useEstimate } from "@/state/estimateStore";
import Popover from "../Popover";

interface CellEditorPopoverProps {
  lineItemId: string;
  columnId: string;
  lineItemLabel: string;
  columnName: string;
  currency: string;
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
}

const inputCls =
  "w-full rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";

/**
 * Edits a single cost cell. You type arithmetic (e.g. "2*15000+500"); the
 * popover live-evaluates it and shows the dollar result. On commit it stores
 * both the raw expression and the computed value. The raw expression is saved
 * on close (blur/Escape) too, so a half-typed valid edit isn't lost.
 */
export default function CellEditorPopover({
  lineItemId,
  columnId,
  lineItemLabel,
  columnName,
  currency,
  anchor,
  onClose,
}: CellEditorPopoverProps) {
  const { estimate, commit } = useEstimate();
  const existing = estimate?.cells[cellKey(lineItemId, columnId)];
  const [expr, setExpr] = useState(existing?.expr ?? "");
  const result = evalExpr(expr);

  // Persist the latest valid expression when the popover unmounts, mirroring
  // the EventPopover auto-save-on-close pattern.
  const exprRef = useRef(expr);
  exprRef.current = expr;
  const save = (raw: string) => {
    const r = evalExpr(raw);
    if (!r.ok) return; // never store an unparseable expression
    commit((e) => {
      const key = cellKey(lineItemId, columnId);
      const cells = { ...e.cells };
      if (raw.trim() === "") {
        delete cells[key]; // blank clears the cell
      } else {
        const cell: CellValue = { expr: raw.trim(), value: r.value ?? 0 };
        cells[key] = cell;
      }
      return { ...e, cells };
    });
  };
  useEffect(() => {
    return () => save(exprRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Popover anchor={anchor} onClose={onClose} width={240}>
      <div className="flex flex-col gap-2 p-3">
        <div className="text-[11px] font-medium text-ink-faint">
          {lineItemLabel || "Line item"} · {columnName}
        </div>
        <input
          className={inputCls}
          value={expr}
          placeholder="0  (try 2*15000+500)"
          inputMode="text"
          autoFocus={!isCoarsePointer()}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onClose();
          }}
        />
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-ink-faint">{result.ok ? "=" : ""}</span>
          {result.ok ? (
            <span className="font-display text-[16px] font-semibold tabular-nums">
              {formatCurrency(result.value ?? 0, currency)}
            </span>
          ) : (
            <span className="text-[11.5px] text-danger">{result.error}</span>
          )}
        </div>
      </div>
    </Popover>
  );
}
