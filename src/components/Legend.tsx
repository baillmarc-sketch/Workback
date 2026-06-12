"use client";

import { useState } from "react";
import { DEFAULT_CATEGORIES, PLACEHOLDER_COLOR, newCategoryId } from "@/lib/categories";
import type { ProjectCategory, WorkbackEvent } from "@/lib/types";
import { useStore } from "@/state/store";
import CategoryEditorPopover from "./CategoryEditorPopover";

interface LegendProps {
  categories: ProjectCategory[];
  /** When set, only labels actually used by these events are shown (print/export) */
  events?: WorkbackEvent[];
  /** Chips open the label editor and an add button appears (on-screen legend) */
  editable?: boolean;
  className?: string;
}

export default function Legend({ categories, events, editable, className = "" }: LegendProps) {
  const { commit } = useStore();
  const [editing, setEditing] = useState<{
    id: string;
    anchor: { left: number; top: number; right: number; bottom: number };
  } | null>(null);

  const used = events ? new Set(events.map((e) => e.category)) : null;
  const cats = used ? categories.filter((c) => used.has(c.id)) : categories;
  if (cats.length === 0 && !editable) return null;

  const addLabel = (rect: DOMRect) => {
    const id = newCategoryId("New label", categories);
    const inUse = new Set(categories.map((c) => c.color.toLowerCase()));
    const color =
      DEFAULT_CATEGORIES.map((c) => c.color).find((c) => !inUse.has(c.toLowerCase())) ??
      PLACEHOLDER_COLOR;
    commit((p) => ({ ...p, categories: [...p.categories, { id, label: "New label", color }] }));
    setEditing({ id, anchor: rect });
  };

  const editingCat = editing ? categories.find((c) => c.id === editing.id) : null;

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {cats.map((c) =>
        editable ? (
          <button
            key={c.id}
            className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11.5px] text-ink-soft hover:bg-paper hover:text-ink"
            title="Edit label"
            onClick={(e) =>
              setEditing({ id: c.id, anchor: (e.currentTarget as HTMLElement).getBoundingClientRect() })
            }
          >
            <span className="cat-dot h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
            {c.label}
          </button>
        ) : (
          <span key={c.id} className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
            <span className="cat-dot h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
            {c.label}
          </span>
        )
      )}

      {editable && (
        <button
          className="rounded-md px-1 py-0.5 text-[11.5px] font-medium text-ink-faint hover:bg-paper hover:text-ink"
          onClick={(e) => addLabel((e.currentTarget as HTMLElement).getBoundingClientRect())}
        >
          + Add label
        </button>
      )}

      {editable && editingCat && editing && (
        <CategoryEditorPopover
          category={editingCat}
          anchor={editing.anchor}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
