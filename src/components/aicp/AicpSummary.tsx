"use client";

import { useBid } from "@/state/aicpStore";
import { formatCurrency } from "@/lib/estimator/format";
import {
  categoryTotal,
  estimateColumn,
  actualColumn,
  productionCategories,
  postCategories,
  subtotalAtoK,
  productionInsurance,
  productionFee,
  productionTotal,
  postRecap,
  grandTotal,
  variance,
} from "@/lib/aicp/totals";
import type { Bid } from "@/lib/aicp/types";

/** A summary row with Estimate / Actual / Variance figures. */
function Row({
  bid,
  label,
  est,
  act,
  estCol,
  actCol,
  strong,
  letter,
}: {
  bid: Bid;
  label: string;
  est: number;
  act: number;
  estCol?: string;
  actCol?: string;
  strong?: boolean;
  letter?: string;
}) {
  const v = variance(act, est);
  const cur = bid.currency;
  return (
    <tr className={strong ? "border-t border-hairline-strong font-semibold" : "border-t border-hairline"}>
      <td className="py-1.5 pr-2 text-left">
        {letter && <span className="mr-1.5 inline-block w-4 text-ink-faint">{letter}</span>}
        {label}
      </td>
      <td className="py-1.5 pl-2 text-right tabular-nums">{formatCurrency(est, cur)}</td>
      {actCol && <td className="py-1.5 pl-2 text-right tabular-nums text-ink-soft">{act ? formatCurrency(act, cur) : "—"}</td>}
      {actCol && (
        <td className="py-1.5 pl-2 text-right tabular-nums">
          {act ? (
            <span className={v.abs > 0 ? "text-danger" : v.abs < 0 ? "text-[#10B981]" : "text-ink-faint"}>
              {v.abs > 0 ? "▲" : v.abs < 0 ? "▼" : ""} {formatCurrency(Math.abs(v.abs), cur)}
            </span>
          ) : (
            "—"
          )}
        </td>
      )}
      {/* keep column count stable when there's no estCol fallback */}
      {!estCol && null}
    </tr>
  );
}

/**
 * The AICP summary recap, computed live from the engine: every category total,
 * the A–K production sub-total, insurance + production fee, Production Total, the
 * post-production block, and the Grand Total — Estimate vs Actual vs Variance.
 * This is the cover page of the printed bid and the at-a-glance view on screen.
 */
export default function AicpSummary() {
  const { bid } = useBid();
  if (!bid) return null;
  const estCol = estimateColumn(bid);
  const actCol = actualColumn(bid);
  if (!estCol) return null;

  const cur = bid.currency;
  const E = (n: number) => n;
  const catEst = (id: string) => categoryTotal(bid, id, estCol);
  const catAct = (id: string) => (actCol ? categoryTotal(bid, id, actCol) : 0);

  const prod = productionCategories(bid);
  const post = postCategories(bid);

  return (
    <section className="rounded-lg border border-hairline bg-paper">
      <header className="border-b border-hairline px-4 py-2.5">
        <h2 className="font-display text-[14px] font-semibold">Summary of Estimated Production Costs</h2>
      </header>
      <div className="overflow-x-auto px-4 py-2">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="py-1 text-left font-medium">Category</th>
              <th className="py-1 pl-2 text-right font-medium">Estimate</th>
              {actCol && <th className="py-1 pl-2 text-right font-medium">Actual</th>}
              {actCol && <th className="py-1 pl-2 text-right font-medium">Variance</th>}
            </tr>
          </thead>
          <tbody>
            {prod.map((c) => (
              <Row
                key={c.id}
                bid={bid}
                letter={c.letter + "."}
                label={c.name}
                est={E(catEst(c.id))}
                act={catAct(c.id)}
                estCol={estCol}
                actCol={actCol}
              />
            ))}
            <Row
              bid={bid}
              label="Sub-Total A to K"
              est={subtotalAtoK(bid, estCol)}
              act={actCol ? subtotalAtoK(bid, actCol) : 0}
              estCol={estCol}
              actCol={actCol}
              strong
            />
            <Row
              bid={bid}
              label="Insurance"
              est={productionInsurance(bid, estCol)}
              act={actCol ? productionInsurance(bid, actCol) : 0}
              estCol={estCol}
              actCol={actCol}
            />
            <Row
              bid={bid}
              label="Production Fee"
              est={productionFee(bid, estCol)}
              act={actCol ? productionFee(bid, actCol) : 0}
              estCol={estCol}
              actCol={actCol}
            />
            <Row
              bid={bid}
              label="Production Total"
              est={productionTotal(bid, estCol)}
              act={actCol ? productionTotal(bid, actCol) : 0}
              estCol={estCol}
              actCol={actCol}
              strong
            />

            {post.length > 0 && (
              <>
                {post.map((c) => (
                  <Row
                    key={c.id}
                    bid={bid}
                    letter={c.letter + "."}
                    label={c.name}
                    est={catEst(c.id)}
                    act={catAct(c.id)}
                    estCol={estCol}
                    actCol={actCol}
                  />
                ))}
                <Row
                  bid={bid}
                  label="Post-Production Total"
                  est={postRecap(bid, estCol).total}
                  act={actCol ? postRecap(bid, actCol).total : 0}
                  estCol={estCol}
                  actCol={actCol}
                  strong
                />
              </>
            )}

            <Row
              bid={bid}
              label="Grand Total"
              est={grandTotal(bid, estCol)}
              act={actCol ? grandTotal(bid, actCol) : 0}
              estCol={estCol}
              actCol={actCol}
              strong
            />
          </tbody>
        </table>
      </div>
      <p className="px-4 pb-3 pt-1 text-[11px] text-ink-faint">
        Live recap from the AICP engine. The editable category grid (qty×rate line entry) lands next — totals here update as
        you fill it in. Grand total shown: <span className="font-medium text-ink-soft">{formatCurrency(grandTotal(bid, estCol), cur)}</span>.
      </p>
    </section>
  );
}
