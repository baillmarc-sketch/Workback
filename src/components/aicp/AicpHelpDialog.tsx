"use client";

import Modal from "../Modal";

/** Quick orientation for the AICP Bid app. */
export default function AicpHelpDialog({ onClose }: { onClose: () => void }) {
  const H = ({ children }: { children: React.ReactNode }) => (
    <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{children}</div>
  );
  const P = ({ children }: { children: React.ReactNode }) => (
    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{children}</p>
  );

  return (
    <Modal title="How the AICP bid builder works" onClose={onClose} width={500}>
      <div className="flex flex-col">
        <P>
          A bid is the full AICP cost form — the lettered categories A–X down the page, with an Estimate column you build
          and an Actual column you track against.
        </P>

        <H>Line entry (qty × rate)</H>
        <P>
          Every line is <span className="font-medium text-ink">Units × Rate × Qty</span> — e.g. 3 days × $1,500 × 2 crew =
          $9,000. Leave Qty blank for 1. Any number field accepts arithmetic, so{" "}
          <code className="rounded bg-surface px-1">1500+10%</code> works. Click <span className="font-medium text-ink">+ Add line</span>{" "}
          to add your own; the ◍ icon hides a line from the printout, ✕ deletes it.
        </P>

        <H>Fringes, fees, insurance</H>
        <P>
          Set the global percentages in <span className="font-medium text-ink">Rates &amp; fees</span>. Labor categories (A,
          B, G, L, M, W) carry fringes; Talent carries a handling fee. On each production category header, the{" "}
          <span className="font-medium text-ink">Fee</span> / <span className="font-medium text-ink">Ins</span> chips control
          whether the production fee and insurance apply to it (A–K are on by default).
        </P>

        <H>P breakouts &amp; versions</H>
        <P>
          <span className="font-medium text-ink">+ Add P breakout section</span> adds an extra production estimate you can
          include or exclude from the total. <span className="font-medium text-ink">+ Version column</span> adds an
          alternate scenario (v2, option B) alongside Estimate and Actual.
        </P>

        <H>Save, share, print</H>
        <P>
          Everything auto-saves locally, backs up to the cloud, and syncs to your account — no save button.{" "}
          <span className="font-medium text-ink">Share</span> copies a link; <span className="font-medium text-ink">Bids</span>{" "}
          switches between saved bids. <span className="font-medium text-ink">Print / PDF</span> exports the classic AICP
          layout (or a modern one), with your logo and an option to auto-hide unused lines and empty sections.
        </P>

        <P>
          <span className="text-ink-faint">⌘Z undo · ⇧⌘Z redo · the Summary tab is the cover recap.</span>
        </P>

        <div className="mt-4 flex justify-end border-t border-hairline pt-3">
          <button
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}
