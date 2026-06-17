"use client";

import { useBidSpec } from "@/state/bidSpecsStore";

/**
 * Clean, print-only spec sheet. Hidden on screen; shown only when printing
 * (Cmd/Ctrl+P → Save as PDF). Reuses the estimator's named portrait page so it
 * prints Letter portrait while Workback keeps its landscape default.
 */
export default function BidSpecsPrintView() {
  const { spec } = useBidSpec();
  if (!spec) return null;

  const onClauses = spec.clauses.filter((c) => c.on);
  const agency = spec.checklist.filter((c) => c.provider === "A");
  const production = spec.checklist.filter((c) => c.provider === "P");

  return (
    <div className="estimate-print print-only mx-auto max-w-[720px] text-[11.5px] leading-snug text-black">
      <h1 className="font-display text-[22px] font-semibold">{spec.title || "Bid Specs"}</h1>
      {spec.subtitle && <div className="mt-0.5 text-[12px] text-neutral-600">{spec.subtitle}</div>}
      <div className="mt-1 text-[10.5px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
        Confidential — Commercial Bid Specs
      </div>

      {/* Project + team */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
        {spec.fields
          .filter((f) => f.label || f.value)
          .map((f) => (
            <div key={f.id} className="flex justify-between gap-3 border-b border-neutral-200 py-0.5">
              <span className="font-semibold">{f.label}</span>
              <span className="text-right text-neutral-700">{f.value || "—"}</span>
            </div>
          ))}
      </div>

      {spec.contacts.some((c) => c.role || c.name || c.contact) && (
        <>
          <h2 className="mt-5 mb-1 font-display text-[14px] font-semibold">Production team</h2>
          <table>
            <tbody>
              {spec.contacts
                .filter((c) => c.role || c.name || c.contact)
                .map((c) => (
                  <tr key={c.id}>
                    <td className="w-[32%] py-0.5 font-semibold">{c.role}</td>
                    <td className="py-0.5">{c.name}</td>
                    <td className="py-0.5 text-neutral-600">{c.contact}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      {/* Commercial specs */}
      {spec.specs.some((c) => c.title || c.length || c.versions) && (
        <>
          <h2 className="mt-5 mb-1 font-display text-[14px] font-semibold">Commercial specs</h2>
          <table>
            <thead>
              <tr className="text-left text-[10px] tracking-[0.06em] text-neutral-500 uppercase">
                <th className="py-0.5">Title</th>
                <th className="py-0.5">Length</th>
                <th className="py-0.5">Versions</th>
              </tr>
            </thead>
            <tbody>
              {spec.specs
                .filter((c) => c.title || c.length || c.versions)
                .map((c) => (
                  <tr key={c.id} className="border-t border-neutral-200">
                    <td className="py-0.5 font-medium">{c.title}</td>
                    <td className="py-0.5">{c.length}</td>
                    <td className="py-0.5">{c.versions}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      {/* Bidding format */}
      <h2 className="mt-5 mb-1 font-display text-[14px] font-semibold">Bidding format</h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
        <div className="flex justify-between border-b border-neutral-200 py-0.5">
          <span className="font-semibold">Bid type</span>
          <span>{spec.format.bidType === "firm" ? "Firm bid" : "Cost-plus / actualized"}</span>
        </div>
        <div className="flex justify-between border-b border-neutral-200 py-0.5">
          <span className="font-semibold">AICP form</span>
          <span>{spec.format.aicpForm || "—"}</span>
        </div>
        <div className="flex justify-between border-b border-neutral-200 py-0.5">
          <span className="font-semibold">Union</span>
          <span>{spec.format.union || "—"}</span>
        </div>
        <div className="flex justify-between border-b border-neutral-200 py-0.5">
          <span className="font-semibold">Bidders</span>
          <span>{spec.format.bidders || "—"}</span>
        </div>
      </div>
      {spec.format.flags.some((f) => f.on) && (
        <div className="mt-1.5 text-neutral-700">
          {spec.format.flags.filter((f) => f.on).map((f) => f.label).join(" · ")}
        </div>
      )}

      {/* Provided-by checklist */}
      <h2 className="mt-5 mb-1 font-display text-[14px] font-semibold">Agency vs production provided</h2>
      <div className="grid grid-cols-2 gap-x-8">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.06em] text-neutral-500 uppercase">Agency provided</div>
          <ul className="mt-1 list-disc pl-4">
            {agency.map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
            {agency.length === 0 && <li className="list-none text-neutral-400">—</li>}
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-[0.06em] text-neutral-500 uppercase">Production company provided</div>
          <ul className="mt-1 list-disc pl-4">
            {production.map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
            {production.length === 0 && <li className="list-none text-neutral-400">—</li>}
          </ul>
        </div>
      </div>

      {/* Tech specs */}
      {spec.techSpecs.some((t) => t.label || t.value) && (
        <>
          <h2 className="mt-5 mb-1 font-display text-[14px] font-semibold">Deliverable tech specs</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
            {spec.techSpecs
              .filter((t) => t.label || t.value)
              .map((t) => (
                <div key={t.id} className="flex justify-between border-b border-neutral-200 py-0.5">
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-right text-neutral-700">{t.value}</span>
                </div>
              ))}
          </div>
        </>
      )}

      {/* Usage */}
      {spec.usage.some((u) => u.deliverable || u.media) && (
        <>
          <h2 className="mt-5 mb-1 font-display text-[14px] font-semibold">Usage & rights</h2>
          <table>
            <thead>
              <tr className="text-left text-[10px] tracking-[0.06em] text-neutral-500 uppercase">
                <th className="py-0.5">Deliverable</th>
                <th className="py-0.5">Media</th>
                <th className="py-0.5">Territory</th>
                <th className="py-0.5">Term</th>
                <th className="py-0.5">Excl.</th>
                <th className="py-0.5">Options</th>
              </tr>
            </thead>
            <tbody>
              {spec.usage
                .filter((u) => u.deliverable || u.media)
                .map((u) => (
                  <tr key={u.id} className="border-t border-neutral-200 align-top">
                    <td className="py-0.5 font-medium">{u.deliverable}</td>
                    <td className="py-0.5">{u.media}</td>
                    <td className="py-0.5">{u.territory}</td>
                    <td className="py-0.5">{u.term}</td>
                    <td className="py-0.5">{u.exclusivity}</td>
                    <td className="py-0.5">{u.options}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {spec.usageNote && <p className="mt-1.5 text-neutral-700">{spec.usageNote}</p>}
        </>
      )}

      {/* Terms */}
      {onClauses.length > 0 && (
        <>
          <h2 className="mt-5 mb-1 font-display text-[14px] font-semibold">Production terms</h2>
          <div className="flex flex-col gap-1.5">
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
        <div className="mt-6 break-inside-avoid border-t border-neutral-300 pt-3">
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
