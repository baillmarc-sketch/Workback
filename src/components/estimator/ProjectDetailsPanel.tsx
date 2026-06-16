"use client";

import { useState } from "react";
import { uid } from "@/lib/types";
import type { Deliverable, ProjectField, TeamMember } from "@/lib/estimator/types";
import { useEstimate } from "@/state/estimateStore";

const input =
  "rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";
const headCls = "px-2 pb-1 text-[10px] font-semibold tracking-[0.06em] text-ink-faint uppercase";
const removeBtn = "shrink-0 px-1 text-[13px] leading-none text-ink-faint hover:text-danger";
const addBtn = "self-start text-[12px] font-medium text-ink-soft hover:text-ink";

/**
 * Collapsible header panel for the estimate's reference data: project info
 * fields, deliverables, and team. Inputs bind straight to the store (same as
 * the title/subtitle header) so edits autosave per keystroke.
 */
export default function ProjectDetailsPanel() {
  const { estimate, commit } = useEstimate();
  const [open, setOpen] = useState(false);
  if (!estimate) return null;

  // --- fields ---
  const setField = (id: string, patch: Partial<ProjectField>) =>
    commit((e) => ({ ...e, fields: e.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const addField = () => commit((e) => ({ ...e, fields: [...e.fields, { id: uid(), label: "", value: "" }] }));
  const removeField = (id: string) => commit((e) => ({ ...e, fields: e.fields.filter((f) => f.id !== id) }));

  // --- deliverables ---
  const setDeliv = (id: string, patch: Partial<Deliverable>) =>
    commit((e) => ({ ...e, deliverables: e.deliverables.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  const addDeliv = () =>
    commit((e) => ({ ...e, deliverables: [...e.deliverables, { id: uid(), title: "", length: "", usage: "" }] }));
  const removeDeliv = (id: string) => commit((e) => ({ ...e, deliverables: e.deliverables.filter((d) => d.id !== id) }));

  // --- team ---
  const setMember = (id: string, patch: Partial<TeamMember>) =>
    commit((e) => ({ ...e, team: e.team.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const addMember = () =>
    commit((e) => ({ ...e, team: [...e.team, { id: uid(), name: "", role: "", level: "", hours: "" }] }));
  const removeMember = (id: string) => commit((e) => ({ ...e, team: e.team.filter((m) => m.id !== id) }));

  const summary = [
    estimate.fields.length && `${estimate.fields.length} fields`,
    estimate.deliverables.length && `${estimate.deliverables.length} deliverables`,
    estimate.team.length && `${estimate.team.length} team`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="no-print mb-4 rounded-xl border border-hairline bg-surface">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-display text-[14px] font-semibold">Project details</span>
        <span className="text-[11.5px] text-ink-faint">{open ? "▾ hide" : summary ? `▸ ${summary}` : "▸ add"}</span>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-5 border-t border-hairline p-4 lg:grid-cols-2">
          {/* Project info */}
          <section>
            <h4 className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Project information</h4>
            <div className="flex flex-col gap-1.5">
              {estimate.fields.map((f) => (
                <div key={f.id} className="flex items-center gap-1.5">
                  <input
                    className={`${input} w-[40%] shrink-0 font-medium`}
                    value={f.label}
                    placeholder="Field"
                    onChange={(e) => setField(f.id, { label: e.target.value })}
                  />
                  <input
                    className={`${input} min-w-0 flex-1`}
                    value={f.value}
                    placeholder="—"
                    onChange={(e) => setField(f.id, { value: e.target.value })}
                  />
                  <button className={removeBtn} title="Remove field" onClick={() => removeField(f.id)}>
                    ×
                  </button>
                </div>
              ))}
              <button className={addBtn} onClick={addField}>
                + Field
              </button>
            </div>
          </section>

          {/* Deliverables + Team stacked */}
          <div className="flex flex-col gap-5">
            <section>
              <h4 className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Deliverables</h4>
              <div className="flex gap-1.5 pb-1">
                <span className={`${headCls} flex-1`}>Title</span>
                <span className={`${headCls} w-16`}>Length</span>
                <span className={`${headCls} flex-1`}>Usage</span>
                <span className="w-4" />
              </div>
              <div className="flex flex-col gap-1.5">
                {estimate.deliverables.map((d) => (
                  <div key={d.id} className="flex items-center gap-1.5">
                    <input className={`${input} min-w-0 flex-1`} value={d.title} placeholder="Title" onChange={(e) => setDeliv(d.id, { title: e.target.value })} />
                    <input className={`${input} w-16`} value={d.length} placeholder=":30" onChange={(e) => setDeliv(d.id, { length: e.target.value })} />
                    <input className={`${input} min-w-0 flex-1`} value={d.usage} placeholder="Usage" onChange={(e) => setDeliv(d.id, { usage: e.target.value })} />
                    <button className={removeBtn} title="Remove deliverable" onClick={() => removeDeliv(d.id)}>
                      ×
                    </button>
                  </div>
                ))}
                <button className={addBtn} onClick={addDeliv}>
                  + Deliverable
                </button>
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Team</h4>
              <div className="flex gap-1.5 pb-1">
                <span className={`${headCls} flex-1`}>Name</span>
                <span className={`${headCls} flex-1`}>Role</span>
                <span className={`${headCls} w-14`}>Level</span>
                <span className={`${headCls} w-14`}>Hours</span>
                <span className="w-4" />
              </div>
              <div className="flex flex-col gap-1.5">
                {estimate.team.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5">
                    <input className={`${input} min-w-0 flex-1`} value={m.name} placeholder="Name" onChange={(e) => setMember(m.id, { name: e.target.value })} />
                    <input className={`${input} min-w-0 flex-1`} value={m.role} placeholder="Role" onChange={(e) => setMember(m.id, { role: e.target.value })} />
                    <input className={`${input} w-14`} value={m.level} placeholder="Sr" onChange={(e) => setMember(m.id, { level: e.target.value })} />
                    <input className={`${input} w-14 tabular-nums`} value={m.hours} placeholder="0" inputMode="numeric" onChange={(e) => setMember(m.id, { hours: e.target.value })} />
                    <button className={removeBtn} title="Remove team member" onClick={() => removeMember(m.id)}>
                      ×
                    </button>
                  </div>
                ))}
                <button className={addBtn} onClick={addMember}>
                  + Team member
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
