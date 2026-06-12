import type { NextConfig } from "next";

// Always a static export. Plain `npm run build` → out/ for Firebase Hosting;
// PAGES_BASE=/Workback adds the basePath for the legacy GitHub Pages deploy
// served from /docs at baillmarc-sketch.github.io/Workback
const base = process.env.PAGES_BASE;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  ...(base ? { basePath: base } : {}),
  images: { unoptimized: true },
};

export default nextConfig;
