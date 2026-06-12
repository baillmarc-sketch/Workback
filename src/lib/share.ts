import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Project } from "./types";
import { migrate } from "./storage";
import { uid } from "./types";

/** Above this, copy/paste gets impractical — steer users to JSON export. */
export const SHARE_CODE_WARN_BYTES = 8 * 1024;

export function encodeShareCode(project: Project): string {
  // Strip volatile fields so the same project always yields the same code
  const { updatedAt, createdAt, ...rest } = project;
  void updatedAt;
  void createdAt;
  return compressToEncodedURIComponent(JSON.stringify(rest));
}

export function decodeShareCode(code: string): Project {
  const json = decompressFromEncodedURIComponent(code.trim());
  if (!json) throw new Error("That doesn't look like a valid share code.");
  const project = migrate(JSON.parse(json));
  // Imported copy gets its own identity so it never clobbers an existing project
  project.id = uid();
  project.createdAt = Date.now();
  project.updatedAt = Date.now();
  return project;
}

export function exportJson(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function importJson(json: string): Project {
  const project = migrate(JSON.parse(json));
  project.updatedAt = Date.now();
  return project;
}

export function downloadFile(name: string, content: string, type = "application/json"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
