import type { CategoryId } from "./types";

export interface Category {
  id: CategoryId;
  label: string;
  /** Base color — the only saturated elements in the UI */
  color: string;
  /** Darker variant for text on tinted backgrounds */
  dark: string;
}

export const CATEGORIES: Category[] = [
  { id: "creative", label: "Creative", color: "#8B5CF6", dark: "#5B21B6" },
  { id: "pre-production", label: "Pre-Production", color: "#3B82F6", dark: "#1D4ED8" },
  { id: "production", label: "Production", color: "#EF4444", dark: "#B91C1C" },
  { id: "post-production", label: "Post Production", color: "#10B981", dark: "#047857" },
  { id: "vfx", label: "VFX", color: "#EC4899", dark: "#BE185D" },
  { id: "finishing", label: "Finishing", color: "#14B8A6", dark: "#0F766E" },
  { id: "client-review", label: "Client Review", color: "#F97316", dark: "#C2410C" },
  { id: "internal-review", label: "Internal Review", color: "#EAB308", dark: "#A16207" },
  { id: "delivery", label: "Delivery / Launch", color: "#18181B", dark: "#18181B" },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryOf(id: CategoryId): Category {
  return byId.get(id) ?? CATEGORIES[0];
}
