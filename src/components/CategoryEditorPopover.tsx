"use client";

import { useRef, useState } from "react";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import type { ProjectCategory } from "@/lib/types";
import { useStore } from "@/state/store";
import Popover from "./Popover";

interface CategoryEditorPopoverProps {
  category: ProjectCategory;
  anchor: { left: number; top: number; right: number; bottom: number };
  onClose: () => void;
}

/** Rename / recolor / delete a project label, opened from a legend chip */
export default function CategoryEditorPopover({ category, anchor, onClose }: CategoryEditorPopoverProps) {
  const { project, commit } = useStore();
  const [label, setLabel] = useState(category.label);
  const [color, setColor] = useState(category.color);
  // One undo entry per edit session: save on close, not per keystroke
  const savedRef = useRef(false);

  const save = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    const finalLabel = label.trim() || category.label;
    if (finalLabel === category.label && color === category.color) return;
    commit((p) => ({
      ...p,
      categories: p.categories.map((c) =>
        c.id === category.id ? { ...c, label: finalLabel, color } : c
      ),
    }));
  };

  const close = () => {
    save();
    onClose();
  };

  const usedBy = project?.events.filter((e) => e.category === category.id).length ?? 0;
  const isLast = (project?.categories.length ?? 0) <= 1;

  const remove = () => {
    if (
      usedBy > 0 &&
      !confirm(`“${category.label}” is used by ${usedBy} event${usedBy === 1 ? "" : "s"}. They'll move to the first remaining label.`)
    ) {
      return;
    }
    savedRef.current = true; // deleting — discard pending rename
    commit((p) => {
      const remaining = p.categories.filter((c) => c.id !== category.id);
      const fallback = remaining[0].id;
      return {
        ...p,
        categories: remaining,
        events: p.events.map((e) => (e.category === category.id ? { ...e, category: fallback } : e)),
      };
    });
    onClose();
  };

  return (
    <Popover anchor={anchor} onClose={close} width={248}>
      <div className="flex flex-col gap-2.5 p-3.5">
        <input
          className="w-full border-none bg-transparent text-[14px] font-semibold outline-none placeholder:text-ink-faint"
          value={label}
          placeholder="Label name"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && close()}
        />

        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-8 w-10 cursor-pointer rounded-md border border-hairline bg-paper p-0.5"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Label color"
          />
          <span className="text-[11.5px] text-ink-soft uppercase tracking-wide">{color}</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {DEFAULT_CATEGORIES.map((c) => (
            <button
              key={c.id}
              title={c.label}
              aria-label={`Use ${c.label} color`}
              className="h-5 w-5 rounded-[5px] transition-transform hover:scale-110"
              style={{
                background: c.color,
                boxShadow: color.toLowerCase() === c.color.toLowerCase() ? "0 0 0 2px var(--color-ink)" : undefined,
              }}
              onClick={() => setColor(c.color)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-hairline pt-2.5">
          <button
            className="rounded-md px-2 py-1 text-[12px] font-medium text-danger hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent"
            disabled={isLast}
            title={isLast ? "Projects need at least one label" : undefined}
            onClick={remove}
          >
            Delete
          </button>
          <button
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            onClick={close}
          >
            Done
          </button>
        </div>
      </div>
    </Popover>
  );
}
