"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteRemoteProject } from "@/lib/account";
import {
  deleteProject,
  duplicateProject,
  listProjects,
  loadProject,
  migrate,
  newProject,
  saveProject,
} from "@/lib/storage";
import { exportProjectFile, importProjectFile } from "@/lib/backup";
import { notify } from "@/lib/notify";
import { TEMPLATES } from "@/lib/templates";
import { listMyTeams, type MyTeam } from "@/lib/admin/teams";
import {
  deleteTeamDoc,
  listTeamDocs,
  saveTeamDoc,
} from "@/lib/teamWorkspace";
import type { Project } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useStore, type Workspace } from "@/state/store";
import Modal from "./Modal";

type Scope = { kind: "personal" } | { kind: "team"; teamId: string; name: string };

export default function ProjectsDialog({ onClose }: { onClose: () => void }) {
  const { project, open, openInWorkspace, workspace } = useStore();
  const { user, getToken } = useAuth();
  const [, bump] = useState(0);
  const [picking, setPicking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [myTeams, setMyTeams] = useState<MyTeam[]>([]);
  const [scope, setScope] = useState<Scope>(
    workspace.kind === "team" ? { kind: "team", teamId: workspace.teamId, name: "Team" } : { kind: "personal" }
  );
  const [teamProjects, setTeamProjects] = useState<Project[] | null>(null);
  const [teamErr, setTeamErr] = useState<string | null>(null);

  const personalProjects = listProjects();

  // Discover the teams this account belongs to (from the member-readable mirror).
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
      setTeamProjects(null);
      setTeamErr(null);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in");
        const raw = await listTeamDocs(teamId, "workback", token);
        const docs = Object.values(raw)
          .map((d) => {
            try {
              return migrate(d);
            } catch {
              return null;
            }
          })
          .filter((p): p is Project => !!p)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setTeamProjects(docs);
      } catch (e) {
        setTeamErr((e as Error).message || "Couldn't load this team's workspace");
        setTeamProjects([]);
      }
    },
    [getToken]
  );

  useEffect(() => {
    if (scope.kind === "team") loadTeam(scope.teamId);
  }, [scope, loadTeam]);

  function stamp(p: Project): Project {
    return user ? { ...p, createdBy: { uid: user.uid, name: user.name || user.email || "Someone" } } : p;
  }

  async function createInTeam(teamId: string, name: string, templateId: Parameters<typeof newProject>[0]) {
    const p = stamp(newProject(templateId));
    const token = await getToken();
    if (!token) return notify("Sign in to create a team file.");
    try {
      await saveTeamDoc(teamId, "workback", p, token);
      openInWorkspace(p, { kind: "team", teamId } satisfies Workspace);
      onClose();
    } catch {
      notify("Couldn't create the team file — check your connection.");
    }
  }

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const p = await importProjectFile(file);
      saveProject(p);
      open(p);
      onClose();
    } catch {
      notify("That file isn't a Workback backup (.json).");
    }
  };

  const inTeam = scope.kind === "team";

  return (
    <Modal title="Projects" onClose={onClose} width={460}>
      <div className="flex flex-col gap-3">
        {/* Workspace switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            Workspace
          </span>
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

        {/* Create / import */}
        {!picking ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
              onClick={() => setPicking(true)}
            >
              + New {inTeam ? "team project" : "project"}
            </button>
            {!inTeam && (
              <>
                <button
                  className="rounded-md border border-hairline px-3 py-1.5 text-[12.5px] font-medium hover:bg-paper"
                  title="Restore a project from a .workback.json backup"
                  onClick={() => fileRef.current?.click()}
                >
                  Import .json
                </button>
                <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Start from</span>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                title={t.description}
                className="rounded-md border border-hairline px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-paper"
                onClick={() => {
                  if (inTeam && scope.kind === "team") {
                    createInTeam(scope.teamId, scope.name, t.id);
                  } else {
                    const p = newProject(t.id);
                    saveProject(p);
                    open(p);
                    onClose();
                  }
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {teamErr && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">{teamErr}</div>}

        {inTeam ? (
          <TeamList
            projects={teamProjects}
            currentId={project?.id ?? null}
            onOpen={(p) => {
              if (scope.kind === "team") openInWorkspace(p, { kind: "team", teamId: scope.teamId });
              onClose();
            }}
            onDelete={async (p) => {
              if (scope.kind !== "team") return;
              if (!confirm(`Delete “${p.title || "Untitled Workback"}” from this team? Members will lose access; it can be recovered from the team trash.`)) return;
              const token = await getToken();
              if (token) {
                try {
                  await deleteTeamDoc(scope.teamId, "workback", p, token);
                  setTeamProjects((cur) => cur?.filter((x) => x.id !== p.id) ?? null);
                } catch {
                  notify("Couldn't delete — check your connection.");
                }
              }
            }}
          />
        ) : personalProjects.length === 0 ? (
          <div className="py-4 text-center text-[12.5px] text-ink-faint">No saved projects yet.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hairline">
            {personalProjects.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0 ${
                  s.id === project?.id ? "bg-paper" : ""
                }`}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    const p = loadProject(s.id);
                    if (p) {
                      open(p);
                      onClose();
                    }
                  }}
                >
                  <div className="truncate text-[13px] font-semibold">
                    {s.title || "Untitled Workback"}
                    {s.id === project?.id && (
                      <span className="ml-2 text-[10.5px] font-medium text-ink-faint">current</span>
                    )}
                  </div>
                  <div className="truncate text-[11.5px] text-ink-soft">
                    {s.subtitle || `${s.eventCount} event${s.eventCount === 1 ? "" : "s"}`}
                    <span className="text-ink-faint"> · {new Date(s.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
                <button
                  className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-paper hover:text-ink"
                  title="Download a .json backup"
                  onClick={() => {
                    const p = s.id === project?.id ? project : loadProject(s.id);
                    if (p) exportProjectFile(p);
                  }}
                >
                  Export
                </button>
                <button
                  className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-paper hover:text-ink"
                  title="Make an independent copy"
                  onClick={() => {
                    const p = duplicateProject(s.id);
                    if (p) {
                      open(p);
                      onClose();
                    }
                  }}
                >
                  Duplicate
                </button>
                {s.id !== project?.id && (
                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
                    onClick={() => {
                      if (confirm(`Delete “${s.title || "Untitled Workback"}”? You can recover it from the admin trash.`)) {
                        const doc = loadProject(s.id);
                        deleteProject(s.id);
                        if (user) {
                          getToken()
                            .then((t) => (t ? deleteRemoteProject(user.uid, t, s.id, doc) : undefined))
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

        {user && !inTeam && <div className="text-[11px] text-ink-faint">Synced to {user.email}</div>}
        {inTeam && (
          <div className="text-[11px] text-ink-faint">
            Shared with everyone on this team · last edit wins · who&apos;s viewing shows live
          </div>
        )}
      </div>
    </Modal>
  );
}

function TeamList({
  projects,
  currentId,
  onOpen,
  onDelete,
}: {
  projects: Project[] | null;
  currentId: string | null;
  onOpen: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  if (projects === null) {
    return <div className="py-4 text-center text-[12.5px] text-ink-faint">Loading…</div>;
  }
  if (projects.length === 0) {
    return <div className="py-4 text-center text-[12.5px] text-ink-faint">No team projects yet.</div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      {projects.map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-b-0 ${
            p.id === currentId ? "bg-paper" : ""
          }`}
        >
          <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(p)}>
            <div className="truncate text-[13px] font-semibold">
              {p.title || "Untitled Workback"}
              {p.id === currentId && (
                <span className="ml-2 text-[10.5px] font-medium text-ink-faint">current</span>
              )}
            </div>
            <div className="truncate text-[11.5px] text-ink-soft">
              {p.events.length} event{p.events.length === 1 ? "" : "s"}
              {p.createdBy?.name && <span className="text-ink-faint"> · by {p.createdBy.name}</span>}
              <span className="text-ink-faint"> · {new Date(p.updatedAt).toLocaleDateString()}</span>
            </div>
          </button>
          <button
            className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
            onClick={() => onDelete(p)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
