"use client";

export type ViewMode = "all" | "versions" | "leveling" | "actuals";

const MODES: { id: ViewMode; label: string; title: string }[] = [
  { id: "all", label: "All", title: "Show every column" },
  { id: "versions", label: "Versions", title: "Show only your internal version columns" },
  { id: "leveling", label: "Triple Bid", title: "Compare vendor bids against your estimate and award one" },
  { id: "actuals", label: "Actuals", title: "Track estimate vs committed, actual, and remaining" },
];

export default function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-hairline" role="group" aria-label="View mode">
      {MODES.map((m) => (
        <button
          key={m.id}
          aria-pressed={mode === m.id}
          title={m.title}
          className={`px-2.5 py-1.5 text-[12px] font-medium ${
            mode === m.id ? "bg-ink text-paper" : "bg-surface text-ink-soft hover:text-ink"
          }`}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
