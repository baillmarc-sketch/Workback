"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/auth";
import { deleteRemoteEstimate } from "@/lib/estimator/account";
import {
  deleteEstimate,
  duplicateEstimate,
  listEstimates,
  loadEstimate,
  migrate,
  newEstimate,
  resetToSampleProjects,
  saveEstimate,
} from "@/lib/estimator/storage";
import { ESTIMATE_TEMPLATES } from "@/lib/estimator/templates";
import { listMyTeams, type MyTeam } from "@/lib/admin/teams";
import {
  deleteTeamDoc,
  listTeamDocs,
  listTeamTrash,
  purgeTeamDoc,
  recoverTeamDoc,
  saveTeamDoc,
} from "@/lib/teamWorkspace";
import type { Estimate } from "@/lib/estimator/types";
import { useEstimate } from "@/state/estimateStore";
import { notify } from "@/lib/notify";
import type { Workspace } from "@/state/store";
import Modal from "../Modal";

type Scope = { kind: "personal" } | { kind: "team"; teamId: string; name: string };

export default function EstimatesDialog({ onClose }: { onClose: () => void }) {
  const { estimate, open, openInWorkspace, workspace } = useEstimate();
  const { user, getToken } = useAuth();
  const [, bump] = useState(0);
  const [picking, setPicking] = useState(false);

  const [myTeams, setMyTeams] = useState<MyTeam[]>([]);
  const [scope, setScope] = useState<Scope>(
    workspace.kind === "team" ? { kind: "team", teamId: workspace.teamId, name: "Team" } : { kind: "personal" }
  );
  const [teamEstimates, setTeamEstimates] = useState<Estimate[] | null>(null);
  const [teamErr, setTeamErr] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [teamTrash, setTeamTrash] = useState<Estimate[] | null>(null);

  const estimates = listEstimates();
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
      setTeamEstimates(null);
      setTeamErr(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        const raw = await listTeamDocs(teamId, "estimator", token);
        const docs = Object.values(raw)
          .map((d) => {
            try {
              return migrate(d);
            } catch {
              return null;
            }
          })
          .filter((e): e is Estimate => !!e)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setTeamEstimates(docs);
      } catch (e) {
        setTeamErr((e as Error).message || "Couldn't load this team's workspace");
        setTeamEstimates([]);
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
        const raw = await listTeamTrash(teamId, "estimator", token);
        const docs = Object.values(raw)
          .map((d) => {
            try {
              return migrate(d);
            } catch {
              return null;
            }
          })
          .filter((e): e is Estimate => !!e)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setTeamTrash(docs);
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

  async function createInTeam(teamId: string, templateId: Parameters<typeof newEstimate>[0]) {
    let e = newEstimate(templateId);
    if (user) e = { ...e, createdBy: { uid: user.uid, name: user.name || user.email || "Someone" } };
    const token = await getToken();
    if (!token) return notify("Sign in to create a team estimate.");
    try {
      await saveTeamDoc(teamId, "estimator", e, token);
      openInWorkspace(e, { kind: "team", teamId } satisfies Workspace);
      onClose();
    } catch {
      notify("Couldn't create the team estimate — check your connection.");
    }
  }

  return (
    <Modal title="Estimates" onClose={onClose} width={460}>
      <div className="flex flex-col gap-3">
        {/* Workspace switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Workspace</span>
          <button
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${
              !inTeam ? "bg-ink text-paper" : "border border-hairline text-ink-soft hover:text-ink"
            }`}
            onClick={() => {
              setScope({ kind: "personal" });
              setPicking(false);
            }}
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
              onClick={() => {
                setScope({ kind: "team", teamId: t.id, name: t.name });
                setPicking(false);
              }}
            >
              {t.name}
            </button>
          ))}
        </div>

        {!picking ? (
          <button
            className="self-start rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            onClick={() => setPicking(true)}
          >
            + New {inTeam ? "team estimate" : "estimate"}
          </button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Start from</span>
            <div className="flex flex-wrap gap-1.5">
              {ESTIMATE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  title={t.description}
                  className="rounded-md border border-hairline px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-paper"
                  onClick={() => {
                    if (inTeam && scope.kind === "team") {
                      createInTeam(scope.teamId, t.id);
                    } else {
                      const e = newEstimate(t.id);
                      saveEstimate(e);
                      open(e);
                      onClose();
                    }
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {teamErr && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{teamErr}</div>}

        {inTeam ? (
          <>
            <div className="flex items-center gap-1.5 text-[11.5px]">
              <button
                className={`rounded-md px-2 py-0.5 font-medium ${!showTrash ? "bg-paper text-ink" : "text-ink-faint hover:text-ink"}`}
                onClick={() => setShowTrash(false)}
              >
                Estimates
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
                estimates={teamTrash}
                onRecover={async (e) => {
                  if (scope.kind !== "team") return;
                  const token = await getToken();
                  if (!token) return;
                  try {
                    await recoverTeamDoc(scope.teamId, "estimator", e, token);
                    setTeamTrash((cur) => cur?.filter((x) => x.id !== e.id) ?? null);
                    setTeamEstimates((cur) => (cur ? [e, ...cur] : cur));
                  } catch {
                    notify("Couldn't recover — check your connection.");
                  }
                }}
                onPurge={async (e) => {
                  if (scope.kind !== "team") return;
                  if (!confirm(`Permanently delete “${e.title || "Untitled Estimate"}”? This can't be undone.`)) return;
                  const token = await getToken();
                  if (!token) return;
                  try {
                    await purgeTeamDoc(scope.teamId, "estimator", e.id, token);
                    setTeamTrash((cur) => cur?.filter((x) => x.id !== e.id) ?? null);
                  } catch {
                    notify("Couldn't delete — check your connection.");
                  }
                }}
              />
            ) : (
              <TeamList
                estimates={teamEstimates}
                currentId={estimate?.id ?? null}
                onOpen={(e) => {
                  if (scope.kind === "team") openInWorkspace(e, { kind: "team", teamId: scope.teamId });
                  onClose();
                }}
                onDelete={async (e) => {
                  if (scope.kind !== "team") return;
                  if (!confirm(`Delete “${e.title || "Untitled Estimate"}” from this team? It can be recovered from Trash.`)) return;
                  const token = await getToken();
                  if (token) {
                    try {
                      await deleteTeamDoc(scope.teamId, "estimator", e, token);
                      setTeamEstimates((cur) => cur?.filter((x) => x.id !== e.id) ?? null);
                    } catch {
                      notify("Couldn't delete — check your connection.");
                    }
                  }
                }}
              />
            )}
          </>
        ) : estimates.length === 0 ? (
          <div className="py-4 text-center text-[12.5px] text-ink-faint">No saved estimates yet.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hairline">
            {estimates.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0 ${
                  s.id === estimate?.id ? "bg-paper" : ""
                }`}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    const e = loadEstimate(s.id);
                    if (e) {
                      open(e);
                      onClose();
                    }
                  }}
                >
                  <div className="truncate text-[13px] font-semibold">
                    {s.title || "Untitled Estimate"}
                    {s.id === estimate?.id && (
                      <span className="ml-2 text-[10.5px] font-medium text-ink-faint">current</span>
                    )}
                  </div>
                  <div className="truncate text-[11.5px] text-ink-soft">
                    {s.subtitle || `${s.lineItemCount} line item${s.lineItemCount === 1 ? "" : "s"}`}
                    <span className="text-ink-faint">
                      {" · "}
                      {s.columnCount} column{s.columnCount === 1 ? "" : "s"}
                      {" · "}
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
                <button
                  className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-paper hover:text-ink"
                  title="Make an independent copy"
                  onClick={() => {
                    const e = duplicateEstimate(s.id);
                    if (e) {
                      open(e);
                      onClose();
                    }
                  }}
                >
                  Duplicate
                </button>
                {s.id !== estimate?.id && (
                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
                    onClick={() => {
                      if (confirm(`Delete “${s.title || "Untitled Estimate"}”? You can recover it from the admin trash.`)) {
                        const doc = loadEstimate(s.id);
                        deleteEstimate(s.id);
                        if (user) {
                          getToken()
                            .then((t) => (t ? deleteRemoteEstimate(user.uid, t, s.id, doc) : undefined))
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
              title="Delete every estimate and load the film + activation samples"
              onClick={() => {
                if (
                  !confirm(
                    "Reset all estimates? This deletes every project (including synced copies) and loads two fresh samples — Film and Activation. This can't be undone."
                  )
                )
                  return;
                const oldIds = listEstimates().map((s) => s.id);
                const { film } = resetToSampleProjects();
                if (user) {
                  getToken()
                    .then((t) => {
                      if (t) for (const id of oldIds) deleteRemoteEstimate(user.uid, t, id).catch(() => {});
                    })
                    .catch(() => {});
                }
                open(film);
                onClose();
              }}
            >
              Reset &amp; load samples
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

function TeamTrashList({
  estimates,
  onRecover,
  onPurge,
}: {
  estimates: Estimate[] | null;
  onRecover: (e: Estimate) => void;
  onPurge: (e: Estimate) => void;
}) {
  if (estimates === null) {
    return <div className="py-4 text-center text-[12.5px] text-ink-faint">Loading…</div>;
  }
  if (estimates.length === 0) {
    return <div className="py-4 text-center text-[12.5px] text-ink-faint">Trash is empty.</div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      {estimates.map((e) => {
        const lines = Object.keys(e.lineItems).length;
        return (
          <div key={e.id} className="flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{e.title || "Untitled Estimate"}</div>
              <div className="truncate text-[11.5px] text-ink-soft">
                {lines} line item{lines === 1 ? "" : "s"}
                {e.createdBy?.name && <span className="text-ink-faint"> · by {e.createdBy.name}</span>}
              </div>
            </div>
            <button
              className="shrink-0 rounded-md bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-paper hover:opacity-85"
              onClick={() => onRecover(e)}
            >
              Recover
            </button>
            <button
              className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
              onClick={() => onPurge(e)}
            >
              Delete
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TeamList({
  estimates,
  currentId,
  onOpen,
  onDelete,
}: {
  estimates: Estimate[] | null;
  currentId: string | null;
  onOpen: (e: Estimate) => void;
  onDelete: (e: Estimate) => void;
}) {
  if (estimates === null) {
    return <div className="py-4 text-center text-[12.5px] text-ink-faint">Loading…</div>;
  }
  if (estimates.length === 0) {
    return <div className="py-4 text-center text-[12.5px] text-ink-faint">No team estimates yet.</div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      {estimates.map((e) => {
        const lines = Object.keys(e.lineItems).length;
        return (
          <div
            key={e.id}
            className={`flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0 ${
              e.id === currentId ? "bg-paper" : ""
            }`}
          >
            <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(e)}>
              <div className="truncate text-[13px] font-semibold">
                {e.title || "Untitled Estimate"}
                {e.id === currentId && (
                  <span className="ml-2 text-[10.5px] font-medium text-ink-faint">current</span>
                )}
              </div>
              <div className="truncate text-[11.5px] text-ink-soft">
                {lines} line item{lines === 1 ? "" : "s"} · {e.columns.length} column{e.columns.length === 1 ? "" : "s"}
                {e.createdBy?.name && <span className="text-ink-faint"> · by {e.createdBy.name}</span>}
              </div>
            </button>
            <button
              className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
              onClick={() => onDelete(e)}
            >
              Delete
            </button>
          </div>
        );
      })}
    </div>
  );
}
