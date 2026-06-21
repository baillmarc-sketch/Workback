"use client";

import { useRef } from "react";
import { useBid } from "@/state/aicpStore";
import Modal from "../Modal";
import type { PrintConfig, PrintTheme } from "./AicpPrintView";

/**
 * Configure and launch the printed AICP bid: classic vs modern layout, what to
 * include, auto-hide of unused lines/sections, and the cover logo. "Save as PDF"
 * opens the browser print dialog against the print-only document.
 */
export default function AicpPrintDialog({
  config,
  setConfig,
  onClose,
}: {
  config: PrintConfig;
  setConfig: (c: PrintConfig) => void;
  onClose: () => void;
}) {
  const { bid, commit } = useBid();
  const fileRef = useRef<HTMLInputElement>(null);
  if (!bid) return null;

  const setLogo = (logoUrl: string | undefined) => commit((b) => ({ ...b, logoUrl }));
  const onLogoFile = (file: File) => {
    if (file.size > 500_000) {
      alert("Logo is large (>500KB). Use a smaller image or paste a URL.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const cb = "flex cursor-pointer items-center gap-1.5 text-[12.5px]";
  const themeBtn = (t: PrintTheme, label: string, desc: string) => (
    <button
      onClick={() => setConfig({ ...config, theme: t })}
      className={`flex-1 rounded-md border px-3 py-2 text-left transition-colors ${
        config.theme === t ? "border-ink bg-ink/5" : "border-hairline hover:border-ink-faint"
      }`}
    >
      <div className="text-[12.5px] font-semibold">{label}</div>
      <div className="text-[11px] text-ink-faint">{desc}</div>
    </button>
  );

  return (
    <Modal title="Print / Export PDF" onClose={onClose} width={440}>
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Layout</div>
          <div className="flex gap-2">
            {themeBtn("classic", "Classic AICP", "The familiar AICP bid-form look")}
            {themeBtn("modern", "Modern", "Cleaner, lighter typeset")}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Include</div>
          <div className="flex flex-col gap-1.5">
            <label className={cb}>
              <input type="checkbox" checked={config.hideUnused} onChange={(e) => setConfig({ ...config, hideUnused: e.target.checked })} />
              Hide unused lines &amp; empty sections
            </label>
            <label className={cb}>
              <input type="checkbox" checked={config.showJobInfo} onChange={(e) => setConfig({ ...config, showJobInfo: e.target.checked })} />
              Job information
            </label>
            <label className={cb}>
              <input type="checkbox" checked={config.showSummary} onChange={(e) => setConfig({ ...config, showSummary: e.target.checked })} />
              Summary recap (cover)
            </label>
            <label className={cb}>
              <input type="checkbox" checked={config.showDetail} onChange={(e) => setConfig({ ...config, showDetail: e.target.checked })} />
              Category detail pages
            </label>
            <label className={cb}>
              <input type="checkbox" checked={config.showActual} onChange={(e) => setConfig({ ...config, showActual: e.target.checked })} />
              Actual column
            </label>
            <label className={cb}>
              <input type="checkbox" checked={config.showNotes} onChange={(e) => setConfig({ ...config, showNotes: e.target.checked })} />
              Notes &amp; assumptions
            </label>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Logo</div>
          <div className="flex items-center gap-2">
            {bid.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bid.logoUrl} alt="Logo" style={{ maxHeight: 32, maxWidth: 100, objectFit: "contain" }} className="rounded border border-hairline bg-paper p-0.5" />
            ) : (
              <span className="text-[12px] text-ink-faint">No logo</span>
            )}
            <button
              className="rounded-md border border-hairline bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:text-ink"
              onClick={() => fileRef.current?.click()}
            >
              Upload
            </button>
            {bid.logoUrl && (
              <button className="px-1 text-[12px] font-medium text-ink-faint hover:text-danger" onClick={() => setLogo(undefined)}>
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
            value={bid.logoUrl?.startsWith("data:") ? "" : bid.logoUrl ?? ""}
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
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            onClick={() => {
              onClose();
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
