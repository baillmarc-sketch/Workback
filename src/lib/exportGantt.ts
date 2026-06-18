import type { Project, WorkbackEvent } from "./types";
import { addDaysKey, addMonthsKey, diffDays, durationDays, fmtSlashMD, fromKey, monthLabel } from "./dates";
import { compareSameDay } from "./eventTime";

/**
 * A self-contained Gantt chart as an inline SVG string (DOM-free). It powers
 * the on-screen preview, the PNG download (rasterized via canvas), and print.
 * Titles live in a left column so bars never need text-on-color contrast.
 */

const LBL = 220; // left label column
const DAY = 20; // px per day
const ROW = 26;
const ROW_GAP = 4;
const HEAD = 46;
const PAD = 12;

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Only let well-formed CSS colors into raw SVG attributes. This SVG string is
 * rendered via dangerouslySetInnerHTML, and category colors can be set by anyone
 * who can write the (shared / team) project in the DB — so an unsanitized color
 * like `#000" onload="…` would be an attribute-injection XSS. Anything that
 * isn't a plain hex / rgb()/hsl() / simple name falls back to a neutral grey.
 */
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%]+\)|[a-zA-Z]{1,20})$/;
function safeColor(c: unknown, fallback = "#94a3b8"): string {
  return typeof c === "string" && COLOR_RE.test(c.trim()) ? c.trim() : fallback;
}

function clip(s: string, max = 30): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Lighten a #rrggbb toward white by ratio (0..1); pass-through otherwise. */
function tint(hex: string, ratio: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(c + (255 - c) * ratio)
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export interface GanttSvg {
  svg: string;
  width: number;
  height: number;
}

export function buildGantt(project: Project): GanttSvg {
  const events = [...project.events].sort((a, b) =>
    a.startDate !== b.startDate ? (a.startDate < b.startDate ? -1 : 1) : compareSameDay(a, b)
  );
  const colorOf = new Map(project.categories.map((c) => [c.id, c.color]));

  if (events.length === 0) {
    const width = LBL + DAY * 7 + PAD * 2;
    const height = HEAD + ROW + PAD * 2;
    return {
      width,
      height,
      svg:
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif">` +
        `<rect width="${width}" height="${height}" fill="#fff"/>` +
        `<text x="${PAD}" y="${HEAD + ROW / 2}" font-size="13" fill="#888">No events yet.</text>` +
        `</svg>`,
    };
  }

  let min = events[0].startDate;
  let max = events[0].endDate;
  for (const e of events) {
    if (e.startDate < min) min = e.startDate;
    if (e.endDate > max) max = e.endDate;
  }
  min = addDaysKey(min, -1);
  max = addDaysKey(max, 1);
  const totalDays = diffDays(min, max) + 1;

  const gridX = LBL + PAD;
  const width = gridX + totalDays * DAY + PAD;
  const height = HEAD + events.length * (ROW + ROW_GAP) - ROW_GAP + PAD * 2;
  const gridTop = PAD + HEAD;
  const gridBottom = height - PAD;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif">`
  );
  parts.push(`<rect width="${width}" height="${height}" fill="#fff"/>`);

  // Month bands + labels across the top, weekly gridlines beneath
  let m = min.slice(0, 7);
  const lastM = max.slice(0, 7);
  while (m <= lastM) {
    const monthStart = m + "-01";
    const x = gridX + Math.max(0, diffDays(min, monthStart)) * DAY;
    if (monthStart >= min && monthStart <= max) {
      parts.push(`<line x1="${x}" y1="${PAD + 18}" x2="${x}" y2="${gridBottom}" stroke="#d8d8d8" stroke-width="1"/>`);
    }
    const labelX = Math.max(gridX + 4, x + 4);
    parts.push(
      `<text x="${labelX}" y="${PAD + 14}" font-size="12" font-weight="600" fill="#444">${escXml(monthLabel(m))}</text>`
    );
    m = addMonthsKey(m, 1);
  }
  for (let d = 0; d < totalDays; d++) {
    const day = addDaysKey(min, d);
    if (fromKey(day).getDay() === 0) {
      const x = gridX + d * DAY;
      parts.push(`<line x1="${x}" y1="${gridTop}" x2="${x}" y2="${gridBottom}" stroke="#eee" stroke-width="1"/>`);
    }
  }
  // Column divider
  parts.push(`<line x1="${gridX}" y1="${PAD + 18}" x2="${gridX}" y2="${gridBottom}" stroke="#cfcfcf" stroke-width="1"/>`);

  events.forEach((e: WorkbackEvent, i) => {
    const y = gridTop + i * (ROW + ROW_GAP);
    const color = safeColor(colorOf.get(e.category));
    const x = gridX + diffDays(min, e.startDate) * DAY;
    const w = Math.max(durationDays(e.startDate, e.endDate) * DAY - 3, 6);
    const fill = e.isMilestone ? color : tint(color, 0.8);
    const stroke = e.isMilestone ? color : tint(color, 0.45);

    // Left-column label
    parts.push(
      `<text x="${PAD}" y="${y + ROW / 2 + 1}" font-size="12.5" fill="#1a1a1a" dominant-baseline="middle">` +
        `${e.isMilestone ? "◆ " : ""}${escXml(clip(e.title))}</text>`
    );
    parts.push(
      `<text x="${LBL + 6}" y="${y + ROW / 2 + 1}" font-size="10.5" fill="#999" text-anchor="end" dominant-baseline="middle">` +
        `${escXml(fmtSlashMD(e.startDate))}</text>`
    );
    // Bar
    parts.push(
      `<rect x="${x}" y="${y + 3}" width="${w}" height="${ROW - 6}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`
    );
    if (e.time) {
      parts.push(
        `<text x="${x + 6}" y="${y + ROW / 2 + 1}" font-size="10" fill="#555" dominant-baseline="middle">${escXml(e.time)}</text>`
      );
    }
  });

  parts.push(`</svg>`);
  return { svg: parts.join(""), width, height };
}
