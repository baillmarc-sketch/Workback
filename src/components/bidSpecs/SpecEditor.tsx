"use client";

import { useState } from "react";
import { uid } from "@/lib/types";
import type {
  ChecklistItem,
  Clause,
  CommercialSpec,
  FormatFlag,
  Provider,
  SpecContact,
  SpecField,
  TechSpec,
  UsageRow,
} from "@/lib/bidSpecs/types";
import { useBidSpec } from "@/state/bidSpecsStore";

const input =
  "rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px] outline-none focus:border-ink-faint";
const headCls = "px-2 pb-1 text-[10px] font-semibold tracking-[0.06em] text-ink-faint uppercase";
const removeBtn = "shrink-0 px-1 text-[13px] leading-none text-ink-faint hover:text-danger";
const addBtn = "self-start text-[12px] font-medium text-ink-soft hover:text-ink";

/** A collapsible titled section card. */
function Section({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 rounded-xl border border-hairline bg-surface">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-display text-[14px] font-semibold">{title}</span>
        <span className="text-[11.5px] text-ink-faint">{open ? "▾ hide" : subtitle ? `▸ ${subtitle}` : "▸ open"}</span>
      </button>
      {open && <div className="border-t border-hairline p-4">{children}</div>}
    </div>
  );
}

export default function SpecEditor() {
  const { spec, commit } = useBidSpec();
  if (!spec) return null;

  // --- project fields ---
  const setField = (id: string, patch: Partial<SpecField>) =>
    commit((s) => ({ ...s, fields: s.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  const addField = () => commit((s) => ({ ...s, fields: [...s.fields, { id: uid(), label: "", value: "" }] }));
  const removeField = (id: string) => commit((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== id) }));

  // --- contacts ---
  const setContact = (id: string, patch: Partial<SpecContact>) =>
    commit((s) => ({ ...s, contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const addContact = () =>
    commit((s) => ({ ...s, contacts: [...s.contacts, { id: uid(), role: "", name: "", contact: "" }] }));
  const removeContact = (id: string) => commit((s) => ({ ...s, contacts: s.contacts.filter((c) => c.id !== id) }));

  // --- commercial specs ---
  const setSpec = (id: string, patch: Partial<CommercialSpec>) =>
    commit((s) => ({ ...s, specs: s.specs.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const addSpec = () =>
    commit((s) => ({ ...s, specs: [...s.specs, { id: uid(), title: "", length: "", versions: "" }] }));
  const removeSpec = (id: string) => commit((s) => ({ ...s, specs: s.specs.filter((c) => c.id !== id) }));

  // --- bidding format ---
  const setFormat = (patch: Partial<typeof spec.format>) => commit((s) => ({ ...s, format: { ...s.format, ...patch } }));
  const setFlag = (id: string, patch: Partial<FormatFlag>) =>
    commit((s) => ({ ...s, format: { ...s.format, flags: s.format.flags.map((f) => (f.id === id ? { ...f, ...patch } : f)) } }));
  const addFlag = () =>
    commit((s) => ({ ...s, format: { ...s.format, flags: [...s.format.flags, { id: uid(), label: "", on: true }] } }));
  const removeFlag = (id: string) =>
    commit((s) => ({ ...s, format: { ...s.format, flags: s.format.flags.filter((f) => f.id !== id) } }));

  // --- checklist ---
  const setItem = (id: string, patch: Partial<ChecklistItem>) =>
    commit((s) => ({ ...s, checklist: s.checklist.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const addItem = () =>
    commit((s) => ({ ...s, checklist: [...s.checklist, { id: uid(), label: "", provider: "P" as Provider }] }));
  const removeItem = (id: string) => commit((s) => ({ ...s, checklist: s.checklist.filter((c) => c.id !== id) }));

  // --- tech specs ---
  const setTech = (id: string, patch: Partial<TechSpec>) =>
    commit((s) => ({ ...s, techSpecs: s.techSpecs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const addTech = () => commit((s) => ({ ...s, techSpecs: [...s.techSpecs, { id: uid(), label: "", value: "" }] }));
  const removeTech = (id: string) => commit((s) => ({ ...s, techSpecs: s.techSpecs.filter((t) => t.id !== id) }));

  // --- usage ---
  const setUsage = (id: string, patch: Partial<UsageRow>) =>
    commit((s) => ({ ...s, usage: s.usage.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  const addUsage = () =>
    commit((s) => ({
      ...s,
      usage: [...s.usage, { id: uid(), deliverable: "", media: "", territory: "", term: "", exclusivity: "", options: "" }],
    }));
  const removeUsage = (id: string) => commit((s) => ({ ...s, usage: s.usage.filter((u) => u.id !== id) }));

  // --- clauses ---
  const setClause = (id: string, patch: Partial<Clause>) =>
    commit((s) => ({ ...s, clauses: s.clauses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const addClause = () =>
    commit((s) => ({
      ...s,
      clauses: [...s.clauses, { id: uid(), group: "Custom", title: "New clause", body: "", on: true, order: s.clauses.length }],
    }));
  const removeClause = (id: string) => commit((s) => ({ ...s, clauses: s.clauses.filter((c) => c.id !== id) }));

  const fmt = spec.format;
  const onCount = spec.clauses.filter((c) => c.on).length;
  const apCount = `${spec.checklist.filter((c) => c.provider === "A").length}A · ${spec.checklist.filter((c) => c.provider === "P").length}P`;

  return (
    <div>
      {/* PROJECT */}
      <Section title="Project & job" subtitle={`${spec.fields.length} fields`} defaultOpen>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {spec.fields.map((f) => (
            <div key={f.id} className="flex items-center gap-1.5">
              <input
                className={`${input} w-[44%] shrink-0 font-medium`}
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
        </div>
        <button className={`${addBtn} mt-2`} onClick={addField}>
          + Field
        </button>
      </Section>

      {/* TEAM */}
      <Section title="Production team" subtitle={`${spec.contacts.length} contacts`}>
        <div className="flex gap-1.5 pb-1">
          <span className={`${headCls} w-[30%]`}>Role</span>
          <span className={`${headCls} flex-1`}>Name</span>
          <span className={`${headCls} flex-1`}>Contact</span>
          <span className="w-4" />
        </div>
        <div className="flex flex-col gap-1.5">
          {spec.contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <input className={`${input} w-[30%] font-medium`} value={c.role} placeholder="Role" onChange={(e) => setContact(c.id, { role: e.target.value })} />
              <input className={`${input} min-w-0 flex-1`} value={c.name} placeholder="Name" onChange={(e) => setContact(c.id, { name: e.target.value })} />
              <input className={`${input} min-w-0 flex-1`} value={c.contact} placeholder="phone / email" onChange={(e) => setContact(c.id, { contact: e.target.value })} />
              <button className={removeBtn} title="Remove contact" onClick={() => removeContact(c.id)}>
                ×
              </button>
            </div>
          ))}
          <button className={addBtn} onClick={addContact}>
            + Contact
          </button>
        </div>
      </Section>

      {/* COMMERCIAL SPECS */}
      <Section title="Commercial specs" subtitle={`${spec.specs.length} spot${spec.specs.length === 1 ? "" : "s"}`} defaultOpen>
        <div className="flex gap-1.5 pb-1">
          <span className={`${headCls} flex-1`}>Title</span>
          <span className={`${headCls} w-20`}>Length</span>
          <span className={`${headCls} flex-1`}>Versions</span>
          <span className="w-4" />
        </div>
        <div className="flex flex-col gap-1.5">
          {spec.specs.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <input className={`${input} min-w-0 flex-1`} value={c.title} placeholder="Title" onChange={(e) => setSpec(c.id, { title: e.target.value })} />
              <input className={`${input} w-20`} value={c.length} placeholder=":30" onChange={(e) => setSpec(c.id, { length: e.target.value })} />
              <input className={`${input} min-w-0 flex-1`} value={c.versions} placeholder=":15L, :06L" onChange={(e) => setSpec(c.id, { versions: e.target.value })} />
              <button className={removeBtn} title="Remove spot" onClick={() => removeSpec(c.id)}>
                ×
              </button>
            </div>
          ))}
          <button className={addBtn} onClick={addSpec}>
            + Spot
          </button>
        </div>
      </Section>

      {/* BIDDING FORMAT */}
      <Section title="Bidding format" subtitle={fmt.bidType === "firm" ? "Firm bid" : "Cost-plus"} defaultOpen>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.04em] text-ink-faint uppercase">
            Bid type
            <select className={`${input} font-normal normal-case tracking-normal`} value={fmt.bidType} onChange={(e) => setFormat({ bidType: e.target.value as "firm" | "costPlus" })}>
              <option value="firm">Firm bid</option>
              <option value="costPlus">Cost-plus / actualized</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.04em] text-ink-faint uppercase">
            AICP form
            <input className={`${input} font-normal normal-case tracking-normal`} value={fmt.aicpForm} placeholder="AICP Bid Form (Jan 2023)" onChange={(e) => setFormat({ aicpForm: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.04em] text-ink-faint uppercase">
            Union status
            <input className={`${input} font-normal normal-case tracking-normal`} value={fmt.union} placeholder="SAG-AFTRA · DGA · IATSE / Non-union" onChange={(e) => setFormat({ union: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.04em] text-ink-faint uppercase">
            Bidders
            <input className={`${input} font-normal normal-case tracking-normal`} value={fmt.bidders} placeholder="3 (triple bid)" onChange={(e) => setFormat({ bidders: e.target.value })} />
          </label>
        </div>
        <div className="mt-4">
          <span className={headCls}>Format flags</span>
          <div className="mt-1 flex flex-col gap-1.5">
            {fmt.flags.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <input type="checkbox" checked={f.on} onChange={(e) => setFlag(f.id, { on: e.target.checked })} aria-label={f.label} />
                <input className={`${input} min-w-0 flex-1`} value={f.label} placeholder="Flag" onChange={(e) => setFlag(f.id, { label: e.target.value })} />
                <button className={removeBtn} title="Remove flag" onClick={() => removeFlag(f.id)}>
                  ×
                </button>
              </div>
            ))}
            <button className={addBtn} onClick={addFlag}>
              + Flag
            </button>
          </div>
        </div>
      </Section>

      {/* CHECKLIST */}
      <Section title="Agency vs production provided" subtitle={apCount} defaultOpen>
        <p className="mb-2 text-[11.5px] text-ink-soft">
          Mark who supplies each element: <b>A</b> = Agency provided · <b>P</b> = Production company provided · <b>—</b> = N/A.
        </p>
        <div className="flex flex-col gap-1.5">
          {spec.checklist.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <div className="flex shrink-0 overflow-hidden rounded-md border border-hairline">
                {(["A", "P", "NA"] as Provider[]).map((p) => (
                  <button
                    key={p}
                    className={`px-2 py-1 text-[11px] font-semibold ${c.provider === p ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper"}`}
                    onClick={() => setItem(c.id, { provider: p })}
                    title={p === "A" ? "Agency provided" : p === "P" ? "Production provided" : "N/A"}
                  >
                    {p === "NA" ? "—" : p}
                  </button>
                ))}
              </div>
              <input className={`${input} min-w-0 flex-1`} value={c.label} placeholder="Element" onChange={(e) => setItem(c.id, { label: e.target.value })} />
              <button className={removeBtn} title="Remove element" onClick={() => removeItem(c.id)}>
                ×
              </button>
            </div>
          ))}
          <button className={addBtn} onClick={addItem}>
            + Element
          </button>
        </div>
      </Section>

      {/* TECH SPECS */}
      <Section title="Deliverable tech specs" subtitle={`${spec.techSpecs.length} specs`}>
        <div className="flex flex-col gap-1.5">
          {spec.techSpecs.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5">
              <input className={`${input} w-[40%] shrink-0 font-medium`} value={t.label} placeholder="Spec" onChange={(e) => setTech(t.id, { label: e.target.value })} />
              <input className={`${input} min-w-0 flex-1`} value={t.value} placeholder="—" onChange={(e) => setTech(t.id, { value: e.target.value })} />
              <button className={removeBtn} title="Remove spec" onClick={() => removeTech(t.id)}>
                ×
              </button>
            </div>
          ))}
          <button className={addBtn} onClick={addTech}>
            + Spec
          </button>
        </div>
      </Section>

      {/* USAGE */}
      <Section title="Usage & rights" subtitle={`${spec.usage.length} row${spec.usage.length === 1 ? "" : "s"}`}>
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="flex gap-1.5 pb-1">
              <span className={`${headCls} flex-[1.4]`}>Deliverable</span>
              <span className={`${headCls} flex-1`}>Media</span>
              <span className={`${headCls} w-24`}>Territory</span>
              <span className={`${headCls} w-24`}>Term</span>
              <span className={`${headCls} w-24`}>Exclusivity</span>
              <span className={`${headCls} flex-1`}>Options</span>
              <span className="w-4" />
            </div>
            <div className="flex flex-col gap-1.5">
              {spec.usage.map((u) => (
                <div key={u.id} className="flex items-center gap-1.5">
                  <input className={`${input} min-w-0 flex-[1.4]`} value={u.deliverable} placeholder="Spot" onChange={(e) => setUsage(u.id, { deliverable: e.target.value })} />
                  <input className={`${input} min-w-0 flex-1`} value={u.media} placeholder="TV / Internet" onChange={(e) => setUsage(u.id, { media: e.target.value })} />
                  <input className={`${input} w-24`} value={u.territory} placeholder="US" onChange={(e) => setUsage(u.id, { territory: e.target.value })} />
                  <input className={`${input} w-24`} value={u.term} placeholder="2 Months" onChange={(e) => setUsage(u.id, { term: e.target.value })} />
                  <input className={`${input} w-24`} value={u.exclusivity} placeholder="N/A" onChange={(e) => setUsage(u.id, { exclusivity: e.target.value })} />
                  <input className={`${input} min-w-0 flex-1`} value={u.options} placeholder="Renewals" onChange={(e) => setUsage(u.id, { options: e.target.value })} />
                  <button className={removeBtn} title="Remove row" onClick={() => removeUsage(u.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button className={`${addBtn} mt-2`} onClick={addUsage}>
          + Usage row
        </button>
        <textarea
          className="mt-3 w-full resize-y rounded-md border border-hairline bg-paper px-2.5 py-2 text-[13px] outline-none placeholder:text-ink-faint focus:border-ink-faint"
          rows={2}
          value={spec.usageNote}
          placeholder="Buyout / usage note — e.g. buyout covers unlimited lifts, edits and versions of the spots above…"
          onChange={(e) => commit((s) => ({ ...s, usageNote: e.target.value }))}
        />
      </Section>

      {/* CLAUSES */}
      <Section title="Production terms" subtitle={`${onCount} of ${spec.clauses.length} on`} defaultOpen>
        <p className="mb-2 text-[11.5px] text-ink-soft">
          Toggle a term on/off and edit its language. Off terms are hidden from the printed sheet.
        </p>
        <div className="flex flex-col gap-2.5">
          {spec.clauses.map((c) => (
            <div key={c.id} className={`rounded-lg border p-2.5 ${c.on ? "border-hairline bg-paper" : "border-hairline/60 bg-surface opacity-60"}`}>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={c.on} onChange={(e) => setClause(c.id, { on: e.target.checked })} aria-label={`Include ${c.title}`} />
                <input className={`${input} w-[28%] shrink-0 bg-surface text-[11px] font-semibold tracking-[0.04em] text-ink-faint uppercase`} value={c.group} placeholder="Group" onChange={(e) => setClause(c.id, { group: e.target.value })} />
                <input className={`${input} min-w-0 flex-1 bg-surface font-medium`} value={c.title} placeholder="Title" onChange={(e) => setClause(c.id, { title: e.target.value })} />
                <button className={removeBtn} title="Remove clause" onClick={() => removeClause(c.id)}>
                  ×
                </button>
              </div>
              <textarea
                className="mt-1.5 w-full resize-y rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] leading-snug outline-none placeholder:text-ink-faint focus:border-ink-faint"
                rows={2}
                value={c.body}
                placeholder="Clause language…"
                onChange={(e) => setClause(c.id, { body: e.target.value })}
              />
            </div>
          ))}
          <button className={addBtn} onClick={addClause}>
            + Custom clause
          </button>
        </div>
      </Section>

      {/* SIGNATURE */}
      <Section title="Acknowledgement" subtitle="signature line">
        <textarea
          className="w-full resize-y rounded-md border border-hairline bg-paper px-2.5 py-2 text-[13px] outline-none placeholder:text-ink-faint focus:border-ink-faint"
          rows={2}
          value={spec.signatureNote}
          placeholder="Acknowledgement line shown at the foot of the sheet…"
          onChange={(e) => commit((s) => ({ ...s, signatureNote: e.target.value }))}
        />
      </Section>
    </div>
  );
}
