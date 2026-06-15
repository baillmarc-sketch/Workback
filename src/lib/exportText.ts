import type { Project, WorkbackEvent } from "./types";
import { fmtSlash, fmtSlashMD, fmtDowMD, weekStartOf } from "./dates";
import { compareSameDay, timeBand } from "./eventTime";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** "AM - " / "EOD - " / "2:30 PM - " / "" */
function timePrefix(e: WorkbackEvent): string {
  const band = timeBand(e.time);
  if (band === 0) return "AM - ";
  if (band === 3) return "EOD - ";
  if (band === 1 && e.time) return `${e.time} - `;
  return "";
}

function titleText(e: WorkbackEvent): string {
  const marker = e.isMilestone ? "◆ " : "";
  const thru = e.startDate !== e.endDate ? ` (thru ${fmtSlashMD(e.endDate)})` : "";
  return `${marker}${e.title}${thru}`;
}

export interface ExportResult {
  plain: string;
  html: string;
}

/** Date-grouped list, suitable for pasting into email/Teams */
export function exportDateList(project: Project): ExportResult {
  const groups = new Map<string, WorkbackEvent[]>();
  for (const e of project.events) {
    const list = groups.get(e.startDate) ?? [];
    list.push(e);
    groups.set(e.startDate, list);
  }
  const dates = [...groups.keys()].sort();

  const plainBlocks: string[] = [];
  const htmlBlocks: string[] = [];

  for (const date of dates) {
    const evts = [...groups.get(date)!].sort(compareSameDay);
    const dateStr = fmtSlash(date);
    if (evts.length === 1) {
      const e = evts[0];
      const line = `${dateStr} - ${timePrefix(e)}${titleText(e)}`;
      plainBlocks.push(line);
      htmlBlocks.push(`<div>${esc(line)}</div>`);
    } else {
      const lines = evts.map((e) => `${timePrefix(e)}${titleText(e)}`);
      plainBlocks.push([`${dateStr} -`, ...lines].join("\n"));
      htmlBlocks.push(
        `<div><strong>${esc(dateStr)} -</strong>${lines.map((l) => `<br>${esc(l)}`).join("")}</div>`
      );
    }
  }

  return {
    plain: plainBlocks.join("\n\n"),
    html: htmlBlocks.join(""),
  };
}

/** Week-of overview: one header per week with a line per event */
export function exportWeekOverview(project: Project): ExportResult {
  const weekGroups = new Map<string, WorkbackEvent[]>();
  for (const e of project.events) {
    const ws = weekStartOf(e.startDate);
    const list = weekGroups.get(ws) ?? [];
    list.push(e);
    weekGroups.set(ws, list);
  }
  const weekStarts = [...weekGroups.keys()].sort();

  const plainBlocks: string[] = [];
  const htmlBlocks: string[] = [];

  for (const ws of weekStarts) {
    const evts = [...weekGroups.get(ws)!].sort(compareSameDay);
    const header = `WEEK OF ${fmtSlash(ws)}`;
    const lines = evts.map((e) => {
      const title = `${e.isMilestone ? "◆ " : ""}${e.title}`;
      if (e.startDate !== e.endDate) {
        return `${fmtDowMD(e.startDate)} – ${fmtDowMD(e.endDate)} · ${title}`;
      }
      const prefix = timePrefix(e);
      const timed = prefix ? `${prefix.replace(/ - $/, "")} – ` : "";
      return `${fmtDowMD(e.startDate)} · ${timed}${title}`;
    });
    plainBlocks.push([header, ...lines].join("\n"));
    htmlBlocks.push(
      `<div><strong>${esc(header)}</strong>${lines.map((l) => `<br>${esc(l)}`).join("")}</div>`
    );
  }

  return {
    plain: plainBlocks.join("\n\n"),
    html: htmlBlocks.join(""),
  };
}
