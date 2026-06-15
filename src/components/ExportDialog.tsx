"use client";

import { useMemo, useState } from "react";
import { exportDateList, exportWeekOverview } from "@/lib/exportText";
import { useStore } from "@/state/store";
import Modal from "./Modal";

type Mode = "list" | "week";

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const { project } = useStore();
  const [mode, setMode] = useState<Mode>("list");
  const [copied, setCopied] = useState(false);

  const list = useMemo(() => (project ? exportDateList(project) : { plain: "", html: "" }), [project]);
  const week = useMemo(() => (project ? exportWeekOverview(project) : { plain: "", html: "" }), [project]);

  if (!project) return null;
  const result = mode === "list" ? list : week;

  const handleCopy = async () => {
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([result.plain], { type: "text/plain" }),
            "text/html": new Blob([result.html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(result.plain);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — preview remains select-text
    }
  };

  return (
    <Modal title="Export" onClose={onClose} width={560}>
      <div className="flex flex-col gap-3">
        <div className="flex overflow-hidden rounded-md border border-hairline self-start" role="group" aria-label="Export type">
          {(
            [
              ["list", "List by date"],
              ["week", "Week overview"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              aria-pressed={mode === m}
              className={`px-2.5 py-1.5 text-[12px] font-medium ${
                mode === m ? "bg-ink text-paper" : "bg-surface text-ink-soft hover:text-ink"
              }`}
              onClick={() => setMode(m)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className="max-h-[50vh] min-h-[120px] overflow-y-auto rounded-md border border-hairline bg-paper p-3 text-[13px] leading-relaxed select-text whitespace-pre-line"
          dangerouslySetInnerHTML={{ __html: result.html || "Nothing to export yet." }}
        />

        <div className="flex items-center gap-2">
          <button
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            onClick={handleCopy}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button
            className="rounded-md border border-hairline px-3 py-1.5 text-[12.5px] font-medium hover:bg-paper"
            onClick={() => window.print()}
          >
            Print / PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
