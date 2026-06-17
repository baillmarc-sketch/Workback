"use client";

import { useBidSpec } from "@/state/bidSpecsStore";
import type { ChecklistItem, FormatFlag, Provider } from "@/lib/bidSpecs/types";

const PROVIDERS: Provider[] = ["A", "P", "E", "O"];

/**
 * Clean, print-only spec sheet rendered as the classic bordered AICP grid.
 * Hidden on screen; shown only when printing (Cmd/Ctrl+P → Save as PDF). Reuses
 * the estimator's named portrait page.
 */
export default function BidSpecsPrintView() {
  const { spec } = useBidSpec();
  if (!spec) return null;

  const onClauses = spec.clauses.filter((c) => c.on);
  const cell = "border border-neutral-400 px-1.5 py-0.5 align-top";

  // Group format flags into their columns.
  const flagGroups: { name: string; flags: FormatFlag[] }[] = [];
  for (const f of spec.format.flags) {
    let g = flagGroups.find((x) => x.name === (f.group || "Format"));
    if (!g) flagGroups.push((g = { name: f.group || "Format", flags: [] }));
    g.flags.push(f);
  }

  const providedGrid = (label: string, items: ChecklistItem[]) => (
    <table className="w-full text-[10px]">
      <thead>
        <tr>
          <th className={`${cell} text-left`}>{label}</th>
          {PROVIDERS.map((p) => (
            <th key={p} className={`${cell} w-5 text-center`}>
              {p}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((c) => (
          <tr key={c.id}>
            <td className={cell}>{c.label}</td>
            {PROVIDERS.map((p) => (
              <td key={p} className={`${cell} text-center`}>
                {c.provider === p ? "✗" : ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const production = spec.checklist.filter((c) => c.group === "production");
  const editorial = spec.checklist.filter((c) => c.group === "editorial");

  return (
    <div className="estimate-print print-only mx-auto max-w-[760px] text-[11px] leading-snug text-black">
      <h1 className="font-display text-[20px] font-semibold">{spec.title || "Bid Specs"}</h1>
      {spec.subtitle && <div className="mt-0.5 text-[12px] text-neutral-600">{spec.subtitle}</div>}
      <div className="mt-0.5 text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
        Confidential — Content Production Specifications
      </div>

      {/* Header grid */}
      <table className="mt-3 w-full text-[10.5px]">
        <tbody>
          {Array.from({ length: Math.ceil(spec.fields.filter((f) => f.label || f.value).length / 2) }).map((_, i) => {
            const fields = spec.fields.filter((f) => f.label || f.value);
            const a = fields[i * 2];
            const b = fields[i * 2 + 1];
            return (
              <tr key={i}>
                <td className={`${cell} w-[18%] bg-neutral-100 font-semibold`}>{a?.label ?? ""}</td>
                <td className={`${cell} w-[32%]`}>{a?.value ?? ""}</td>
                <td className={`${cell} w-[18%] bg-neutral-100 font-semibold`}>{b?.label ?? ""}</td>
                <td className={`${cell} w-[32%]`}>{b?.value ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Contacts */}
      {spec.contacts.some((c) => c.role || c.name || c.contact) && (
        <table className="mt-2 w-full text-[10.5px]">
          <tbody>
            {spec.contacts
              .filter((c) => c.role || c.name || c.contact)
              .map((c) => (
                <tr key={c.id}>
                  <td className={`${cell} w-[28%] bg-neutral-100 font-semibold`}>{c.role}</td>
                  <td className={`${cell} w-[40%]`}>{c.name}</td>
                  <td className={`${cell}`}>{c.contact}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {/* Bidding format grid */}
      <h2 className="mt-4 mb-1 font-display text-[13px] font-semibold">Bidding format</h2>
      <div className="text-[10.5px]">
        <span className="font-semibold">Bid type:</span> {spec.format.bidType === "firm" ? "Firm bid" : "Cost-plus / FF"}
        {"   "}
        <span className="font-semibold">AICP:</span> {spec.format.aicpForm || "—"}
        {"   "}
        <span className="font-semibold">Union:</span> {spec.format.union || "—"}
        {"   "}
        <span className="font-semibold">Bidders:</span> {spec.format.bidders || "—"}
      </div>
      <table className="mt-1 w-full text-[10px]">
        <tbody>
          <tr>
            {flagGroups.map((g) => (
              <td key={g.name} className={`${cell} w-1/5`}>
                <div className="font-semibold text-neutral-500">{g.name}</div>
                {g.flags.map((f) => (
                  <div key={f.id}>
                    {f.on ? "☒" : "☐"} {f.label}
                  </div>
                ))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* Commercial titles + counts */}
      {spec.specs.some((c) => c.title || c.length) && (
        <>
          <h2 className="mt-4 mb-1 font-display text-[13px] font-semibold">Commercial title(s) & length(s)</h2>
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className={`${cell} text-left`}>Title</th>
                <th className={`${cell} w-12`}>Length</th>
                <th className={`${cell} text-left`}>Versions</th>
                <th className={`${cell} w-10`}>#OCP</th>
                <th className={`${cell} w-10`}>#EXB</th>
                <th className={`${cell} w-10`}>#VO</th>
                <th className={`${cell} w-12`}>#N-U</th>
                <th className={`${cell} w-10`}>#HM</th>
                <th className={`${cell} text-left`}>Special</th>
              </tr>
            </thead>
            <tbody>
              {spec.specs
                .filter((c) => c.title || c.length)
                .map((c) => (
                  <tr key={c.id}>
                    <td className={cell}>{c.title}</td>
                    <td className={`${cell} text-center`}>{c.length}</td>
                    <td className={cell}>{c.versions}</td>
                    <td className={`${cell} text-center`}>{c.ocp}</td>
                    <td className={`${cell} text-center`}>{c.exb}</td>
                    <td className={`${cell} text-center`}>{c.vo}</td>
                    <td className={`${cell} text-center`}>{c.nonUnionExb}</td>
                    <td className={`${cell} text-center`}>{c.hm}</td>
                    <td className={cell}>{c.specialContract}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      {/* Provided-by grids */}
      <h2 className="mt-4 mb-1 font-display text-[13px] font-semibold">
        Production requirements — A = Agency · P = Production Co. · E = Editor · O = Outside
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {providedGrid("Production", production)}
        {providedGrid("Editorial / Post", editorial)}
      </div>

      {/* Tech specs */}
      {spec.techSpecs.some((t) => t.label || t.value) && (
        <>
          <h2 className="mt-4 mb-1 font-display text-[13px] font-semibold">Deliverable tech specs</h2>
          <table className="w-full text-[10.5px]">
            <tbody>
              {spec.techSpecs
                .filter((t) => t.label || t.value)
                .map((t) => (
                  <tr key={t.id}>
                    <td className={`${cell} w-[32%] bg-neutral-100 font-semibold`}>{t.label}</td>
                    <td className={cell}>{t.value}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      {/* Usage */}
      {spec.usage.some((u) => u.deliverable || u.media) && (
        <>
          <h2 className="mt-4 mb-1 font-display text-[13px] font-semibold">Usage & rights</h2>
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className={`${cell} text-left`}>Deliverable</th>
                <th className={`${cell} text-left`}>Media</th>
                <th className={`${cell} text-left`}>Territory</th>
                <th className={`${cell} text-left`}>Term</th>
                <th className={`${cell} text-left`}>Excl.</th>
                <th className={`${cell} text-left`}>Options</th>
              </tr>
            </thead>
            <tbody>
              {spec.usage
                .filter((u) => u.deliverable || u.media)
                .map((u) => (
                  <tr key={u.id}>
                    <td className={cell}>{u.deliverable}</td>
                    <td className={cell}>{u.media}</td>
                    <td className={cell}>{u.territory}</td>
                    <td className={cell}>{u.term}</td>
                    <td className={cell}>{u.exclusivity}</td>
                    <td className={cell}>{u.options}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {spec.usageNote && <p className="mt-1 text-neutral-700">{spec.usageNote}</p>}
        </>
      )}

      {/* Terms */}
      {onClauses.length > 0 && (
        <>
          <h2 className="mt-4 mb-1 font-display text-[13px] font-semibold">Production terms / notes</h2>
          <div className="flex flex-col gap-1">
            {onClauses.map((c) => (
              <div key={c.id} className="break-inside-avoid">
                <span className="font-semibold">{c.title}. </span>
                <span className="text-neutral-700">{c.body}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Signature */}
      {spec.signatureNote && (
        <div className="mt-5 break-inside-avoid border-t border-neutral-300 pt-3">
          <p className="text-neutral-700">{spec.signatureNote}</p>
          <div className="mt-4 flex items-end gap-8">
            <div className="flex-1 border-b border-neutral-500 pb-0.5 text-[10px] text-neutral-500">Initial</div>
            <div className="flex-1 border-b border-neutral-500 pb-0.5 text-[10px] text-neutral-500">Date</div>
          </div>
        </div>
      )}
    </div>
  );
}
