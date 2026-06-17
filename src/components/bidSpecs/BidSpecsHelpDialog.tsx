"use client";

import { AICP_RESOURCES } from "@/lib/bidSpecs/clauses";
import Modal from "../Modal";

export default function BidSpecsHelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="AICP bid resources & how it works" onClose={onClose} width={540}>
      <div className="flex flex-col gap-4">
        <section>
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">How it works</h4>
          <ul className="flex flex-col gap-1 text-[12.5px] text-ink-soft">
            <li>• Bid Specs is the document you send out; vendors bid on the named AICP form and those bids come back into the Estimator to level and award.</li>
            <li>• Every field autosaves — locally, to your account when signed in, and to a share link.</li>
            <li>• Toggle production terms on/off; off terms are hidden from the printed sheet.</li>
            <li>• Share copies a link · Export gives text/CSV · Print / PDF makes a clean sheet.</li>
          </ul>
        </section>

        <section>
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-faint uppercase">Official AICP & industry references</h4>
          <div className="overflow-hidden rounded-lg border border-hairline">
            {AICP_RESOURCES.map((r) => (
              <a
                key={r.name}
                href={r.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex flex-col border-b border-hairline px-3 py-2 last:border-b-0 hover:bg-paper"
              >
                <span className="text-[12.5px] font-semibold text-ink">{r.name} ↗</span>
                <span className="text-[11.5px] text-ink-soft">{r.note}</span>
              </a>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            The AICP Bid Form (the 1975 industry standard, current version Jan 2023) runs sections A–X. These links open the official AICP bidding resources.
          </p>
        </section>
      </div>
    </Modal>
  );
}
