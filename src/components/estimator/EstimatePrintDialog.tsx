"use client";

import { useRef } from "react";
import { useEstimate } from "@/state/estimateStore";
import Modal from "../Modal";
import type { PrintConfig } from "./EstimatePrintView";

/**
 * Configure and launch the client-ready PDF: pick which columns to present and
 * which sections to include, then "Save as PDF" opens the browser print dialog
 * (the print-only document renders portrait via globals.css).
 */
export default function EstimatePrintDialog({
  config,
  setConfig,
  onClose,
}: {
  config: PrintConfig;
  setConfig: (c: PrintConfig) => void;
  onClose: () => void;
}) {
  const { estimate, commit } = useEstimate();
  const fileRef = useRef<HTMLInputElement>(null);
  if (!estimate) return null;

  const setLogo = (logoUrl: string | undefined) => commit((e) => ({ ...e, logoUrl }));
  const onLogoFile = (file: File) => {
    if (file.size > 500_000) {
      alert("Logo is large (>500KB). Use a smaller image or paste a URL.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const toggleCol = (id: string) =>
    setConfig({
      ...config,
      columnIds: config.columnIds.includes(id)
        ? config.columnIds.filter((c) => c !== id)
        : [...config.columnIds, id],
    });

  const cb = "flex cursor-pointer items-center gap-1.5 text-[12.5px]";

  return (
    <Modal title="Export PDF" onClose={onClose} width={420}>
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            Columns to present
          </div>
          <div className="flex flex-col gap-1.5">
            {estimate.columns.map((c) => (
              <label key={c.id} className={cb}>
                <input type="checkbox" checked={config.columnIds.includes(c.id)} onChange={() => toggleCol(c.id)} />
                <span>
                  {c.name}
                  <span className="ml-1.5 text-[10.5px] text-ink-faint">
                    {c.id === estimate.awardedColumnId ? "awarded" : c.role === "vendor" ? "vendor" : "version"}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">Tip: present one column for a clean client estimate, or a few to show options.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={cb}>
            <input type="checkbox" checked={config.showInfo} onChange={(e) => setConfig({ ...config, showInfo: e.target.checked })} />
            Project information
          </label>
          <label className={cb}>
            <input
              type="checkbox"
              checked={config.showDeliverables}
              onChange={(e) => setConfig({ ...config, showDeliverables: e.target.checked })}
            />
            Deliverables
          </label>
          <label className={cb}>
            <input
              type="checkbox"
              checked={config.showAssumptions}
              onChange={(e) => setConfig({ ...config, showAssumptions: e.target.checked })}
            />
            Assumptions
          </label>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Logo</div>
          <div className="flex items-center gap-2">
            {estimate.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={estimate.logoUrl} alt="Logo" style={{ maxHeight: 32, maxWidth: 100, objectFit: "contain" }} className="rounded border border-hairline bg-paper p-0.5" />
            ) : (
              <span className="text-[12px] text-ink-faint">No logo</span>
            )}
            <button
              className="rounded-md border border-hairline bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:text-ink"
              onClick={() => fileRef.current?.click()}
            >
              Upload
            </button>
            {estimate.logoUrl && (
              <button
                className="px-1 text-[12px] font-medium text-ink-faint hover:text-danger"
                onClick={() => setLogo(undefined)}
              >
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onLogoFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <input
            className="mt-1.5 w-full rounded-md border border-hairline bg-paper px-2 py-1.5 text-[12px] outline-none focus:border-ink-faint"
            value={estimate.logoUrl?.startsWith("data:") ? "" : estimate.logoUrl ?? ""}
            placeholder="…or paste a logo image URL"
            onChange={(e) => setLogo(e.target.value || undefined)}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3">
          <button
            className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85 disabled:opacity-40"
            disabled={config.columnIds.length === 0}
            onClick={() => {
              onClose();
              // Let the dialog unmount so it isn't captured, then print.
              setTimeout(() => window.print(), 60);
            }}
          >
            Save as PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
