"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/state/auth";
import type { Project } from "@/lib/types";
import type { Estimate } from "@/lib/estimator/types";
import type { RegistryUser } from "@/lib/admin/registry";
import { fetchUserEstimates, fetchUserProjects, fetchUserTrash, purgeUserTrash } from "@/lib/admin/viewAs";
import { recoverRemoteProject } from "@/lib/account";
import { recoverRemoteEstimate } from "@/lib/estimator/account";
import { logAudit } from "@/lib/admin/audit";
import ConfirmDialog from "../ConfirmDialog";
import { ReadOnlyEstimateView, ReadOnlyProjectView } from "./ReadOnlyStores";

type Tab = "calendars" | "estimates" | "trash";

function when(ms: number): string {
  return ms ? new Date(ms).toLocaleString() : "—";
}

/**
 * Full-screen drill-down for one user. Calendars / Estimates tabs render that
 * user's docs read-only (no writes, no localStorage); the Trash tab lists
 * soft-deleted docs with a Recover action — the one write the admin makes
 * against another user's data.
 */
export default function UserDataDrawer({
  user,
  onClose,
}: {
  user: RegistryUser;
  onClose: () => void;
}) {
  const { user: actor, getToken } = useAuth();
  const [tab, setTab] = useState<Tab>("calendars");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [estimates, setEstimates] = useState<Estimate[] | null>(null);
  const [trashProjects, setTrashProjects] = useState<Project[] | null>(null);
  const [trashEstimates, setTrashEstimates] = useState<Estimate[] | null>(null);
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [openEstimate, setOpenEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [purgeAsk, setPurgeAsk] = useState<{ beforeMs?: number } | null>(null);

  const backToList = openProject || openEstimate;

  // Opening a user's data is itself an auditable event (admin reading someone
  // else's projects/estimates), logged once per open.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled || !token || !actor) return;
      logAudit(token, actor, "view_user_data", user.email);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openProject || openEstimate) {
        setOpenProject(null);
        setOpenEstimate(null);
      } else {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, openProject, openEstimate]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      if (tab === "calendars" && projects === null) {
        setProjects(await fetchUserProjects(user.uid, token));
      } else if (tab === "estimates" && estimates === null) {
        setEstimates(await fetchUserEstimates(user.uid, token));
      } else if (tab === "trash" && trashProjects === null) {
        const t = await fetchUserTrash(user.uid, token);
        setTrashProjects(t.projects);
        setTrashEstimates(t.estimates);
      }
    } catch (e) {
      setError((e as Error).message || "Could not load data");
    }
  }, [getToken, tab, user.uid, projects, estimates, trashProjects]);

  useEffect(() => {
    load();
  }, [load]);

  async function recover(kind: "project" | "estimate", id: string) {
    setBusy(id);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      if (kind === "project") {
        await recoverRemoteProject(user.uid, token, id);
        if (actor) await logAudit(token, actor, "recover_project", user.email, id);
        setTrashProjects((cur) => cur?.filter((p) => p.id !== id) ?? null);
        setProjects(null); // refetch the live list next time it's shown
      } else {
        await recoverRemoteEstimate(user.uid, token, id);
        if (actor) await logAudit(token, actor, "recover_estimate", user.email, id);
        setTrashEstimates((cur) => cur?.filter((e) => e.id !== id) ?? null);
        setEstimates(null);
      }
    } catch (e) {
      setError((e as Error).message || "Recover failed");
    } finally {
      setBusy(null);
    }
  }

  async function purge(beforeMs?: number) {
    setBusy("purge");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const n = await purgeUserTrash(user.uid, token, beforeMs);
      if (actor) {
        await logAudit(token, actor, "purge_trash", user.email, `${n.projects} calendars, ${n.estimates} estimates`);
      }
      // reload the trash view
      const t = await fetchUserTrash(user.uid, token);
      setTrashProjects(t.projects);
      setTrashEstimates(t.estimates);
    } catch (e) {
      setError((e as Error).message || "Purge failed");
    } finally {
      setBusy(null);
    }
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      role="tab"
      aria-selected={tab === id}
      className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
        tab === id ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
      }`}
      onClick={() => {
        setTab(id);
        setOpenProject(null);
        setOpenEstimate(null);
      }}
    >
      {label}
    </button>
  );

  function listRow(key: string, title: string, sub: string, action: React.ReactNode) {
    return (
      <div
        key={key}
        className="flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{title}</div>
          <div className="truncate text-[11.5px] text-ink-soft">{sub}</div>
        </div>
        {action}
      </div>
    );
  }

  const viewBtn = (onClick: () => void) => (
    <button
      className="shrink-0 rounded-md border border-hairline px-2.5 py-1 text-[11.5px] font-medium text-ink-soft hover:bg-paper hover:text-ink"
      onClick={onClick}
    >
      View
    </button>
  );

  const recoverBtn = (kind: "project" | "estimate", id: string) => (
    <button
      className="shrink-0 rounded-md bg-ink px-2.5 py-1 text-[11.5px] font-medium text-paper hover:opacity-85 disabled:opacity-50"
      disabled={busy === id}
      onClick={() => recover(kind, id)}
    >
      {busy === id ? "Recovering…" : "Recover"}
    </button>
  );

  function body() {
    if (openProject) return <ReadOnlyProjectView project={openProject} />;
    if (openEstimate) return <ReadOnlyEstimateView estimate={openEstimate} />;

    if (tab === "calendars") {
      if (projects === null) return <Loading />;
      if (projects.length === 0) return <Empty>No calendars.</Empty>;
      return (
        <List>
          {projects.map((p) =>
            listRow(
              p.id,
              p.title || "Untitled Workback",
              `${p.events.length} event${p.events.length === 1 ? "" : "s"} · ${when(p.updatedAt)}`,
              viewBtn(() => setOpenProject(p))
            )
          )}
        </List>
      );
    }
    if (tab === "estimates") {
      if (estimates === null) return <Loading />;
      if (estimates.length === 0) return <Empty>No estimates.</Empty>;
      return (
        <List>
          {estimates.map((e) =>
            listRow(
              e.id,
              e.title || "Untitled Estimate",
              `${e.columns.length} column${e.columns.length === 1 ? "" : "s"} · ${when(e.updatedAt)}`,
              viewBtn(() => setOpenEstimate(e))
            )
          )}
        </List>
      );
    }
    // trash
    if (trashProjects === null) return <Loading />;
    if (trashProjects.length === 0 && trashEstimates?.length === 0)
      return <Empty>Trash is empty.</Empty>;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-[11.5px] text-ink-faint">
            Recovered items return to the user. Purging frees storage but is permanent.
          </span>
          <button
            className="rounded-md border border-hairline px-2.5 py-1 text-[11.5px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
            disabled={busy === "purge"}
            onClick={() => setPurgeAsk({ beforeMs: Date.now() - 30 * 24 * 60 * 60 * 1000 })}
          >
            Purge &gt; 30 days
          </button>
          <button
            className="rounded-md px-2.5 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger disabled:opacity-50"
            disabled={busy === "purge"}
            onClick={() => setPurgeAsk({})}
          >
            {busy === "purge" ? "Emptying…" : "Empty trash"}
          </button>
        </div>
        <Section label="Deleted calendars">
          {trashProjects.length === 0 ? (
            <Empty>None.</Empty>
          ) : (
            <List>
              {trashProjects.map((p) =>
                listRow(
                  p.id,
                  p.title || "Untitled Workback",
                  `${p.events.length} event${p.events.length === 1 ? "" : "s"} · deleted copy`,
                  <div className="flex items-center gap-1.5">
                    {viewBtn(() => setOpenProject(p))}
                    {recoverBtn("project", p.id)}
                  </div>
                )
              )}
            </List>
          )}
        </Section>
        <Section label="Deleted estimates">
          {(trashEstimates?.length ?? 0) === 0 ? (
            <Empty>None.</Empty>
          ) : (
            <List>
              {trashEstimates!.map((e) =>
                listRow(
                  e.id,
                  e.title || "Untitled Estimate",
                  `${e.columns.length} column${e.columns.length === 1 ? "" : "s"} · deleted copy`,
                  <div className="flex items-center gap-1.5">
                    {viewBtn(() => setOpenEstimate(e))}
                    {recoverBtn("estimate", e.id)}
                  </div>
                )
              )}
            </List>
          )}
        </Section>
      </div>
    );
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex flex-col bg-paper">
      <header className="flex items-center gap-3 border-b border-hairline bg-surface px-4 py-2.5">
        <button
          className="rounded-md border border-hairline bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:text-ink"
          onClick={onClose}
        >
          ← Users
        </button>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{user.name || user.email}</div>
          <div className="truncate text-[11px] text-ink-faint">
            {user.email} · last seen {when(user.lastSeen)}
          </div>
        </div>
        <span className="ml-auto rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-soft">
          Read-only
        </span>
      </header>

      <div className="flex items-center gap-2 border-b border-hairline bg-surface px-4 py-2">
        {backToList ? (
          <button
            className="rounded-md border border-hairline px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:text-ink"
            onClick={() => {
              setOpenProject(null);
              setOpenEstimate(null);
            }}
          >
            ← Back to list
          </button>
        ) : (
          <div className="flex items-center gap-1" role="tablist">
            {tabBtn("calendars", "Calendars")}
            {tabBtn("estimates", "Estimates")}
            {tabBtn("trash", "Trash")}
          </div>
        )}
      </div>

      {error && (
        <div className="border-b border-hairline bg-red-50 px-4 py-2 text-[12px] text-danger">{error}</div>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <div className="mx-auto max-w-[1400px]">{body()}</div>
      </div>

      {purgeAsk && (
        <ConfirmDialog
          title="Permanently delete trash"
          danger
          confirmLabel="Delete permanently"
          body={
            <>
              Permanently delete {purgeAsk.beforeMs ? "trashed items older than 30 days" : "all trashed items"} for{" "}
              <strong>{user.email}</strong>? This frees storage but can&apos;t be undone.
            </>
          }
          onConfirm={() => purge(purgeAsk.beforeMs)}
          onClose={() => setPurgeAsk(null)}
        />
      )}
    </div>,
    document.body
  );
}

function Loading() {
  return <div className="py-10 text-center text-[12.5px] text-ink-faint">Loading…</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-[12.5px] text-ink-faint">{children}</div>;
}
function List({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-hairline bg-surface">{children}</div>;
}
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
        {label}
      </h4>
      {children}
    </div>
  );
}
