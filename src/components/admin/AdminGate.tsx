"use client";

import { useState } from "react";
import { useAuth } from "@/state/auth";
import { useAccess } from "@/state/access";
import { isOwner } from "@/lib/entitlements";
import { setApp } from "@/lib/toolkit";
import { setAdmin } from "@/lib/admin/users";
import { logAudit } from "@/lib/admin/audit";
import AccountButton from "../AccountButton";

/**
 * Gates the Admin page to administrators. The owner account can self-seed its
 * own admin record here (the "Claim access" bootstrap) — the database rules
 * allow the hardcoded owner email to write only its own /admins node, which
 * solves the chicken-and-egg of an empty /admins with no backend.
 */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, ready: authReady, getToken } = useAuth();
  const { snapshot, ready: accessReady, refresh } = useAccess();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gate on the DB-backed admin record (not the owner-inclusive flag): the
  // security rules authorize reads/writes only when /admins/{uid} actually
  // exists, so the owner must seed it before the admin data calls will work.
  if (snapshot.isAdmin) return <>{children}</>;

  const ready = authReady && accessReady;
  const owner = isOwner(user);

  async function claim() {
    if (!user) return;
    setClaiming(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await setAdmin(user.uid, token, true);
      await logAudit(token, user, "claim_owner", user.uid);
      refresh();
    } catch (e) {
      setError((e as Error).message || "Could not claim access");
      setClaiming(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h2 className="font-display text-[20px] font-semibold">Admin</h2>
      <p className="mt-2 max-w-sm text-[13px] text-ink-soft">
        {!ready
          ? "Checking your account…"
          : owner
            ? "You're the owner. Claim admin access to manage users, access, and teams."
            : user
              ? "This area is restricted to administrators."
              : "Sign in with an administrator account to continue."}
      </p>
      <div className="mt-5 flex items-center gap-2">
        <button
          className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
          onClick={() => setApp("workback")}
        >
          ← Workback
        </button>
        {ready && owner ? (
          <button
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-medium text-paper hover:opacity-85 disabled:opacity-50"
            onClick={claim}
            disabled={claiming}
          >
            {claiming ? "Claiming…" : "Claim admin access"}
          </button>
        ) : (
          <AccountButton />
        )}
      </div>
      {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
