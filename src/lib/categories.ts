import type { ProjectCategory } from "./types";

/** The classic video-production palette — also seeds schema-1 projects on migrate */
export const DEFAULT_CATEGORIES: ProjectCategory[] = [
  { id: "creative", label: "Creative", color: "#8B5CF6" },
  { id: "pre-production", label: "Pre-Production", color: "#3B82F6" },
  { id: "production", label: "Production", color: "#EF4444" },
  { id: "post-production", label: "Post Production", color: "#10B981" },
  { id: "vfx", label: "VFX", color: "#EC4899" },
  { id: "finishing", label: "Finishing", color: "#14B8A6" },
  { id: "client-review", label: "Client Review", color: "#F97316" },
  { id: "internal-review", label: "Internal Review", color: "#EAB308" },
  { id: "delivery", label: "Delivery / Launch", color: "#18181B" },
];

export const PLACEHOLDER_COLOR = "#9CA3AF";

export function categoryOf(categories: ProjectCategory[], id: string): ProjectCategory {
  return (
    categories.find((c) => c.id === id) ?? { id, label: humanize(id), color: PLACEHOLDER_COLOR }
  );
}

/** Dark text tone for tinted backgrounds, derived from the base color */
export function catText(color: string): string {
  return `color-mix(in oklab, ${color} 62%, black)`;
}

export function humanize(id: string): string {
  return id
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function newCategoryId(label: string, existing: ProjectCategory[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "label";
  let id = base;
  let n = 2;
  while (existing.some((c) => c.id === id)) id = `${base}-${n++}`;
  return id;
}
