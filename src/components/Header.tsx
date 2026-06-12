"use client";

import { useState } from "react";
import { useStore } from "@/state/store";
import AccountButton from "./AccountButton";

export default function Header({ onOpenProjects }: { onOpenProjects: () => void }) {
  const { project, commit } = useStore();
  const [notesOpen, setNotesOpen] = useState(false);
  if (!project) return null;

  return (
    <header className="no-print mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            className="w-full border-none bg-transparent font-display text-[28px] font-semibold tracking-tight outline-none placeholder:text-ink-faint"
            value={project.title}
            placeholder="Untitled Workback"
            aria-label="Project title"
            onChange={(e) => commit((p) => ({ ...p, title: e.target.value }))}
          />
          <input
            className="mt-0.5 w-full border-none bg-transparent text-[13px] text-ink-soft outline-none placeholder:text-ink-faint"
            value={project.subtitle}
            placeholder="Client / campaign / version — e.g. Acme x Brand / Workback v3"
            aria-label="Project subtitle"
            onChange={(e) => commit((p) => ({ ...p, subtitle: e.target.value }))}
          />
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <button
            className="mt-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink"
            onClick={onOpenProjects}
          >
            Projects
          </button>
          <AccountButton />
        </div>
      </div>

      <button
        className="mt-1 text-[11.5px] font-medium text-ink-faint hover:text-ink-soft"
        onClick={() => setNotesOpen((v) => !v)}
        aria-expanded={notesOpen}
      >
        {notesOpen ? "▾ Notes" : "▸ Notes"}
      </button>
      {notesOpen && (
        <textarea
          className="mt-1 w-full resize-y rounded-md border border-hairline bg-surface px-2.5 py-2 text-[13px] outline-none placeholder:text-ink-faint focus:border-ink-faint"
          rows={3}
          value={project.notes}
          placeholder="Project notes…"
          onChange={(e) => commit((p) => ({ ...p, notes: e.target.value }))}
        />
      )}
    </header>
  );
}
