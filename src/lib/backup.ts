import { migrate } from "./storage";
import type { Project } from "./types";
import { uid } from "./types";

/**
 * Local backup: download a project as a Workback `.json` file and read one back
 * in. The remedy for "all my data lived in this one browser." Import always
 * produces an independent copy (fresh id, no share link) so restoring can never
 * silently overwrite an existing project or hijack a live shared doc.
 */

export function exportProjectFile(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const slug =
    (project.title || "workback")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workback";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.workback.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Parse a `.workback.json` file into a fresh, independent project. Runs through
 *  migrate(), so hand-edited or older exports import safely; throws if the file
 *  isn't a Workback project. */
export async function importProjectFile(file: File): Promise<Project> {
  const parsed = JSON.parse(await file.text());
  const p = migrate(parsed); // throws "Not a Workback project" on junk
  const now = Date.now();
  return { ...p, id: uid(), shareId: undefined, createdAt: now, updatedAt: now };
}
