/**
 * Realtime Database keys may not contain `. # $ [ ] /`, but emails routinely
 * contain dots — so we derive a safe key from an email to use as a node name
 * (e.g. for /invites/{emailKey}). The address is lowercased first so the key is
 * case-insensitive (matching how invites are looked up). `.` becomes `,` (the
 * conventional Firebase swap); the remaining forbidden characters never appear
 * in a valid email but are percent-encoded defensively so a malformed value can
 * never produce an unsafe key.
 */
export function emailKey(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/\./g, ",")
    .replace(/#/g, "%23")
    .replace(/\$/g, "%24")
    .replace(/\[/g, "%5B")
    .replace(/\]/g, "%5D")
    .replace(/\//g, "%2F");
}
