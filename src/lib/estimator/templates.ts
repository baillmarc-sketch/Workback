/**
 * Starter templates for new estimates. Each lays out the project-info fields,
 * sections + line items, default below-the-line adjustments, and a starter
 * assumptions block — modeled on the producer budget workbook / ballpark docs.
 * Items may carry a default amount (e.g. the firm "Project Archive" fee).
 */
import type { AdjustmentType } from "./types";

export type EstimateTemplateId = "video" | "event" | "blank";

type TemplateItem = string | { label: string; amount?: number };

export interface EstimateTemplate {
  id: EstimateTemplateId;
  name: string;
  description: string;
  /** Project-info field labels (values start blank). */
  fields: string[];
  sections: { name: string; items: TemplateItem[] }[];
  /** Below-the-line adjustments applied to every column. */
  adjustments: { label: string; type: AdjustmentType; value: number }[];
  assumptions: string;
}

const STD_ADJUSTMENTS: { label: string; type: AdjustmentType; value: number }[] = [
  { label: "Contingency", type: "percent", value: 10 },
  { label: "Insurance", type: "percent", value: 2 },
  { label: "Sales Tax", type: "percent", value: 0 },
];

const VIDEO_ASSUMPTIONS = [
  "Assumes an approximately XX week timeline.",
  "Does not include overtime or weekend work.",
  "Clients will have XX reviews of script/treatment and XX reviews of the edit.",
  "Assumes XX shoot days and XX locations.",
  "Assumes XX staff will travel for XX days; client travel not included.",
  "Casting and talent fees: includes session and usage for XX talent; celebrity talent not included.",
  "Includes casting and payment for one (1) voice-over artist.",
  "Stock footage: up to $XX of licensing included.",
  "Music: needledrop/stock track unless noted (recognizable song or original composition quoted separately).",
  "Does not include media spend or sales tax unless noted.",
].join("\n");

const EVENT_ASSUMPTIONS = [
  "Assumes a one (1) day event with XX hours of show time.",
  "Assumes XX build days and XX strike days at the venue.",
  "Venue rental, permits, and power are estimates pending final venue selection.",
  "Staffing assumes XX brand ambassadors for XX hours.",
  "Does not include overtime, weekend, or holiday premiums.",
  "Travel assumes XX crew for XX days; client travel not included.",
  "Food & beverage based on XX expected attendees.",
  "Does not include media spend or sales tax unless noted.",
].join("\n");

export const ESTIMATE_TEMPLATES: EstimateTemplate[] = [
  {
    id: "video",
    name: "Video production",
    description: "Full production budget — pre-pro through delivery",
    fields: [
      "Client",
      "Product",
      "Job #",
      "Date",
      "Shoot Dates",
      "Producer",
      "Executive Producer",
      "Business Manager",
      "Production Co.",
      "Director",
      "Editorial Co.",
      "Editor",
      "Ship Date",
    ],
    sections: [
      {
        name: "Production",
        items: [
          "Content Production Company",
          "Digital Production Company",
          "Photographer",
          "Storyboards",
          "Stock Photography / Found Footage Licensing",
        ],
      },
      {
        name: "Post Production",
        items: ["Editorial", "Retouching", "Animation / CGI", "VFX / Finishing", "Color Correction", "Sound Design", "Sound Mix"],
      },
      {
        name: "Music & Audio",
        items: ["Popular Music Licensing", "Original Music — Demos", "Original Music — Buyout", "Music Supervision", "Musicology"],
      },
      { name: "Digital", items: ["Hosting", "Licenses", "Hardware"] },
      {
        name: "Talent & Usage",
        items: [
          "Union talent on-screen (OCP incl. P&W)",
          "Union talent on-screen (Extras / Hand Model incl. P&W)",
          "Union talent off-screen (Voice over incl. P&W)",
          "Union talent musicians (session and usage)",
          "Non-Union Talent (OC and VO)",
          "CMC Fee",
          "Glam / Talent Expenses",
        ],
      },
      { name: "Travel", items: ["Flights", "Per Diem (Hotel / Meals + Misc)", "Ground Transportation", "Rental Cars"] },
      {
        name: "Misc",
        items: [{ label: "Project Archive", amount: 750 }, "Outside Legal Counsel", "Trademark Search", "Hard Drives", "Shipping", "Printing & Misc"],
      },
      { name: "Insurance", items: ["Special Coverage"] },
    ],
    adjustments: STD_ADJUSTMENTS,
    assumptions: VIDEO_ASSUMPTIONS,
  },
  {
    id: "event",
    name: "Event / experiential",
    description: "Concept through show day and strike",
    fields: ["Client", "Project", "Producer", "Event Date(s)", "Venue", "Location", "Build Dates", "Show Date", "Strike Date"],
    sections: [
      { name: "Creative & Strategy", items: ["Concept & Design", "Project Management"] },
      { name: "Production & Build", items: ["Fabrication", "Scenic", "Signage", "Furniture Rental"] },
      { name: "Venue", items: ["Venue Rental", "Permits", "Power"] },
      { name: "AV & Technology", items: ["Audio", "Video / LED", "Lighting", "AV Crew"] },
      { name: "Staffing", items: ["Event Manager", "Brand Ambassadors", "Security"] },
      { name: "Food & Beverage", items: ["Catering", "Bar"] },
      { name: "Talent & Usage", items: ["Host / Talent", "Talent Usage"] },
      { name: "Travel", items: ["Flights", "Per Diem (Hotel / Meals + Misc)", "Ground Transportation", "Rental Cars"] },
      { name: "Misc", items: [{ label: "Project Archive", amount: 750 }, "Permits / Licenses", "Shipping", "Storage", "Printing & Misc"] },
      { name: "Insurance", items: ["Event Insurance", "Special Coverage"] },
    ],
    adjustments: STD_ADJUSTMENTS,
    assumptions: EVENT_ASSUMPTIONS,
  },
  {
    id: "blank",
    name: "Blank",
    description: "A few empty sections to make your own",
    fields: ["Client", "Project", "Producer"],
    sections: [
      { name: "Production", items: [] },
      { name: "Post", items: [] },
      { name: "Other", items: [] },
    ],
    adjustments: [],
    assumptions: "",
  },
];

export function estimateTemplateById(id: EstimateTemplateId): EstimateTemplate {
  return ESTIMATE_TEMPLATES.find((t) => t.id === id) ?? ESTIMATE_TEMPLATES[0];
}
