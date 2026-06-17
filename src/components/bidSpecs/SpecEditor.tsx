"use client";

import { useState } from "react";
import { uid } from "@/lib/types";
import type {
  ChecklistGroup,
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

/** The four provider columns on the provided-by grid, plus a clear (—). */
const PROVIDERS: { key: Provider; label: string; title: string }[] = [
  { key: "A", label: "A", title: "Agency provided" },
  { key: "P", label: "P", title: "Production company provided" },
  { key: "E", label: "E", title: "Editor provided" },
  { key: "O", label: "O", title: "Outside facility provided" },
];

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
    commit((s) => ({
      ...s,
      specs: [...s.specs, { id: uid(), title: "", length: "", versions: "", ocp: "", exb: "", vo: "", nonUnionExb: "", hm: "", specialContract: "" }],
    }));
  const removeSpec = (id: string) => commit((s) => ({ ...s, specs: s.specs.filter((c) => c.id !== id) }));

  // --- bidding format ---
  const setFormat = (patch: Partial<typeof spec.format>) => commit((s) => ({ ...s, format: { ...s.format, ...patch } }));
  const setFlag = (id: string, patch: Partial<FormatFlag>) =>
    commit((s) => ({ ...s, format: { ...s.format, flags: s.format.flags.map((f) => (f.id === id ? { ...f, ...patch } : f)) } }));
  const addFlag = (group: string) =>
    commit((s) => ({ ...s, format: { ...s.format, flags: [...s.format.flags, { id: uid(), label: "", on: true, group }] } }));
  const removeFlag = (id: string) =>
    commit((s) => ({ ...s, format: { ...s.format, flags: s.format.flags.filter((f) => f.id !== id) } }));

  // --- checklist ---
  const setItem = (id: string, patch: Partial<ChecklistItem>) =>
    commit((s) => ({ ...s, checklist: s.checklist.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const addItem = (group: ChecklistGroup) =>
    commit((s) => ({ ...s, checklist: [...s.checklist, { id: uid(), label: "", provider: "P" as Provider, group }] }));
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
  const counts = (g: Provider) => spec.checklist.filter((c) => c.provider === g).length;
  const apCount = `${counts("A")}A · ${counts("P")}P · ${counts("E")}E · ${counts("O")}O`;

  // Group the format flags into their grid columns, preserving first-seen order.
  const flagGroups: { name: string; flags: FormatFlag[] }[] = [];
  for (const f of fmt.flags) {
    let g = flagGroups.find((x) => x.name === (f.group || "Format"));
    if (!g) flagGroups.push((g = { name: f.group || "Format", flags: [] }));
    g.flags.push(f);
  }

  const checklistGrid = (group: ChecklistGroup, label: string) => {
    const items = spec.checklist.filter((c) => c.group === group);
    return (
      <div>
        <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">{label}</div>
        <div className="overflow-hidden rounded-md border border-hairline">
          <div className="flex items-center gap-1 border-b border-hairline bg-paper px-2 py-1">
            <span className="min-w-0 flex-1 text-[10px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Element</span>
            {PROVIDERS.map((p) => (
              <span key={p.key} className="w-6 text-center text-[10px] font-semibold text-ink-faint" title={p.title}>
                {p.label}
              </span>
            ))}
            <span className="w-8 text-center text-[10px] font-semibold text-ink-faint" title="Not applicable">
              N/A
            </span>
            <span className="w-4" />
          </div>
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-1 border-b border-hairline px-2 py-1 last:border-b-0">
              <input
                className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] outline-none placeholder:text-ink-faint"
                value={c.label}
                placeholder="Element"
                onChange={(e) => setItem(c.id, { label: e.target.value })}
              />
              {PROVIDERS.map((p) => (
                <button
                  key={p.key}
                  className={`flex h-5 w-6 items-center justify-center rounded text-[11px] font-semibold ${
                    c.provider === p.key ? "bg-ink text-paper" : "text-ink-faint hover:bg-paper"
                  }`}
                  title={p.title}
                  aria-pressed={c.provider === p.key}
                  onClick={() => setItem(c.id, { provider: c.provider === p.key ? ("NA" as Provider) : p.key })}
                >
                  {c.provider === p.key ? "✓" : "·"}
                </button>
              ))}
              <button
                className={`flex h-5 w-8 items-center justify-center rounded text-[10px] font-semibold ${
                  c.provider === "NA" ? "bg-ink text-paper" : "text-ink-faint hover:bg-paper"
                }`}
                title="Mark not applicable"
                aria-pressed={c.provider === "NA"}
                onClick={() => setItem(c.id, { provider: "NA" as Provider })}
              >
                N/A
              </button>
              <button className={removeBtn} title="Remove element" onClick={() => removeItem(c.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button className={`${addBtn} mt-1.5`} onClick={() => addItem(group)}>
          + Element
        </button>
      </div>
    );
  };

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
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="flex gap-1.5 pb-1">
              <span className={`${headCls} flex-[1.6]`}>Title & length</span>
              <span className={`${headCls} flex-1`}>Versions</span>
              <span className={`${headCls} w-12 text-center`}>#OCP</span>
              <span className={`${headCls} w-12 text-center`}>#EXB</span>
              <span className={`${headCls} w-12 text-center`}>#VO</span>
              <span className={`${headCls} w-14 text-center`}>#N-U</span>
              <span className={`${headCls} w-12 text-center`}>#HM</span>
              <span className={`${headCls} flex-1`}>Special</span>
              <span className="w-4" />
            </div>
            <div className="flex flex-col gap-1.5">
              {spec.specs.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5">
                  <input className={`${input} min-w-0 flex-[1.1]`} value={c.title} placeholder="Title" onChange={(e) => setSpec(c.id, { title: e.target.value })} />
                  <input className={`${input} w-16`} value={c.length} placeholder=":30" onChange={(e) => setSpec(c.id, { length: e.target.value })} />
                  <input className={`${input} min-w-0 flex-1`} value={c.versions} placeholder=":15L, :06L" onChange={(e) => setSpec(c.id, { versions: e.target.value })} />
                  <input className={`${input} w-12 text-center tabular-nums`} value={c.ocp} placeholder="0" inputMode="numeric" onChange={(e) => setSpec(c.id, { ocp: e.target.value })} />
                  <input className={`${input} w-12 text-center tabular-nums`} value={c.exb} placeholder="0" inputMode="numeric" onChange={(e) => setSpec(c.id, { exb: e.target.value })} />
                  <input className={`${input} w-12 text-center tabular-nums`} value={c.vo} placeholder="0" inputMode="numeric" onChange={(e) => setSpec(c.id, { vo: e.target.value })} />
                  <input className={`${input} w-14 text-center tabular-nums`} value={c.nonUnionExb} placeholder="0" inputMode="numeric" onChange={(e) => setSpec(c.id, { nonUnionExb: e.target.value })} />
                  <input className={`${input} w-12 text-center tabular-nums`} value={c.hm} placeholder="0" inputMode="numeric" onChange={(e) => setSpec(c.id, { hm: e.target.value })} />
                  <input className={`${input} min-w-0 flex-1`} value={c.specialContract} placeholder="—" onChange={(e) => setSpec(c.id, { specialContract: e.target.value })} />
                  <button className={removeBtn} title="Remove spot" onClick={() => removeSpec(c.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10.5px] text-ink-faint">
          OCP on-camera principals · EXB union extras · VO voiceovers · N-U non-union extras · HM hand models
        </p>
        <button className={`${addBtn} mt-1`} onClick={addSpec}>
          + Spot
        </button>
      </Section>

      {/* BIDDING FORMAT */}
      <Section title="Bidding format" subtitle={fmt.bidType === "firm" ? "Firm bid" : "Cost-plus"} defaultOpen>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.04em] text-ink-faint uppercase">
            Bid type
            <select className={`${input} font-normal normal-case tracking-normal`} value={fmt.bidType} onChange={(e) => setFormat({ bidType: e.target.value as "firm" | "costPlus" })}>
              <option value="firm">Firm bid</option>
              <option value="costPlus">Cost-plus / FF</option>
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
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
          {flagGroups.map((g) => (
            <div key={g.name}>
              <div className={headCls}>{g.name}</div>
              <div className="mt-1 flex flex-col gap-1">
                {g.flags.map((f) => (
                  <div key={f.id} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={f.on} onChange={(e) => setFlag(f.id, { on: e.target.checked })} aria-label={f.label} />
                    <input
                      className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] outline-none placeholder:text-ink-faint"
                      value={f.label}
                      placeholder="Flag"
                      onChange={(e) => setFlag(f.id, { label: e.target.value })}
                    />
                    <button className={removeBtn} title="Remove flag" onClick={() => removeFlag(f.id)}>
                      ×
                    </button>
                  </div>
                ))}
                <button className="self-start text-[11px] font-medium text-ink-soft hover:text-ink" onClick={() => addFlag(g.name)}>
                  + Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* CHECKLIST */}
      <Section title="Provided by" subtitle={apCount} defaultOpen>
        <p className="mb-3 text-[11.5px] text-ink-soft">
          Tap a column to mark who supplies each element — <b>A</b> Agency · <b>P</b> Production Co. · <b>E</b> Editor · <b>O</b> Outside facility.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {checklistGrid("production", "Production")}
          {checklistGrid("editorial", "Editorial / Post")}
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
