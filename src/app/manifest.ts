import type { MetadataRoute } from "next";

// Resolve under the active deploy base (Firebase = root; GitHub Pages = /Workback).
const base = process.env.PAGES_BASE ?? "";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Producer's Toolkit",
    short_name: "Workback",
    description:
      "Producer's Toolkit — workback calendars, production estimates, and bid specs in one place.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#fafaf8",
    theme_color: "#fafaf8",
    icons: [
      { src: `${base}/icon.svg`, type: "image/svg+xml", sizes: "any" },
      { src: `${base}/icon-192.png`, type: "image/png", sizes: "192x192", purpose: "maskable" },
      { src: `${base}/icon-512.png`, type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
