import type { Project, WorkbackEvent } from "./types";
import { uid } from "./types";
import { addDaysKey, maxKey } from "./dates";
import { migrate } from "./storage";

/**
 * iCalendar (RFC 5545) import/export. Events are all-day VEVENTs (DTEND is
 * exclusive per spec). The native lossless formats are JSON / share codes;
 * .ics is for interchange with Outlook / Google / Apple Calendar, so a call
 * time rides in the SUMMARY where calendar apps show it.
 */

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Fold long lines to ~75 chars per RFC 5545 (continuation lines start " ") */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) {
    parts.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
  }
  return parts.join("\r\n");
}

const compact = (key: string) => key.replace(/-/g, ""); // 2026-06-10 -> 20260610

function nowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "imported";
}

export function exportIcs(project: Project): string {
  const labelOf = new Map(project.categories.map((c) => [c.id, c.label]));
  const dtstamp = nowStamp();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Workback Builder//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(project.title || "Workback")}`,
  ];
  for (const e of project.events) {
    const summary = e.time ? `${e.time} — ${e.title}` : e.title;
    const desc: string[] = [];
    if (e.description) desc.push(e.description);
    if (e.isMilestone) desc.push("Milestone");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@workback`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${compact(e.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${compact(addDaysKey(e.endDate, 1))}`); // DTEND is exclusive
    lines.push(`SUMMARY:${escapeText(summary)}`);
    if (desc.length) lines.push(`DESCRIPTION:${escapeText(desc.join("\n"))}`);
    const cat = labelOf.get(e.category);
    if (cat) lines.push(`CATEGORIES:${escapeText(cat)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n");
}

/** Join RFC 5545 continuation lines (those starting with a space or tab) */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseDate(val: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(val.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function parseIcs(text: string): { title: string; events: WorkbackEvent[] } {
  const lines = unfold(text);
  let title = "Imported Calendar";
  const events: WorkbackEvent[] = [];
  let props: Record<string, string> | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      props = {};
      continue;
    }
    if (upper === "END:VEVENT") {
      if (props) {
        const start = parseDate(props["DTSTART"] ?? "");
        if (start) {
          let end = start;
          const rawEnd = props["DTEND"];
          if (rawEnd) {
            const parsed = parseDate(rawEnd);
            if (parsed) {
              // All-day DTEND is exclusive; a datetime DTEND is inclusive
              end = /T/.test(rawEnd) ? parsed : maxKey(start, addDaysKey(parsed, -1));
            }
          }
          events.push({
            id: uid(),
            title: unescapeText(props["SUMMARY"] ?? "Untitled"),
            description: props["DESCRIPTION"] ? unescapeText(props["DESCRIPTION"]) : undefined,
            startDate: start,
            endDate: end,
            category: props["CATEGORIES"] ? slug(unescapeText(props["CATEGORIES"])) : "imported",
            isMilestone: false,
            locked: false,
          });
        }
      }
      props = null;
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const name = line.slice(0, idx).split(";")[0].toUpperCase();
    const value = line.slice(idx + 1);
    if (name === "X-WR-CALNAME" && value.trim()) title = unescapeText(value);
    if (props) props[name] = value;
  }
  return { title, events };
}

/** Build a fresh, normalized project from an .ics file's events. */
export function projectFromIcs(text: string): Project {
  const { title, events } = parseIcs(text);
  if (events.length === 0) throw new Error("No events found in that .ics file");
  const earliest = events.map((e) => e.startDate).sort()[0];
  return migrate({
    schema: 2,
    title,
    subtitle: "",
    notes: "",
    events,
    anchorMonth: earliest.slice(0, 7),
    monthsVisible: 1,
    showLegend: true,
  });
}
