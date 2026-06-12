import { DEFAULT_CATEGORIES } from "./categories";
import type { ProjectCategory } from "./types";

export type TemplateId = "video" | "event" | "blank";

export interface Template {
  id: TemplateId;
  name: string;
  description: string;
  categories: ProjectCategory[];
}

export const TEMPLATES: Template[] = [
  {
    id: "video",
    name: "Video production",
    description: "Creative through delivery — the classic workback",
    categories: DEFAULT_CATEGORIES,
  },
  {
    id: "event",
    name: "Event / activation",
    description: "Planning through show day and strike",
    categories: [
      { id: "planning", label: "Planning", color: "#8B5CF6" },
      { id: "vendors", label: "Vendors & Booking", color: "#3B82F6" },
      { id: "permits", label: "Permits", color: "#14B8A6" },
      { id: "promo", label: "Promo / Marketing", color: "#EC4899" },
      { id: "build", label: "Build & Setup", color: "#F97316" },
      { id: "show-day", label: "Show Day", color: "#EF4444" },
      { id: "strike", label: "Strike / Wrap", color: "#10B981" },
      { id: "approvals", label: "Approvals", color: "#EAB308" },
    ],
  },
  {
    id: "blank",
    name: "Blank",
    description: "A few neutral labels to make your own",
    categories: [
      { id: "workstream-a", label: "Workstream A", color: "#3B82F6" },
      { id: "workstream-b", label: "Workstream B", color: "#10B981" },
      { id: "review", label: "Review", color: "#F97316" },
      { id: "milestone", label: "Milestone", color: "#18181B" },
    ],
  },
];

export function templateById(id: TemplateId): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
