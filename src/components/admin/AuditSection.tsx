"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import { listAudit, type AuditEntry } from "@/lib/admin/audit";

const LABELS: Record<string, string> = {
  claim_owner: "Claimed admin access",
  pin_owner_uid: "Enabled UID recovery",
  grant_estimator: "Granted Estimator",
  revoke_estimator: "Revoked Estimator",
  set_role: "Changed role",
  create_invite: "Created invite",
  revoke_invite: "Revoked invite",
  recover_project: "Recovered calendar",
  recover_estimate: "Recovered estimate",
  purge_trash: "Emptied trash",
  create_team: "Created team",
  delete_team: "Deleted team",
  rename_team: "Renamed team",
  set_team_membership: "Changed team membership",
  set_team_grant: "Changed team access",
  view_user_data: "Viewed user data",
  remove_user: "Removed user",
};

function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Read-only feed of admin actions (append-only; immutable per the rules). */
export default function AuditSection() {
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(200);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      setEntries(await listAudit(token, limit));
    } catch (e) {
      setError((e as Error).message || "Could not load activity");
    }
  }, [getToken, limit]);

  useEffect(() => {
    load();
  }, [load]);

  // Action types present, for the filter dropdown.
  const actions = entries ? [...new Set(entries.map((e) => e.action))].sort() : [];
  const shown = entries?.filter((e) => filter === "all" || e.action === filter) ?? null;
  const atCap = entries !== null && entries.length >= limit;

  function exportCsv() {
    if (!shown) return;
    const header = ["timestamp", "action", "actor", "target", "detail"];
    const rows = shown.map((e) => [
      e.ts ? new Date(e.ts).toISOString() : "",
      LABELS[e.action] ?? e.action,
      e.actorEmail ?? e.actorUid,
      e.target ?? "",
      e.detail ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-[12.5px] text-ink-soft">
          Every admin action, newest first. Entries are append-only and can&apos;t be edited.
        </p>
        <select
          className="rounded-md border border-hairline bg-surface px-2 py-1 text-[12px]"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by action"
        >
          <option value="all">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {LABELS[a] ?? a}
            </option>
          ))}
        </select>
        <button
          className="shrink-0 rounded-md border border-hairline px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
          onClick={exportCsv}
          disabled={!shown || shown.length === 0}
        >
          Export CSV
        </button>
        <button
          className="shrink-0 rounded-md border border-hairline px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:text-ink"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</div>}

      {shown === null ? (
        <div className="py-10 text-center text-[12.5px] text-ink-faint">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="py-6 text-center text-[12.5px] text-ink-faint">No activity yet.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
          {shown.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 border-b border-hairline px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px]">
                  <span className="font-semibold">{LABELS[e.action] ?? e.action}</span>
                  {e.target && <span className="text-ink-soft"> · {e.target}</span>}
                  {e.detail && <span className="text-ink-faint"> ({e.detail})</span>}
                </div>
                <div className="truncate text-[11px] text-ink-faint">{e.actorEmail ?? e.actorUid}</div>
              </div>
              <span className="shrink-0 text-[11px] text-ink-faint">
                {e.ts ? new Date(e.ts).toLocaleString() : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {atCap && (
        <button
          className="self-center rounded-md border border-hairline px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink"
          onClick={() => setLimit((n) => n + 200)}
        >
          Load more
        </button>
      )}
    </div>
  );
}
