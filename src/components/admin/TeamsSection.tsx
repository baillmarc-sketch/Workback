"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import {
  createTeam,
  deleteTeam,
  listTeams,
  renameTeam,
  setMembership,
  type Team,
} from "@/lib/admin/teams";
import { listRegistry, type RegistryUser } from "@/lib/admin/registry";
import { logAudit } from "@/lib/admin/audit";
import Toggle from "./Toggle";

export default function TeamsSection() {
  const { user, getToken } = useAuth();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [registry, setRegistry] = useState<RegistryUser[]>([]);
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const [t, reg] = await Promise.all([listTeams(token), listRegistry(token)]);
      setTeams(t);
      setRegistry(reg);
    } catch (e) {
      setError((e as Error).message || "Could not load teams");
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await createTeam(token, n);
      if (user) await logAudit(token, user, "create_team", n);
      setName("");
      await load();
    } catch (e) {
      setError((e as Error).message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string, next: string) {
    const n = next.trim();
    if (!n) return;
    try {
      const token = await getToken();
      if (token) await renameTeam(token, id, n);
      setTeams((cur) => cur?.map((t) => (t.id === id ? { ...t, name: n } : t)) ?? null);
    } catch (e) {
      setError((e as Error).message || "Rename failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this team? Members keep their own access; only the team is removed.")) return;
    try {
      const token = await getToken();
      if (token) {
        const removed = teams?.find((t) => t.id === id);
        await deleteTeam(token, id);
        if (user) await logAudit(token, user, "delete_team", removed?.name ?? id);
      }
      setTeams((cur) => cur?.filter((t) => t.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message || "Delete failed");
    }
  }

  async function toggleMember(team: Team, uid: string, inTeam: boolean) {
    // optimistic
    setTeams(
      (cur) =>
        cur?.map((t) => {
          if (t.id !== team.id) return t;
          const members = { ...t.members };
          if (inTeam) members[uid] = true;
          else delete members[uid];
          return { ...t, members };
        }) ?? null
    );
    try {
      const token = await getToken();
      if (token) await setMembership(token, team.id, uid, inTeam);
    } catch (e) {
      setError((e as Error).message || "Update failed");
      load();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-ink-soft">
        Group users into teams. In this version teams are organizational labels — they don&apos;t
        change what anyone can access on their own.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New team name"
          className="min-w-[200px] flex-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] outline-none placeholder:text-ink-faint"
        />
        <button
          className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85 disabled:opacity-50"
          disabled={busy}
          onClick={add}
        >
          {busy ? "Creating…" : "Create team"}
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</div>}

      {teams === null ? (
        <div className="py-10 text-center text-[12.5px] text-ink-faint">Loading…</div>
      ) : teams.length === 0 ? (
        <div className="py-6 text-center text-[12.5px] text-ink-faint">No teams yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {teams.map((team) => {
            const count = Object.keys(team.members).length;
            const open = expanded === team.id;
            return (
              <div key={team.id} className="overflow-hidden rounded-lg border border-hairline bg-surface">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <input
                    defaultValue={team.name}
                    onBlur={(e) => e.target.value !== team.name && rename(team.id, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[13px] font-semibold outline-none hover:bg-paper focus:bg-paper"
                  />
                  <span className="shrink-0 text-[11.5px] text-ink-faint">
                    {count} member{count === 1 ? "" : "s"}
                  </span>
                  <button
                    className="shrink-0 rounded-md border border-hairline px-2 py-1 text-[11.5px] font-medium text-ink-soft hover:bg-paper hover:text-ink"
                    onClick={() => setExpanded(open ? null : team.id)}
                  >
                    {open ? "Done" : "Members"}
                  </button>
                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
                    onClick={() => remove(team.id)}
                  >
                    Delete
                  </button>
                </div>
                {open && (
                  <div className="border-t border-hairline">
                    {registry.length === 0 ? (
                      <div className="px-3 py-3 text-[12px] text-ink-faint">No users to add yet.</div>
                    ) : (
                      registry.map((u) => (
                        <div
                          key={u.uid}
                          className="flex items-center gap-2 border-b border-hairline px-3 py-2 last:border-b-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12.5px] font-medium">{u.name || u.email}</div>
                            <div className="truncate text-[11px] text-ink-faint">{u.email}</div>
                          </div>
                          <Toggle
                            checked={!!team.members[u.uid]}
                            label={`${u.email} in ${team.name}`}
                            onChange={(next) => toggleMember(team, u.uid, next)}
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
