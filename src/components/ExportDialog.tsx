"use client";

import { useMemo, useState } from "react";
import { exportCsv, exportDateList, exportWeekOverview } from "@/lib/exportText";
import { buildGantt } from "@/lib/exportGantt";
import { exportIcs } from "@/lib/ical";
import { downloadFile } from "@/lib/share";
import { useStore } from "@/state/store";
import Modal from "./Modal";

type Mode = "list" | "week" | "gantt" | "sheet" | "ics";

function safeName(title: string): string {
  return title.replace(/[^\w\- ]+/g, "").trim() || "workback";
}

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const { project } = useStore();
  const [mode, setMode] = useState<Mode>("list");
  const [copied, setCopied] = useState(false);

  const list = useMemo(() => (project ? exportDateList(project) : { plain: "", html: "" }), [project]);
  const week = useMemo(() => (project ? exportWeekOverview(project) : { plain: "", html: "" }), [project]);
  const gantt = useMemo(() => (project ? buildGantt(project) : null), [project]);
  const csv = useMemo(() => (project ? exportCsv(project) : ""), [project]);
  const ics = useMemo(() => (project ? exportIcs(project) : ""), [project]);

  if (!project) return null;
  const text = mode === "list" ? list : week;

  const copyText = async () => {
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text.plain], { type: "text/plain" }),
            "text/html": new Blob([text.html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text.plain);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — preview stays select-text
    }
  };

  const downloadPng = () => {
    if (!gantt) return;
    const scale = 2;
    const blob = new Blob([gantt.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = gantt.width * scale;
      canvas.height = gantt.height * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((png) => {
          if (!png) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(png);
          a.download = `${safeName(project.title)}-gantt.png`;
          a.click();
          URL.revokeObjectURL(a.href);
        }, "image/png");
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const tabs: [Mode, string][] = [
    ["list", "List by date"],
    ["week", "Week overview"],
    ["gantt", "Gantt"],
    ["sheet", "Spreadsheet"],
    ["ics", "Calendar (.ics)"],
  ];

  return (
    <Modal title="Export" onClose={onClose} width={620}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap overflow-hidden rounded-md border border-hairline self-start" role="group" aria-label="Export type">
          {tabs.map(([m, label]) => (
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

        {(mode === "list" || mode === "week") && (
          <>
            <div
              className="max-h-[50vh] min-h-[120px] overflow-y-auto rounded-md border border-hairline bg-paper p-3 text-[13px] leading-relaxed select-text whitespace-pre-line"
              dangerouslySetInnerHTML={{ __html: text.html || "Nothing to export yet." }}
            />
            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
                onClick={copyText}
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <span className="text-[11.5px] text-ink-faint">Pastes with formatting into email or Teams.</span>
            </div>
          </>
        )}

        {mode === "gantt" && gantt && (
          <>
            <div
              className="max-h-[50vh] overflow-auto rounded-md border border-hairline bg-paper p-2"
              dangerouslySetInnerHTML={{ __html: gantt.svg }}
            />
            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
                onClick={downloadPng}
              >
                Download PNG
              </button>
              <span className="text-[11.5px] text-ink-faint">Drop the image into slides or a Teams message.</span>
            </div>
          </>
        )}

        {mode === "sheet" && (
          <>
            <div className="max-h-[50vh] overflow-auto rounded-md border border-hairline bg-paper p-3 font-mono text-[11.5px] leading-relaxed select-text whitespace-pre">
              {csv || "Nothing to export yet."}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
                onClick={() => downloadFile(`${safeName(project.title)}.csv`, csv, "text/csv")}
              >
                Download CSV
              </button>
              <span className="text-[11.5px] text-ink-faint">Opens in Excel or Google Sheets.</span>
            </div>
          </>
        )}

        {mode === "ics" && (
          <>
            <div className="max-h-[50vh] overflow-auto rounded-md border border-hairline bg-paper p-3 font-mono text-[11.5px] leading-relaxed select-text whitespace-pre">
              {ics}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
                onClick={() => downloadFile(`${safeName(project.title)}.ics`, ics, "text/calendar")}
              >
                Download .ics
              </button>
              <span className="text-[11.5px] text-ink-faint">
                Import into Outlook, Google, or Apple Calendar. (Import an .ics from the Share menu.)
              </span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
