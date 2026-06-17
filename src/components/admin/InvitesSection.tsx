"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import { createInvite, listInvites, revokeInvite, type Invite } from "@/lib/admin/invites";
import { listRegistry } from "@/lib/admin/registry";
import Toggle from "./Toggle";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Pre-authorize people by email. A grant takes effect automatically the first
    time the invited person signs in (see AccessProvider + the invite rules). */
export default function InvitesSection() {
  const { user, getToken } = useAuth();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [knownKeys, setKnownKeys] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");
  const [estimator, setEstimator] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const [inv, reg] = await Promise.all([listInvites(token), listRegistry(token)]);
      setInvites(inv);
      setKnownKeys(new Set(reg.map((u) => u.emailKey)));
    } catch (e) {
      setError((e as Error).message || "Could not load invites");
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const e = email.trim();
    if (!EMAIL_RE.test(e)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await createInvite(token, e, estimator, user?.email ?? "");
      setEmail("");
      await load();
    } catch (err) {
      setError((err as Error).message || "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key: string) {
    try {
      const token = await getToken();
      if (token) await revokeInvite(token, key);
      setInvites((cur) => cur?.filter((i) => i.emailKey !== key) ?? null);
    } catch (e) {
      setError((e as Error).message || "Revoke failed");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-ink-soft">
        Invite someone before they sign in. Access turns on automatically the first time they sign
        in with that Google account.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="name@example.com"
          className="min-w-[200px] flex-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] outline-none placeholder:text-ink-faint"
        />
        <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <Toggle checked={estimator} onChange={setEstimator} label="Grant Estimator" />
          Estimator
        </label>
        <button
          className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85 disabled:opacity-50"
          disabled={busy}
          onClick={add}
        >
          {busy ? "Inviting…" : "Invite"}
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</div>}

      {invites === null ? (
        <div className="py-10 text-center text-[12.5px] text-ink-faint">Loading…</div>
      ) : invites.length === 0 ? (
        <div className="py-6 text-center text-[12.5px] text-ink-faint">No pending invites.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
          {invites.map((i) => (
            <div
              key={i.emailKey}
              className="flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{i.email}</div>
                <div className="truncate text-[11.5px] text-ink-soft">
                  {i.estimator ? "Estimator" : "No apps"}
                  <span className="text-ink-faint">
                    {knownKeys.has(i.emailKey) ? " · has signed in" : " · not signed in yet"}
                  </span>
                </div>
              </div>
              <button
                className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
                onClick={() => revoke(i.emailKey)}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
