"use client";

import { useEffect, useRef, useState } from "react";
import { isCoarsePointer } from "@/lib/device";
import { evalExpr } from "@/lib/estimator/formula";
import { formatCurrency } from "@/lib/estimator/format";
import Popover from "../Popover";

interface CellEditorPopoverProps {
  /** Caption above the input, e.g. "Director · Premium" */
  title: string;
  initialExpr: string;
  currency: string;
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
  /** Called with the trimmed expression and its evaluated value on commit. An
      empty expression means "clear this cell". Only called for valid input. */
  onCommit: (expr: string, value: number) => void;
  /** Move to an adjacent cell for fast keyboard fill (Enter = down, Shift+Enter
      = up, Tab = right, Shift+Tab = left). The current value is committed on the
      resulting unmount. When omitted, Enter just closes. */
  onNavigate?: (dir: "down" | "up" | "left" | "right") => void;
}

const inputCls =
  "w-full rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";

/**
 * Edits one cost figure. You type arithmetic (e.g. "2*15000+500"); the popover
 * live-evaluates it and shows the dollar result, committing the raw expression
 * and computed value. The latest valid value is saved on close (blur/Escape)
 * too, so a typed-then-dismissed edit isn't lost. Reused for estimate cells and
 * for actuals (committed/spent).
 */
export default function CellEditorPopover({
  title,
  initialExpr,
  currency,
  anchor,
  onClose,
  onCommit,
  onNavigate,
}: CellEditorPopoverProps) {
  const [expr, setExpr] = useState(initialExpr);
  const result = evalExpr(expr);

  // Persist the latest valid expression when the popover unmounts.
  const exprRef = useRef(expr);
  exprRef.current = expr;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  useEffect(() => {
    return () => {
      const r = evalExpr(exprRef.current);
      if (r.ok) onCommitRef.current(exprRef.current.trim(), r.value ?? 0);
    };
  }, []);

  return (
    <Popover anchor={anchor} onClose={onClose} width={240}>
      <div className="flex flex-col gap-2 p-3">
        <div className="text-[11px] font-medium text-ink-faint">{title}</div>
        <input
          className={inputCls}
          value={expr}
          placeholder="0  (try 2*15000+500)"
          inputMode="text"
          autoFocus={!isCoarsePointer()}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (onNavigate) onNavigate(e.shiftKey ? "up" : "down");
              else onClose();
            } else if (e.key === "Tab" && onNavigate) {
              e.preventDefault();
              onNavigate(e.shiftKey ? "left" : "right");
            }
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
