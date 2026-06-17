"use client";

import { useState } from "react";
import { checklistToCsv, specToText } from "@/lib/bidSpecs/export";
import { useBidSpec } from "@/state/bidSpecsStore";
import Modal from "../Modal";

function download(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BidSpecsExportDialog({ onClose }: { onClose: () => void }) {
  const { spec } = useBidSpec();
  const [copied, setCopied] = useState(false);
  if (!spec) return null;

  const text = specToText(spec);
  const slug = (spec.title || "bid-specs").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bid-specs";

  return (
    <Modal title="Export" onClose={onClose} width={520}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            onClick={() => {
              navigator.clipboard.writeText(text).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                },
                () => {}
              );
            }}
          >
            {copied ? "Copied ✓" : "Copy as text"}
          </button>
          <button
            className="rounded-md border border-hairline px-3 py-1.5 text-[12.5px] font-medium hover:bg-paper"
            onClick={() => download(`${slug}.md`, "text/markdown", text)}
          >
            Download .md
          </button>
          <button
            className="rounded-md border border-hairline px-3 py-1.5 text-[12.5px] font-medium hover:bg-paper"
            onClick={() => download(`${slug}-provided-by.csv`, "text/csv", checklistToCsv(spec))}
          >
            Checklist .csv
          </button>
        </div>
        <textarea
          readOnly
          className="h-64 w-full resize-none rounded-md border border-hairline bg-paper px-2.5 py-2 font-mono text-[11.5px] leading-snug text-ink-soft outline-none"
          value={text}
        />
        <p className="text-[11px] text-ink-faint">For a formatted PDF, use Print / PDF instead.</p>
      </div>
    </Modal>
  );
}
