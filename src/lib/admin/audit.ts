import { dbUrl } from "../cloud";
import type { AccountUser } from "@/state/auth";

/**
 * Append-only audit log of admin actions. Entries live under /auditLog and the
 * rules make them immutable (create-only) and pin actorUid to the writer, so the
 * trail can't be forged or edited from the client. Logging is best-effort — it
 * never blocks the underlying operation.
 */
export type AuditAction =
  | "claim_owner"
  | "pin_owner_uid"
  | "grant_estimator"
  | "revoke_estimator"
  | "set_role"
  | "create_invite"
  | "revoke_invite"
  | "dismiss_request"
  | "recover_project"
  | "recover_estimate"
  | "purge_trash"
  | "create_team"
  | "delete_team"
  | "rename_team"
  | "set_team_membership"
  | "set_team_grant"
  | "view_user_data"
  | "remove_user";

export interface AuditEntry {
  id: string;
  ts: number;
  actorUid: string;
  actorEmail: string | null;
  action: string;
  target: string | null;
  detail: string | null;
}

export async function logAudit(
  token: string,
  actor: AccountUser,
  action: AuditAction,
  target?: string,
  detail?: string
): Promise<void> {
  try {
    await fetch(`${dbUrl()}/auditLog.json?auth=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ts: Date.now(),
        actorUid: actor.uid,
        actorEmail: actor.email ?? null,
        action,
        target: target ?? null,
        detail: detail ?? null,
      }),
    });
  } catch {
    // best-effort: never let logging failure surface to the user
  }
}

export async function listAudit(token: string, limit = 200): Promise<AuditEntry[]> {
  const res = await fetch(
    `${dbUrl()}/auditLog.json?auth=${encodeURIComponent(token)}&orderBy=%22ts%22&limitToLast=${limit}`
  );
  if (!res.ok) throw new Error(`Audit fetch failed (${res.status})`);
  const data = (await res.json()) as Record<string, Partial<AuditEntry>> | null;
  if (!data) return [];
  const out: AuditEntry[] = [];
  for (const [id, raw] of Object.entries(data)) {
    if (!raw || typeof raw.action !== "string") continue;
    out.push({
      id,
      ts: typeof raw.ts === "number" ? raw.ts : 0,
      actorUid: typeof raw.actorUid === "string" ? raw.actorUid : "",
      actorEmail: typeof raw.actorEmail === "string" ? raw.actorEmail : null,
      action: raw.action,
      target: typeof raw.target === "string" ? raw.target : null,
      detail: typeof raw.detail === "string" ? raw.detail : null,
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}
