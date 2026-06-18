"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import { deleteRemoteBidSpec } from "@/lib/bidSpecs/account";
import {
  deleteBidSpec,
  duplicateBidSpec,
  listBidSpecs,
  loadBidSpec,
  migrate,
  newBidSpec,
  resetToSample,
  saveBidSpec,
} from "@/lib/bidSpecs/storage";
import type { BidSpec } from "@/lib/bidSpecs/types";
import { listMyTeams, type MyTeam } from "@/lib/admin/teams";
import {
  deleteTeamDoc,
  listTeamDocs,
  listTeamTrash,
  purgeTeamDoc,
  recoverTeamDoc,
  saveTeamDoc,
} from "@/lib/teamWorkspace";
import { notify } from "@/lib/notify";
import type { Workspace } from "@/state/store";
import { useBidSpec } from "@/state/bidSpecsStore";
import Modal from "../Modal";

type Scope = { kind: "personal" } | { kind: "team"; teamId: string; name: string };

export default function BidSpecsListDialog({ onClose }: { onClose: () => void }) {
  const { spec, open, openInWorkspace, workspace } = useBidSpec();
  const { user, getToken } = useAuth();
  const [, bump] = useState(0);
  const specs = listBidSpecs();

  const [myTeams, setMyTeams] = useState<MyTeam[]>([]);
  const [scope, setScope] = useState<Scope>(
    workspace.kind === "team" ? { kind: "team", teamId: workspace.teamId, name: "Team" } : { kind: "personal" }
  );
  const [teamSpecs, setTeamSpecs] = useState<BidSpec[] | null>(null);
  const [teamErr, setTeamErr] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [teamTrash, setTeamTrash] = useState<BidSpec[] | null>(null);

  const inTeam = scope.kind === "team";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const teams = await listMyTeams(user.uid, token);
      if (!cancelled) setMyTeams(teams);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, getToken]);

  const loadTeam = useCallback(
    async (teamId: string) => {
      setTeamSpecs(null);
      setTeamErr(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        const raw = await listTeamDocs(teamId, "bid-specs", token);
        setTeamSpecs(migrateAll(raw));
      } catch (e) {
        setTeamErr((e as Error).message || "Couldn't load this team's workspace");
        setTeamSpecs([]);
      }
    },
    [getToken]
  );

  const loadTrash = useCallback(
    async (teamId: string) => {
      setTeamTrash(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        setTeamTrash(migrateAll(await listTeamTrash(teamId, "bid-specs", token)));
      } catch {
        setTeamTrash([]);
      }
    },
    [getToken]
  );

  useEffect(() => {
    setShowTrash(false);
    if (scope.kind === "team") loadTeam(scope.teamId);
  }, [scope, loadTeam]);

  useEffect(() => {
    if (showTrash && scope.kind === "team") loadTrash(scope.teamId);
  }, [showTrash, scope, loadTrash]);

  async function createInTeam(teamId: string) {
    let s = newBidSpec();
    if (user) s = { ...s, createdBy: { uid: user.uid, name: user.name || user.email || "Someone" } };
    const token = await getToken();
    if (!token) return notify("Sign in to create a team bid spec.");
    try {
      await saveTeamDoc(teamId, "bid-specs", s, token);
      openInWorkspace(s, { kind: "team", teamId } satisfies Workspace);
      onClose();
    } catch {
      notify("Couldn't create the team bid spec — check your connection.");
    }
  }

  return (
    <Modal title="Bid Specs" onClose={onClose} width={460}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Workspace</span>
          <button
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${
              !inTeam ? "bg-ink text-paper" : "border border-hairline text-ink-soft hover:text-ink"
            }`}
            onClick={() => setScope({ kind: "personal" })}
          >
            Personal
          </button>
          {myTeams.map((t) => (
            <button
              key={t.id}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${
                inTeam && scope.teamId === t.id
                  ? "bg-ink text-paper"
                  : "border border-hairline text-ink-soft hover:text-ink"
              }`}
              onClick={() => setScope({ kind: "team", teamId: t.id, name: t.name })}
            >
              {t.name}
            </button>
          ))}
        </div>

        <button
          className="self-start rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
          onClick={() => {
            if (inTeam && scope.kind === "team") {
              createInTeam(scope.teamId);
            } else {
              const s = newBidSpec();
              saveBidSpec(s);
              open(s);
              onClose();
            }
          }}
        >
          + New {inTeam ? "team bid specs" : "bid specs"}
        </button>

        {teamErr && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{teamErr}</div>}

        {inTeam ? (
          <>
            <div className="flex items-center gap-1.5 text-[11.5px]">
              <button
                className={`rounded-md px-2 py-0.5 font-medium ${!showTrash ? "bg-paper text-ink" : "text-ink-faint hover:text-ink"}`}
                onClick={() => setShowTrash(false)}
              >
                Bid specs
              </button>
              <button
                className={`rounded-md px-2 py-0.5 font-medium ${showTrash ? "bg-paper text-ink" : "text-ink-faint hover:text-ink"}`}
                onClick={() => setShowTrash(true)}
              >
                Trash
              </button>
            </div>
            {showTrash ? (
              <TeamTrashList
                specs={teamTrash}
                onRecover={async (s) => {
                  if (scope.kind !== "team") return;
                  const token = await getToken();
                  if (!token) return;
                  try {
                    await recoverTeamDoc(scope.teamId, "bid-specs", s, token);
                    setTeamTrash((cur) => cur?.filter((x) => x.id !== s.id) ?? null);
                    setTeamSpecs((cur) => (cur ? [s, ...cur] : cur));
                  } catch {
                    notify("Couldn't recover — check your connection.");
                  }
                }}
                onPurge={async (s) => {
                  if (scope.kind !== "team") return;
                  if (!confirm(`Permanently delete “${s.title || "Untitled Bid Specs"}”? This can't be undone.`)) return;
                  const token = await getToken();
                  if (!token) return;
                  try {
                    await purgeTeamDoc(scope.teamId, "bid-specs", s.id, token);
                    setTeamTrash((cur) => cur?.filter((x) => x.id !== s.id) ?? null);
                  } catch {
                    notify("Couldn't delete — check your connection.");
                  }
                }}
              />
            ) : (
              <TeamList
                specs={teamSpecs}
                currentId={spec?.id ?? null}
                onOpen={(s) => {
                  if (scope.kind === "team") openInWorkspace(s, { kind: "team", teamId: scope.teamId });
                  onClose();
                }}
                onDelete={async (s) => {
                  if (scope.kind !== "team") return;
                  if (!confirm(`Delete “${s.title || "Untitled Bid Specs"}” from this team? It can be recovered from Trash.`)) return;
                  const token = await getToken();
                  if (token) {
                    try {
                      await deleteTeamDoc(scope.teamId, "bid-specs", s, token);
                      setTeamSpecs((cur) => cur?.filter((x) => x.id !== s.id) ?? null);
                    } catch {
                      notify("Couldn't delete — check your connection.");
                    }
                  }
                }}
              />
            )}
          </>
        ) : specs.length === 0 ? (
          <div className="py-4 text-center text-[12.5px] text-ink-faint">No saved bid specs yet.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hairline">
            {specs.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0 ${
                  s.id === spec?.id ? "bg-paper" : ""
                }`}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    const loaded = loadBidSpec(s.id);
                    if (loaded) {
                      open(loaded);
                      onClose();
                    }
                  }}
                >
                  <div className="truncate text-[13px] font-semibold">
                    {s.title || "Untitled Bid Specs"}
                    {s.id === spec?.id && <span className="ml-2 text-[10.5px] font-medium text-ink-faint">current</span>}
                  </div>
                  <div className="truncate text-[11.5px] text-ink-soft">
                    {s.subtitle || `${s.specCount} spot${s.specCount === 1 ? "" : "s"}`}
                    <span className="text-ink-faint">
                      {" · "}
                      {s.clauseCount} term{s.clauseCount === 1 ? "" : "s"}
                      {" · "}
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
                <button
                  className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-paper hover:text-ink"
                  title="Make an independent copy"
                  onClick={() => {
                    const copy = duplicateBidSpec(s.id);
                    if (copy) {
                      open(copy);
                      onClose();
                    }
                  }}
                >
                  Duplicate
                </button>
                {s.id !== spec?.id && (
                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
                    onClick={() => {
                      if (confirm(`Delete “${s.title || "Untitled Bid Specs"}”? This can't be undone.`)) {
                        deleteBidSpec(s.id);
                        if (user) {
                          getToken()
                            .then((t) => (t ? deleteRemoteBidSpec(user.uid, t, s.id) : undefined))
                            .catch(() => {});
                        }
                        bump((n) => n + 1);
                      }
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!inTeam && (
          <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2.5">
            {user ? <span className="text-[11px] text-ink-faint">Synced to {user.email}</span> : <span />}
            <button
              className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
              title="Delete every bid spec and load the scrubbed sample"
              onClick={() => {
                if (!confirm("Reset all bid specs? This deletes every sheet (including synced copies) and loads a fresh sample. This can't be undone.")) return;
                const oldIds = listBidSpecs().map((s) => s.id);
                const sample = resetToSample();
                if (user) {
                  getToken()
                    .then((t) => {
                      if (t) for (const id of oldIds) deleteRemoteBidSpec(user.uid, t, id).catch(() => {});
                    })
                    .catch(() => {});
                }
                open(sample);
                onClose();
              }}
            >
              Reset &amp; load sample
            </button>
          </div>
        )}
        {inTeam && (
          <div className="text-[11px] text-ink-faint">
            Shared with everyone on this team · last edit wins · who&apos;s viewing shows live
          </div>
        )}
      </div>
    </Modal>
  );
}

function migrateAll(raw: Record<string, object>): BidSpec[] {
  return Object.values(raw)
    .map((d) => {
      try {
        return migrate(d);
      } catch {
        return null;
      }
    })
    .filter((s): s is BidSpec => !!s)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function TeamList({
  specs,
  currentId,
  onOpen,
  onDelete,
}: {
  specs: BidSpec[] | null;
  currentId: string | null;
  onOpen: (s: BidSpec) => void;
  onDelete: (s: BidSpec) => void;
}) {
  if (specs === null) return <div className="py-4 text-center text-[12.5px] text-ink-faint">Loading…</div>;
  if (specs.length === 0) return <div className="py-4 text-center text-[12.5px] text-ink-faint">No team bid specs yet.</div>;
  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      {specs.map((s) => (
        <div
          key={s.id}
          className={`flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0 ${
            s.id === currentId ? "bg-paper" : ""
          }`}
        >
          <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(s)}>
            <div className="truncate text-[13px] font-semibold">
              {s.title || "Untitled Bid Specs"}
              {s.id === currentId && <span className="ml-2 text-[10.5px] font-medium text-ink-faint">current</span>}
            </div>
            <div className="truncate text-[11.5px] text-ink-soft">
              {s.specs.length} spot{s.specs.length === 1 ? "" : "s"}
              {s.createdBy?.name && <span className="text-ink-faint"> · by {s.createdBy.name}</span>}
            </div>
          </button>
          <button
            className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
            onClick={() => onDelete(s)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

function TeamTrashList({
  specs,
  onRecover,
  onPurge,
}: {
  specs: BidSpec[] | null;
  onRecover: (s: BidSpec) => void;
  onPurge: (s: BidSpec) => void;
}) {
  if (specs === null) return <div className="py-4 text-center text-[12.5px] text-ink-faint">Loading…</div>;
  if (specs.length === 0) return <div className="py-4 text-center text-[12.5px] text-ink-faint">Trash is empty.</div>;
  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      {specs.map((s) => (
        <div key={s.id} className="flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{s.title || "Untitled Bid Specs"}</div>
            <div className="truncate text-[11.5px] text-ink-soft">
              {s.specs.length} spot{s.specs.length === 1 ? "" : "s"}
              {s.createdBy?.name && <span className="text-ink-faint"> · by {s.createdBy.name}</span>}
            </div>
          </div>
          <button
            className="shrink-0 rounded-md bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-paper hover:opacity-85"
            onClick={() => onRecover(s)}
          >
            Recover
          </button>
          <button
            className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
            onClick={() => onPurge(s)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
