/**
 * Author attribution shared across all toolkit apps. Stored as `createdBy` on a
 * doc so a team workspace can show who made each file. The name is the Google
 * display name (from auth), captured at creation time so it survives even if the
 * person later changes it or leaves.
 */
export interface Author {
  uid: string;
  name: string;
}

/** Normalize a stored author field; returns undefined when absent/malformed so
    older docs (and RTDB's dropped-empty quirks) never break a migrate. */
export function migrateAuthor(raw: unknown): Author | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as Partial<Author>;
  if (typeof a.uid !== "string" || !a.uid) return undefined;
  return { uid: a.uid, name: typeof a.name === "string" ? a.name : "" };
}
