"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import AccountButton from "../AccountButton";
import { setApp } from "@/lib/toolkit";
import { isOwnerUidPinned, setOwnerUid } from "@/lib/admin/users";
import { logAudit } from "@/lib/admin/audit";
import { listAccessRequests } from "@/lib/admin/requests";
import UsersSection from "./UsersSection";
import InvitesSection from "./InvitesSection";
import RequestsSection from "./RequestsSection";
import TeamsSection from "./TeamsSection";
import AuditSection from "./AuditSection";

type Section = "requests" | "users" | "invites" | "teams" | "activity";

/** Admin page shell: a sub-nav over Requests / Users / Invites / Teams /
    Activity, plus an account strip that surfaces the owner's UID and the
    UID-recovery bootstrap. */
export default function AdminApp() {
  const { user, getToken } = useAuth();
  const [section, setSection] = useState<Section>("requests");
  const [pinned, setPinned] = useState<boolean | null>(null);
  const [pinning, setPinning] = useState(false);
  const [requestCount, setRequestCount] = useState<number | null>(null);

  // Pending-request count for the tab badge — loaded once; RequestsSection keeps
  // it live as the owner approves/dismisses.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      try {
        const list = await listAccessRequests(token);
        if (!cancelled) setRequestCount(list.length);
      } catch {
        /* a transient failure just leaves the badge off */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      const token = await getToken();
      if (!token || cancelled) return;
      const p = await isOwnerUidPinned(user.uid, token);
      if (!cancelled) setPinned(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, getToken]);

  const pin = useCallback(async () => {
    if (!user) return;
    setPinning(true);
    try {
      const token = await getToken();
      if (token) {
        await setOwnerUid(user.uid, token);
        await logAudit(token, user, "pin_owner_uid", user.uid);
        setPinned(true);
      }
    } catch {
      // leave pinned as-is; the button stays available to retry
    } finally {
      setPinning(false);
    }
  }, [user, getToken]);

  const navBtn = (id: Section, label: string, badge?: number | null) => (
    <button
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
        section === id ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
      }`}
      onClick={() => setSection(id)}
    >
      {label}
      {!!badge && (
        <span
          className={`min-w-[16px] rounded-full px-1 text-center text-[10.5px] font-semibold leading-[16px] ${
            section === id ? "bg-paper text-ink" : "bg-ink text-paper"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold">Admin</h1>
          <p className="text-[12px] text-ink-faint">Manage access, users, and teams.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink"
            onClick={() => setApp("workback")}
          >
            ← Workback
          </button>
          <AccountButton />
        </div>
      </header>

      {user && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-[12px]">
          <span className="text-ink-soft">Your UID</span>
          <code className="rounded bg-paper px-1.5 py-0.5 text-[11px]">{user.uid}</code>
          {pinned === false && (
            <button
              className="ml-auto rounded-md border border-hairline px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
              disabled={pinning}
              onClick={pin}
              title="Pin this account by UID: it can re-seed itself as admin even if /admins is wiped, and it can't be removed from admins"
            >
              {pinning ? "Enabling…" : "Enable UID recovery"}
            </button>
          )}
          {pinned === true && (
            <span className="ml-auto text-[11px] text-ink-faint">UID recovery enabled</span>
          )}
        </div>
      )}

      <div className="mb-4 flex items-center gap-1 border-b border-hairline pb-2" role="tablist">
        {navBtn("requests", "Requests", requestCount)}
        {navBtn("users", "Users")}
        {navBtn("invites", "Invites")}
        {navBtn("teams", "Teams")}
        {navBtn("activity", "Activity")}
      </div>

      {section === "requests" && <RequestsSection onCount={setRequestCount} />}
      {section === "users" && <UsersSection />}
      {section === "invites" && <InvitesSection />}
      {section === "teams" && <TeamsSection />}
      {section === "activity" && <AuditSection />}
    </div>
  );
}
