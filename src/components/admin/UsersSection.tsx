"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import { OWNER_EMAILS } from "@/lib/entitlements";
import type { Role } from "@/lib/admin/access";
import {
  fetchAccessMaps,
  setEntitlement,
  setRole,
  type AccessMaps,
} from "@/lib/admin/users";
import { listRegistry, type RegistryUser } from "@/lib/admin/registry";
import { removeUser } from "@/lib/admin/lifecycle";
import { logAudit } from "@/lib/admin/audit";
import ConfirmDialog, { type ConfirmOptions } from "../ConfirmDialog";
import Toggle from "./Toggle";
import UserDataDrawer from "./UserDataDrawer";

const EMPTY_MAPS: AccessMaps = { admins: {}, roles: {}, entitlements: {} };

function isOwnerEmail(email: string): boolean {
  return OWNER_EMAILS.includes(email.toLowerCase());
}

export default function UsersSection() {
  const { user, getToken } = useAuth();
  const [users, setUsers] = useState<RegistryUser[] | null>(null);
  const [maps, setMaps] = useState<AccessMaps>(EMPTY_MAPS);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<RegistryUser | null>(null);
  const [pending, setPending] = useState<(ConfirmOptions & { run: () => void }) | null>(null);
  const [busyEnt, setBusyEnt] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const [list, m] = await Promise.all([listRegistry(token), fetchAccessMaps(token)]);
      setUsers(list);
      setMaps(m);
    } catch (e) {
      setError((e as Error).message || "Could not load users");
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  function onToggleEstimator(u: RegistryUser, next: boolean) {
    // Granting is one-click; revoking access is gated behind a confirm.
    if (!next) {
      setPending({
        title: "Revoke Estimator",
        danger: true,
        confirmLabel: "Revoke",
        body: (
          <>
            Revoke Estimator access for <strong>{u.email}</strong>? Their own estimates stay intact;
            they just lose access until re-granted.
          </>
        ),
        run: () => doToggleEstimator(u, false),
      });
      return;
    }
    doToggleEstimator(u, true);
  }

  async function doToggleEstimator(u: RegistryUser, next: boolean) {
    if (busyEnt[u.uid]) return; // ignore rapid re-clicks while a write is in flight
    setBusyEnt((b) => ({ ...b, [u.uid]: true }));
    // optimistic
    setMaps((m) => ({
      ...m,
      entitlements: { ...m.entitlements, [u.uid]: { ...m.entitlements[u.uid], estimator: next } },
    }));
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await setEntitlement(u.uid, token, "estimator", next);
      if (user) await logAudit(token, user, next ? "grant_estimator" : "revoke_estimator", u.email);
    } catch (e) {
      setError((e as Error).message || "Update failed");
      load(); // reconcile from server
    } finally {
      setBusyEnt((b) => {
        const n = { ...b };
        delete n[u.uid];
        return n;
      });
    }
  }

  function onChangeRole(u: RegistryUser, role: Role) {
    // Demoting an admin to member removes their elevated access — confirm it.
    const wasAdmin = !!maps.admins[u.uid] || (maps.roles[u.uid] ?? "member") !== "member";
    if (role === "member" && wasAdmin) {
      setPending({
        title: "Remove admin",
        danger: true,
        confirmLabel: "Demote to member",
        body: (
          <>
            Demote <strong>{u.email}</strong> to member? They lose admin access to this panel.
          </>
        ),
        run: () => doChangeRole(u, role),
      });
      return;
    }
    doChangeRole(u, role);
  }

  function onRemoveUser(u: RegistryUser) {
    setPending({
      title: "Remove user",
      danger: true,
      confirmLabel: "Remove permanently",
      body: (
        <>
          Permanently remove <strong>{u.email}</strong>? This revokes all access and{" "}
          <strong>deletes their saved calendars, estimates, and profile</strong>. This can&apos;t be
          undone.
        </>
      ),
      run: () => doRemoveUser(u),
    });
  }

  async function doRemoveUser(u: RegistryUser) {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await removeUser(token, u);
      if (user) await logAudit(token, user, "remove_user", u.email);
      setUsers((cur) => cur?.filter((x) => x.uid !== u.uid) ?? null);
    } catch (e) {
      setError((e as Error).message || "Remove failed");
      load(); // reconcile from server
    }
  }

  async function doChangeRole(u: RegistryUser, role: Role) {
    const prev = maps;
    setMaps((m) => ({
      ...m,
      roles: { ...m.roles, [u.uid]: role },
      admins: { ...m.admins, [u.uid]: role !== "member" },
    }));
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await setRole(u.uid, token, role);
      if (user) await logAudit(token, user, "set_role", u.email, role);
    } catch (e) {
      setError((e as Error).message || "Update failed");
      setMaps(prev);
    }
  }

  if (viewing) return <UserDataDrawer user={viewing} onClose={() => setViewing(null)} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-ink-soft">
          Everyone who has signed in. Grant Estimator access or change a role; open a user to view
          their work and recover deleted items.
        </p>
        <button
          className="shrink-0 rounded-md border border-hairline px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:text-ink"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</div>
      )}

      {users === null ? (
        <div className="py-10 text-center text-[12.5px] text-ink-faint">Loading…</div>
      ) : users.length === 0 ? (
        <div className="py-6 text-center text-[12.5px] text-ink-faint">No users yet.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
          <div className="flex items-center gap-2 border-b border-hairline bg-paper px-3 py-2 text-[11px] font-semibold tracking-[0.04em] text-ink-faint uppercase">
            <span className="min-w-0 flex-1">User</span>
            <span className="w-24 text-center">Role</span>
            <span className="w-20 text-center">Estimator</span>
            <span className="w-[132px]" />
          </div>
          {users.map((u) => {
            const owner = isOwnerEmail(u.email);
            const isSelf = u.uid === user?.uid;
            const isAdmin = owner || !!maps.admins[u.uid];
            const role: Role = owner ? "owner" : (maps.roles[u.uid] ?? "member");
            const estimatorGranted = isAdmin || !!maps.entitlements[u.uid]?.estimator;
            // Don't let an admin demote the owner or themselves (lockout guard).
            const lockRole = owner || isSelf;
            return (
              <div
                key={u.uid}
                className="flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">
                    {u.name || u.email}
                    {owner && (
                      <span className="ml-2 text-[10.5px] font-medium text-ink-faint">owner</span>
                    )}
                    {isSelf && !owner && (
                      <span className="ml-2 text-[10.5px] font-medium text-ink-faint">you</span>
                    )}
                  </div>
                  <div className="truncate text-[11.5px] text-ink-soft">
                    {u.email}
                    <span className="text-ink-faint">
                      {" · last seen "}
                      {u.lastSeen ? new Date(u.lastSeen).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>

                <select
                  className="w-24 rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] disabled:opacity-50"
                  value={role}
                  disabled={lockRole}
                  onChange={(e) => onChangeRole(u, e.target.value as Role)}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  {owner && <option value="owner">Owner</option>}
                </select>

                <div className="flex w-20 justify-center">
                  <Toggle
                    checked={estimatorGranted}
                    disabled={isAdmin || !!busyEnt[u.uid]}
                    label={`Estimator access for ${u.email}`}
                    onChange={(next) => onToggleEstimator(u, next)}
                  />
                </div>

                <div className="flex w-[132px] justify-end gap-1.5">
                  <button
                    className="rounded-md border border-hairline px-2 py-1 text-[11.5px] font-medium text-ink-soft hover:bg-paper hover:text-ink"
                    onClick={() => setViewing(u)}
                    aria-label={`View ${u.email}'s data`}
                  >
                    View
                  </button>
                  {!owner && !isSelf && (
                    <button
                      className="rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
                      onClick={() => onRemoveUser(u)}
                      aria-label={`Remove ${u.email}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pending && (
        <ConfirmDialog
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          danger={pending.danger}
          onConfirm={pending.run}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
