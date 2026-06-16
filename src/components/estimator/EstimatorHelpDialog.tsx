"use client";

import Modal from "../Modal";

function Key({ k }: { k: string }) {
  if (k === "/") return <span className="text-ink-faint">/</span>;
  if (k.startsWith("Click") || k === "Type a digit" || k === "Hover")
    return <span className="text-ink-soft">{k}</span>;
  return (
    <kbd className="rounded border border-hairline bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink">{k}</kbd>
  );
}

const shortcuts: { keys: string[]; label: string }[] = [
  { keys: ["Click"], label: "Click a cell and start typing immediately" },
  { keys: ["Enter"], label: "Save + move down (Shift+Enter = up)" },
  { keys: ["Tab"], label: "Move right (Shift+Tab = left)" },
  { keys: ["↑", "↓", "←", "→"], label: "Move the selected cell (when not editing)" },
  { keys: ["Type a digit"], label: "Start editing a selected cell" },
  { keys: ["Delete", "/", "Backspace"], label: "Clear the selected cell" },
  { keys: ["Esc"], label: "Stop editing" },
  { keys: ["⌘Z", "/", "Ctrl+Z"], label: "Undo (⇧⌘Z to redo)" },
  { keys: ["?"], label: "Open this help" },
];

const concepts: { heading: string; rows: { term: string; desc: string }[] }[] = [
  {
    heading: "Views",
    rows: [
      { term: "All", desc: "Every column — your versions and vendor bids together." },
      { term: "Versions", desc: "Just your internal scenario columns." },
      { term: "Triple Bid", desc: "Your estimate baseline beside vendor bids, with per-line and total variance; mark one Awarded." },
      { term: "Actuals", desc: "Estimate → Committed (POs) → Actual (invoices) → Outstanding → Remaining; click a cell to log POs/invoices." },
    ],
  },
  {
    heading: "Cells & math",
    rows: [
      { term: "Math", desc: "Type arithmetic: 2*15000+500, with ( )." },
      { term: "Percent", desc: "15000*10% = 1,500; 15000+10% = 16,500 (adds 10%); 15000-10% = 13,500." },
      { term: "Ranges", desc: 'In a "Range" column, type "10000-15000" for a low–high ballpark.' },
    ],
  },
  {
    heading: "Columns (click a header)",
    rows: [
      { term: "Version / Vendor", desc: "Tag a column as your scenario or a vendor's bid." },
      { term: "★ Baseline", desc: "The column deltas compare against." },
      { term: "✓ Awarded", desc: "The chosen vendor; feeds the Actuals estimate." },
      { term: "↔ Range", desc: "Cells hold a low–high ballpark." },
      { term: "🔗 Notes / links", desc: "Attach the treatment, full bid, reel, and notes." },
    ],
  },
  {
    heading: "Totals & lines",
    rows: [
      { term: "Adjustments", desc: "Markup, contingency, insurance %, sales tax — applied to every column's Net Subtotal → Total." },
      { term: "🗒 Line notes", desc: "Internal comment per line (not shown in the client PDF)." },
    ],
  },
  {
    heading: "Saving & sharing",
    rows: [
      { term: "saved / syncing / offline", desc: "The dot shows cloud-sync status; everything also saves locally." },
      { term: "Share", desc: "Copies a link; anyone with it sees live edits." },
      { term: "Export / Print", desc: "CSV for spreadsheets, or a client-ready PDF." },
    ],
  },
];

export default function EstimatorHelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How the Estimator works" onClose={onClose} width={520}>
      <div className="flex flex-col gap-5">
        <section>
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Hotkeys</h4>
          <div className="flex flex-col gap-1.5">
            {shortcuts.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink-soft">{r.label}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {r.keys.map((k, j) => (
                    <Key key={j} k={k} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>

        {concepts.map((g) => (
          <section key={g.heading}>
            <h4 className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">{g.heading}</h4>
            <div className="flex flex-col gap-1.5">
              {g.rows.map((r, i) => (
                <div key={i} className="flex items-baseline gap-2">
                  <span className="w-32 shrink-0 text-[12.5px] font-medium text-ink">{r.term}</span>
                  <span className="flex-1 text-[12.5px] text-ink-soft">{r.desc}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
