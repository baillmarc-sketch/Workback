"use client";

import { useState } from "react";
import { downloadFile } from "@/lib/share";
import { buildEstimateCsv } from "@/lib/estimator/exportCsv";
import { useEstimate } from "@/state/estimateStore";
import Modal from "../Modal";
import type { ViewMode } from "./ViewToggle";

const btn =
  "rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:text-ink";

export default function EstimateExportDialog({ mode, onClose }: { mode: ViewMode; onClose: () => void }) {
  const { estimate } = useEstimate();
  const [copied, setCopied] = useState(false);
  if (!estimate) return null;

  const columns = estimate.columns.filter((c) =>
    mode === "all" ? true : mode === "versions" ? c.role === "version" : c.role === "vendor"
  );
  const csv = buildEstimateCsv(estimate, columns);
  const filename = `${(estimate.title || "estimate").replace(/[^\w-]+/g, "_")}.csv`;

  return (
    <Modal title="Export estimate" onClose={onClose} width={520}>
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-ink-soft">
          Exports the {columns.length} column{columns.length === 1 ? "" : "s"} currently shown
          {mode === "bids" ? " (vendor bids)" : mode === "versions" ? " (versions)" : ""}, with section
          subtotals, markup, contingency, totals, and deltas.
        </p>
        <pre className="max-h-60 overflow-auto rounded-md border border-hairline bg-paper p-2.5 text-[11px] leading-relaxed whitespace-pre">
          {csv}
        </pre>
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => downloadFile(filename, csv, "text/csv")}>
            Download CSV
          </button>
          <button
            className={btn}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(csv);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
          >
            {copied ? "Copied ✓" : "Copy to clipboard"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
