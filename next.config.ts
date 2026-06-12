import type { NextConfig } from "next";

// PAGES_BASE=/Workback npm run build → static export for GitHub Pages,
// served from the repo's /docs folder at baillmarc-sketch.github.io/Workback
const base = process.env.PAGES_BASE;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(base ? { output: "export" as const, basePath: base } : {}),
  images: { unoptimized: true },
};

export default nextConfig;
