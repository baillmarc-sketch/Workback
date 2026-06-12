import { CATEGORIES } from "@/lib/categories";
import type { WorkbackEvent } from "@/lib/types";

export default function Legend({ events, className = "" }: { events?: WorkbackEvent[]; className?: string }) {
  // In exports only show categories actually used; on screen show all
  const used = events ? new Set(events.map((e) => e.category)) : null;
  const cats = used ? CATEGORIES.filter((c) => used.has(c.id)) : CATEGORIES;
  if (cats.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {cats.map((c) => (
        <span key={c.id} className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
          <span className="cat-dot h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
          {c.label}
        </span>
      ))}
    </div>
  );
}
