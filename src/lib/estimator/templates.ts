/**
 * Starter templates for new estimates. Each lays out the sections and line
 * items a producer expects for that job type, with empty cost cells — you just
 * pop in numbers. Mirrors the Workback template picker (video / event / blank).
 */

export type EstimateTemplateId = "video" | "event" | "activation" | "blank";

export interface EstimateTemplate {
  id: EstimateTemplateId;
  name: string;
  description: string;
  /** Ordered sections, each with its ordered line-item labels. */
  sections: { name: string; items: string[] }[];
  /** Sensible default markup / contingency for the first column. */
  markupPct: number;
  contingencyPct: number;
}

export const ESTIMATE_TEMPLATES: EstimateTemplate[] = [
  {
    id: "video",
    name: "Video production",
    description: "Pre-pro through delivery — the classic spot budget",
    markupPct: 15,
    contingencyPct: 10,
    sections: [
      { name: "Pre-Production", items: ["Director", "Producer", "Line Producer", "Casting", "Location Scout", "Permits"] },
      { name: "Production", items: ["Crew", "Camera & Lenses", "Lighting & Grip", "Art Department", "Wardrobe / HMU", "Catering", "Transportation"] },
      { name: "Talent", items: ["On-camera Talent", "Talent Usage / Buyout", "Fittings"] },
      { name: "Post-Production", items: ["Editorial", "Color Grade", "VFX / Online", "Graphics / Titles"] },
      { name: "Music & Sound", items: ["Composer / License", "Sound Design", "Mix", "VO Record"] },
      { name: "Insurance & Legal", items: ["Production Insurance", "Legal / Clearances"] },
    ],
  },
  {
    id: "event",
    name: "Event / experiential",
    description: "Concept through show day and strike",
    markupPct: 15,
    contingencyPct: 10,
    sections: [
      { name: "Creative & Strategy", items: ["Concept & Design", "Project Management"] },
      { name: "Production & Build", items: ["Fabrication", "Scenic", "Signage", "Furniture Rental"] },
      { name: "Venue", items: ["Venue Rental", "Permits", "Power"] },
      { name: "AV & Technology", items: ["Audio", "Video / LED", "Lighting", "AV Crew"] },
      { name: "Staffing", items: ["Event Manager", "Brand Ambassadors", "Security"] },
      { name: "Food & Beverage", items: ["Catering", "Bar"] },
      { name: "Logistics", items: ["Shipping", "Storage", "Travel & Accommodation"] },
      { name: "Insurance", items: ["Event Insurance"] },
    ],
  },
  {
    id: "activation",
    name: "Brand activation",
    description: "Build, tech, and touring footprint",
    markupPct: 15,
    contingencyPct: 10,
    sections: [
      { name: "Creative & Design", items: ["Concept", "Industrial Design", "Renderings"] },
      { name: "Fabrication", items: ["Build", "Finishes", "Tech Integration"] },
      { name: "Technology", items: ["Interactive / Software", "Hardware", "Data Capture"] },
      { name: "Staffing", items: ["Tour Manager", "Brand Ambassadors", "Training"] },
      { name: "Logistics", items: ["Transport", "Storage", "Travel", "Per Diems"] },
      { name: "Footprint", items: ["Space Rental", "Permits"] },
      { name: "Insurance & Legal", items: ["Insurance", "Legal / Clearances"] },
    ],
  },
  {
    id: "blank",
    name: "Blank",
    description: "A few empty sections to make your own",
    markupPct: 0,
    contingencyPct: 0,
    sections: [
      { name: "Production", items: [] },
      { name: "Post", items: [] },
      { name: "Other", items: [] },
    ],
  },
];

export function estimateTemplateById(id: EstimateTemplateId): EstimateTemplate {
  return ESTIMATE_TEMPLATES.find((t) => t.id === id) ?? ESTIMATE_TEMPLATES[0];
}
