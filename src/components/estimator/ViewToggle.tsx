"use client";

export type ViewMode = "all" | "versions" | "bids";

const MODES: { id: ViewMode; label: string; title: string }[] = [
  { id: "all", label: "All", title: "Show every column" },
  { id: "versions", label: "Versions", title: "Show only your internal version columns" },
  { id: "bids", label: "Triple bid", title: "Compare vendor bid columns side by side" },
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
