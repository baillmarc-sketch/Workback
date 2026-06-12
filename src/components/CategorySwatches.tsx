"use client";

import type { ProjectCategory } from "@/lib/types";

interface CategorySwatchesProps {
  categories: ProjectCategory[];
  value: string;
  onChange: (id: string) => void;
}

/** The shared color-swatch picker used to set an event's category */
export default function CategorySwatches({ categories, value, onChange }: CategorySwatchesProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((c) => (
        <button
          key={c.id}
          title={c.label}
          aria-label={c.label}
          aria-pressed={value === c.id}
          className="flex h-6 w-6 items-center justify-center rounded-md transition-transform hover:scale-110"
          style={{
            background: `color-mix(in srgb, ${c.color} 18%, white)`,
            boxShadow: value === c.id ? `0 0 0 2px ${c.color}` : undefined,
          }}
          onClick={() => onChange(c.id)}
        >
          <span className="h-3 w-3 rounded-[4px]" style={{ background: c.color }} />
        </button>
      ))}
    </div>
  );
}
