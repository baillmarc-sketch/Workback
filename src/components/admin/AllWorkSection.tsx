"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/state/auth";
import type { Project } from "@/lib/types";
import type { Estimate } from "@/lib/estimator/types";
import { listRegistry, type RegistryUser } from "@/lib/admin/registry";
import { listTeams, type Team } from "@/lib/admin/teams";
import { fetchAllUsersWork, type UserWork } from "@/lib/admin/viewAs";
import { logAudit } from "@/lib/admin/audit";
import { ReadOnlyEstimateView, ReadOnlyProjectView } from "./ReadOnlyStores";

type View = "person" | "team";
type OpenItem =
  | { kind: "project"; doc: Project; owner: RegistryUser }
  | { kind: "estimate"; doc: Estimate; owner: RegistryUser };

function when(ms: number): string {
  return ms ? new Date(ms).toLocaleDateString() : "—";
}

function displayName(u: RegistryUser): string {
  return u.name || u.email;
}

/**
 * "God mode" — every user's calendars and estimates in one read-only browser,
 * grouped by person or by team, with search. Reuses the admin view-as read path
 * (admins can read any /users/{uid}); opening an item logs view_user_data once
 * per owner.
 */
export default function AllWorkSection() {
  const { user: actor, getToken } = useAuth();
  const [work, setWork] = useState<UserWork[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("person");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<OpenItem | null>(null);
  const loggedRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const [registry, teamList] = await Promise.all([listRegistry(token), listTeams(token)]);
      setTeams(teamList);
      setWork(await fetchAllUsersWork(token, registry));
    } catch (e) {
      setError((e as Error).message || "Could not load work");
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  // Escape closes the open item (back to the list).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const openItem = useCallback(
    async (item: OpenItem) => {
      setOpen(item);
      if (!actor || loggedRef.current.has(item.owner.uid)) return;
      loggedRef.current.add(item.owner.uid);
      const token = await getToken();
      if (token) logAudit(token, actor, "view_user_data", item.owner.email);
    },
    [actor, getToken]
  );

  const byUid = useMemo(() => {
    const m = new Map<string, UserWork>();
    for (const w of work ?? []) m.set(w.user.uid, w);
    return m;
  }, [work]);

  const totals = useMemo(() => {
    let calendars = 0;
    let estimates = 0;
    let failed = 0;
    for (const w of work ?? []) {
      calendars += w.projects.length;
      estimates += w.estimates.length;
      if (w.failed) failed++;
    }
    return { calendars, estimates, failed, users: work?.length ?? 0 };
  }, [work]);

  const q = query.trim().toLowerCase();
  const ownerMatches = (u: RegistryUser) =>
    u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q);

  // Rows for one user's work, optionally forced visible (e.g. team-name match).
  function rowsFor(w: UserWork, forceShow: boolean, showOwner: boolean): React.ReactNode[] {
    const rows: React.ReactNode[] = [];
    const show = (title: string) => forceShow || !q || title.toLowerCase().includes(q) || ownerMatches(w.user);
    for (const p of w.projects) {
      const title = p.title || "Untitled Workback";
      if (!show(title)) continue;
      rows.push(
        itemRow(`p:${w.user.uid}:${p.id}`, "Calendar", title, `${p.events.length} event${p.events.length === 1 ? "" : "s"} · ${when(p.updatedAt)}`, showOwner ? w.user : null, () =>
          openItem({ kind: "project", doc: p, owner: w.user })
        )
      );
    }
    for (const e of w.estimates) {
      const title = e.title || "Untitled Estimate";
      if (!show(title)) continue;
      rows.push(
        itemRow(`e:${w.user.uid}:${e.id}`, "Estimate", title, `${e.columns.length} column${e.columns.length === 1 ? "" : "s"} · ${when(e.updatedAt)}`, showOwner ? w.user : null, () =>
          openItem({ kind: "estimate", doc: e, owner: w.user })
        )
      );
    }
    return rows;
  }

  if (open) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-hairline px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:text-ink"
            onClick={() => setOpen(null)}
          >
            ← Back to all work
          </button>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">
              {open.kind === "project" ? open.doc.title || "Untitled Workback" : open.doc.title || "Untitled Estimate"}
            </div>
            <div className="truncate text-[11px] text-ink-faint">{displayName(open.owner)} · {open.owner.email}</div>
          </div>
          <span className="ml-auto rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-soft">Read-only</span>
        </div>
        {open.kind === "project" ? (
          <ReadOnlyProjectView project={open.doc} />
        ) : (
          <ReadOnlyEstimateView estimate={open.doc} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-[12.5px] text-ink-soft">
          Everyone&apos;s calendars and estimates, read-only.{" "}
          {work && (
            <span className="text-ink-faint">
              {totals.users} user{totals.users === 1 ? "" : "s"} · {totals.calendars} calendars · {totals.estimates} estimates
            </span>
          )}
        </p>
        <div className="flex items-center gap-1" role="tablist" aria-label="Group by">
          {(["person", "team"] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                view === v ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
              onClick={() => setView(v)}
            >
              {v === "person" ? "By person" : "By team"}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search work, people…"
          aria-label="Search all work"
          className="min-w-[160px] rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-ink-faint"
        />
        <button
          className="shrink-0 rounded-md border border-hairline px-2.5 py-1 text-[12px] font-medium text-ink-soft hover:text-ink"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</div>}
      {work && totals.failed > 0 && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-[12px] text-ink-soft">
          Couldn&apos;t read {totals.failed} user{totals.failed === 1 ? "" : "s"} — they&apos;re skipped below.
        </div>
      )}

      {work === null ? (
        <div className="py-10 text-center text-[12.5px] text-ink-faint">Loading everyone&apos;s work…</div>
      ) : view === "person" ? (
        <PersonView work={work} rowsFor={rowsFor} />
      ) : (
        <TeamView teams={teams} byUid={byUid} work={work} q={q} rowsFor={rowsFor} />
      )}
    </div>
  );
}

function itemRow(
  key: string,
  kind: string,
  title: string,
  sub: string,
  owner: RegistryUser | null,
  onOpen: () => void
): React.ReactNode {
  return (
    <div key={key} className="flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0">
      <span className="shrink-0 rounded bg-paper px-1.5 py-0.5 text-[10.5px] font-medium text-ink-faint">{kind}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{title}</div>
        <div className="truncate text-[11.5px] text-ink-soft">
          {owner ? `${displayName(owner)} · ` : ""}
          {sub}
        </div>
      </div>
      <button
        className="shrink-0 rounded-md border border-hairline px-2.5 py-1 text-[11.5px] font-medium text-ink-soft hover:bg-paper hover:text-ink"
        onClick={onOpen}
        aria-label={`Open ${title}`}
      >
        View
      </button>
    </div>
  );
}

function Group({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline bg-paper px-3 py-2">
        <span className="truncate text-[12.5px] font-semibold">{title}</span>
        {sub && <span className="ml-auto shrink-0 text-[11px] text-ink-faint">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-4 text-center text-[12px] text-ink-faint">{children}</div>;
}

function PersonView({
  work,
  rowsFor,
}: {
  work: UserWork[];
  rowsFor: (w: UserWork, forceShow: boolean, showOwner: boolean) => React.ReactNode[];
}) {
  const sorted = [...work].sort((a, b) => displayName(a.user).localeCompare(displayName(b.user)));
  const groups = sorted
    .map((w) => ({ w, rows: rowsFor(w, false, false) }))
    .filter((g) => g.rows.length > 0);
  if (groups.length === 0) return <Empty>No matching work.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      {groups.map(({ w, rows }) => (
        <Group
          key={w.user.uid}
          title={displayName(w.user)}
          sub={`${w.projects.length} calendars · ${w.estimates.length} estimates`}
        >
          {rows}
        </Group>
      ))}
    </div>
  );
}

function TeamView({
  teams,
  byUid,
  work,
  q,
  rowsFor,
}: {
  teams: Team[];
  byUid: Map<string, UserWork>;
  work: UserWork[];
  q: string;
  rowsFor: (w: UserWork, forceShow: boolean, showOwner: boolean) => React.ReactNode[];
}) {
  const inAnyTeam = new Set<string>();
  for (const t of teams) for (const uid of Object.keys(t.members)) inAnyTeam.add(uid);

  const blocks: React.ReactNode[] = [];

  for (const t of [...teams].sort((a, b) => a.name.localeCompare(b.name))) {
    const teamNameMatch = !!q && t.name.toLowerCase().includes(q);
    const memberUws = Object.keys(t.members)
      .map((uid) => byUid.get(uid))
      .filter((w): w is UserWork => !!w)
      .sort((a, b) => displayName(a.user).localeCompare(displayName(b.user)));
    const rows = memberUws.flatMap((w) => rowsFor(w, teamNameMatch, true));
    const memberCount = Object.keys(t.members).length;
    if (rows.length === 0 && q && !teamNameMatch) continue; // filtered out
    blocks.push(
      <Group key={t.id} title={t.name} sub={`${memberCount} member${memberCount === 1 ? "" : "s"}${t.grantsEstimator ? " · grants Estimator" : ""}`}>
        {rows.length > 0 ? rows : <Empty>No work yet.</Empty>}
      </Group>
    );
  }

  // Users in no team.
  const unassigned = work
    .filter((w) => !inAnyTeam.has(w.user.uid))
    .sort((a, b) => displayName(a.user).localeCompare(displayName(b.user)));
  const unRows = unassigned.flatMap((w) => rowsFor(w, false, true));
  if (unRows.length > 0) {
    blocks.push(
      <Group key="__unassigned" title="Unassigned" sub={`${unassigned.length} not in a team`}>
        {unRows}
      </Group>
    );
  }

  if (blocks.length === 0) return <Empty>No matching work.</Empty>;
  return <div className="flex flex-col gap-2">{blocks}</div>;
}
