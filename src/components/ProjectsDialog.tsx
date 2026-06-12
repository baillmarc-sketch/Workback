"use client";

import { useState } from "react";
import { deleteProject, listProjects, loadProject, newProject, saveProject } from "@/lib/storage";
import { useStore } from "@/state/store";
import Modal from "./Modal";

export default function ProjectsDialog({ onClose }: { onClose: () => void }) {
  const { project, open } = useStore();
  const [, bump] = useState(0);
  const projects = listProjects();

  return (
    <Modal title="Projects" onClose={onClose} width={440}>
      <div className="flex flex-col gap-3">
        <button
          className="self-start rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
          onClick={() => {
            const p = newProject();
            saveProject(p);
            open(p);
            onClose();
          }}
        >
          + New project
        </button>

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
                {s.id !== project?.id && (
                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:bg-red-50 hover:text-danger"
                    onClick={() => {
                      if (confirm(`Delete “${s.title || "Untitled Workback"}”? This can't be undone.`)) {
                        deleteProject(s.id);
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
      </div>
    </Modal>
  );
}
