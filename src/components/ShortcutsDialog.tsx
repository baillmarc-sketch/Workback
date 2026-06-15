"use client";

import Modal from "./Modal";

const groups: { heading: string; rows: { keys: string[]; label: string }[] }[] = [
  {
    heading: "Creating events",
    rows: [
      { keys: ["Click a day"], label: "Open the new-event popover" },
      { keys: ["Enter"], label: "Start a new event on the next workday (weekends skipped)" },
      { keys: ["Enter"], label: "Add the event (inside the popover)" },
      { keys: ["Esc"], label: "Discard the new event (inside the popover)" },
      { keys: ["Click away"], label: "Auto-saves the new event if it has a title" },
    ],
  },
  {
    heading: "Editing & moving",
    rows: [
      { keys: ["Drag"], label: "Move an event" },
      { keys: ["Shift", "Drag"], label: "Move it and everything downstream" },
      { keys: ["⌘C", "/", "Ctrl+C"], label: "Copy the selected event" },
      { keys: ["⌘V", "/", "Ctrl+V"], label: "Paste onto the day under the cursor" },
      { keys: ["Delete", "/", "Backspace"], label: "Delete the selected event" },
      { keys: ["Esc"], label: "Deselect" },
    ],
  },
  {
    heading: "History",
    rows: [
      { keys: ["⌘Z", "/", "Ctrl+Z"], label: "Undo" },
      { keys: ["⇧⌘Z", "/", "Ctrl+Shift+Z"], label: "Redo" },
    ],
  },
  {
    heading: "Help",
    rows: [{ keys: ["?"], label: "Open this shortcuts list" }],
  },
];

function Key({ k }: { k: string }) {
  if (k === "/") return <span className="text-ink-faint">/</span>;
  if (k === "Drag" || k === "Click a day" || k === "Click away")
    return <span className="text-ink-soft">{k}</span>;
  return (
    <kbd className="rounded border border-hairline bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink">
      {k}
    </kbd>
  );
}

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width={480}>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <section key={g.heading}>
            <h4 className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
              {g.heading}
            </h4>
            <div className="flex flex-col gap-1.5">
              {g.rows.map((r, i) => (
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
        ))}
      </div>
    </Modal>
  );
}
