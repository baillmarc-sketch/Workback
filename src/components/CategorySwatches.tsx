"use client";

import { useState } from "react";
import type { ProjectCategory } from "@/lib/types";

interface CategorySwatchesProps {
  categories: ProjectCategory[];
  value: string;
  onChange: (id: string) => void;
}

/** The shared color-swatch picker used to set an event's category. A label
    tag below updates instantly on hover (no slow native tooltip) and reflects
    the current selection otherwise. */
export default function CategorySwatches({ categories, value, onChange }: CategorySwatchesProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const shown = categories.find((c) => c.id === (hovered ?? value));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {categories.map((c) => (
          <button
            key={c.id}
            aria-label={c.label}
            aria-pressed={value === c.id}
            className="flex h-6 w-6 items-center justify-center rounded-md transition-transform hover:scale-110"
            style={{
              background: `color-mix(in srgb, ${c.color} 18%, white)`,
              boxShadow: value === c.id ? `0 0 0 2px ${c.color}` : undefined,
            }}
            onMouseEnter={() => setHovered(c.id)}
            onMouseLeave={() => setHovered((h) => (h === c.id ? null : h))}
            onClick={() => onChange(c.id)}
          >
            <span className="h-3 w-3 rounded-[4px]" style={{ background: c.color }} />
          </button>
        ))}
      </div>
      <div className="h-4 text-left text-[11.5px] text-ink-soft">{shown?.label ?? ""}</div>
    </div>
  );
}
