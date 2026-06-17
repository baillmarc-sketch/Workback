"use client";

import { useRef, useState } from "react";
import { deleteRemoteProject } from "@/lib/account";
import {
  deleteProject,
  duplicateProject,
  listProjects,
  loadProject,
  newProject,
  saveProject,
} from "@/lib/storage";
import { exportProjectFile, importProjectFile } from "@/lib/backup";
import { notify } from "@/lib/notify";
import { TEMPLATES } from "@/lib/templates";
import { useAuth } from "@/state/auth";
import { useStore } from "@/state/store";
import Modal from "./Modal";

export default function ProjectsDialog({ onClose }: { onClose: () => void }) {
  const { project, open } = useStore();
  const { user, getToken } = useAuth();
  const [, bump] = useState(0);
  const [picking, setPicking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const projects = listProjects();

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again later
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

  return (
    <Modal title="Projects" onClose={onClose} width={440}>
      <div className="flex flex-col gap-3">
        {!picking ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
              onClick={() => setPicking(true)}
            >
              + New project
            </button>
            <button
              className="rounded-md border border-hairline px-3 py-1.5 text-[12.5px] font-medium hover:bg-paper"
              title="Restore a project from a .workback.json backup"
              onClick={() => fileRef.current?.click()}
            >
              Import .json
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={onImport}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
              Start from
            </span>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                title={t.description}
                className="rounded-md border border-hairline px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-paper"
                onClick={() => {
                  const p = newProject(t.id);
                  saveProject(p);
                  open(p);
                  onClose();
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="py-4 text-center text-[12.5px] text-ink-faint">No saved projects yet.</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hairline">
            {projects.map((s) => (
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
                    <span className="text-ink-faint">
                      {" · "}
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </span>
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
                        // Capture the doc before the local delete so the remote
                        // soft-delete can stash it for recovery.
                        const doc = loadProject(s.id);
                        deleteProject(s.id);
                        if (user) {
                          // Tombstone + stash the remote copy so other devices don't
                          // resurrect it but it stays recoverable
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

        {user && (
          <div className="text-[11px] text-ink-faint">Synced to {user.email}</div>
        )}
      </div>
    </Modal>
  );
}
