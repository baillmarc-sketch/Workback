/** Currency/percent formatting. Intl.NumberFormat instances are cached per
    currency so a large grid doesn't allocate a formatter per cell. */

const fmtCache = new Map<string, Intl.NumberFormat>();

export function formatCurrency(n: number, currency = "USD"): string {
  let f = fmtCache.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      });
    } catch {
      // Unknown currency code — fall back to plain USD so we never throw.
      f = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    }
    fmtCache.set(currency, f);
  }
  return f.format(Number.isFinite(n) ? n : 0);
}

/** Signed percent, e.g. "+12.5%" / "-4.0%" — for column deltas. */
export function formatPctSigned(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

/** Plain percent, e.g. "15%" — for markup/contingency labels. */
export function formatPct(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}

/** Signed currency delta, e.g. "+$1,200" / "-$500". */
export function formatCurrencySigned(n: number, currency = "USD"): string {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(v), currency)}`;
}
