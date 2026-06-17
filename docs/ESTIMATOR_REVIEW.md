# Estimator — Review & Roadmap

_Senior dev + UX review of the Estimator app. Living document: update statuses as
phases ship._

Last updated: 2026-06-17

## Verdict

The **core engine is strong**: a safe formula evaluator (no `eval`), pure-function
totals math, flat RTDB-safe maps with self-healing migration, undo/redo, and a
real battle suite (verify + stress + smoke). Gaps cluster in four areas:

1. **Domain depth** — it models _totals_, not _how budgets are built_ (no
   quantity × rate, rate cards, or category-scoped fringes/taxes).
2. **UX fundamentals** — mobile density, accessibility, discoverability of
   power features, empty states, confirmation consistency.
3. **Access & collaboration** — hardcoded allowlist, last-write-wins sync, no
   roles or read-only shares.
4. **Lifecycle & trust** — no version history, lock/approval, or audit trail.

It's an excellent **single-user comparison tool** today. To be a true _producer's
budgeting tool_ it needs rate-based line modeling and a real access model.

## What's solid — keep

- Formula cells with spreadsheet semantics (`2*15000`, `+10%`), ranges, per-column
  overrides + section × vendor adjustment matrix.
- Four coherent views (All / Versions / Triple Bid / Actuals); awarded bid feeds
  Actuals; adjustments are now trackable lines in Actuals.
- Persistence: localStorage + per-account sync + share links, with migration that
  self-heals corrupted/empty data (RTDB drops empty maps/arrays).
- Strong test coverage of the math and storage layers.

---

## Marked-up gaps

Severity: **P0** correctness/trust/security now · **P1** high-value soon ·
**P2** depth/scale. File refs point at the responsible code.

### A. Correctness & data safety

| Sev | Gap | Where |
| --- | --- | --- |
| ~~P0~~ ✅ | Shared/account `updatedAt` not monotonic — a stale client could clobber newer data | `database.rules.json` — _fixed Phase 0_ |
| P1 | Last-write-wins on shared/account sync; no conflict detection | `state/estimateStore.tsx`, `lib/estimator/account.ts` |
| P1 | Cloud push not flushed on `pagehide` (only localStorage is) — a fast close in the 1200 ms window loses the push | `state/estimateStore.tsx` |
| ~~P2~~ ✅ | Zero-baseline delta shows "0%"; all-sections-excluded silently zeroes a markup | `components/estimator/EstimateGrid.tsx` — _fixed Phase 0_ |

### B. Access & collaboration (security)

| Sev | Gap | Where |
| --- | --- | --- |
| P0 | Hardcoded allowlist — adding a person requires a code deploy | `lib/entitlements.ts` |
| P1 | Shared estimates are open read/write to anyone with the link; no read-only option, no revoke besides unpublish | `database.rules.json`, `lib/estimator/cloud.ts` |
| P2 | No per-estimate roles/delegation (producer vs accountant vs client view-only) | — |

### C. UX & accessibility

| Sev | Gap | Where |
| --- | --- | --- |
| P1 | Mobile grid is dense; resize handle ~2 px (untappable on touch) | `components/estimator/EstimateGrid.tsx` |
| P1 | Power features (override markup, set baseline, award, per-section exclude) hidden behind an unmarked header click; line-note button only on hover | `EstimateGrid.tsx`, `ColumnEditorPopover.tsx` |
| P1 | No first-run/empty-state explanation of the triple-bid → actuals workflow | `EstimatorApp.tsx` |
| ~~P2~~ ✅ | Variance/delta conveyed by color (had a signed value, but no icon/word) | _fixed Phase 0: ▲/▼ + aria-labels_ |
| P2 | Modals/popovers lack focus trap & focus restoration; emoji header icons need `aria-label`; sync dot needs `aria-live` | `Modal.tsx`, `Popover.tsx` (sync dot _fixed Phase 0_) |
| P2 | Inconsistent destructive actions: section/line delete is instant (but undoable); estimate delete uses native `confirm()` and is not undoable; column delete is buried; native `alert/confirm` break the design language | `EstimateGrid.tsx`, `EstimatesDialog.tsx`, `ColumnEditorPopover.tsx` |

### D. Domain depth (the leap to a real budgeting tool)

| Sev | Gap | Notes |
| --- | --- | --- |
| P1 | No quantity × rate line model | "10 days @ $5k" — foundation for the items below |
| P1 | No rate card / line catalog | zero reuse across estimates (already on backlog) |
| P1 | Category-scoped fringes/markups/taxes | adjustments are global %; need labor fringe on labor only, tax by category (section × vendor matrix is a partial step) |
| P2 | Rounding rules; multi-currency; PO numbering/terms/vendor contacts; attachments/uploads (links exist, files don't); PDF-bid scan autofill (premium) | — |

### E. Lifecycle & trust

| Sev | Gap | Notes |
| --- | --- | --- |
| P1 | No version history / change log | Duplicate bumps "v2" but there's no diff, no "which version went to client", no lock-after-approval |
| P2 | Change orders, contingency burn-down, audit log ("who deleted Catering") | — |

### F. Test / ops coverage

| Sev | Gap | Notes |
| --- | --- | --- |
| P2 | Sync/conflict, cloud publish/fetch, account sync, entitlements, CSV export are untested | all current tests are pure-logic (`scripts/verify-estimator.ts`, `stress-estimator.ts`, `smoke-ui.tsx`) |

---

## Roadmap

### Phase 0 — Trust, clarity & a11y quick wins — ✅ shipped (PR #27)

- Monotonic `updatedAt` DB rule (stale-write protection) for estimator paths.
- Always-visible save-status pill with live online/offline detection + `aria-live`.
- "Adjustment on but excluded from every section" → ⚠ warning instead of silent $0.
- Delta vs a $0 baseline → "n/a" instead of misleading 0%.
- Variance/delta ▲/▼ markers + aria-labels (colorblind-safe).

### Phase 1 — Access & collaboration (next)

Finishes the "request access + admin panel" ask.

- Dynamic allowlist in RTDB (replaces hardcoded `entitlements.ts`).
- **Request access** button on the gate (`AppGate.tsx`) after sign-in.
- Owner-only **admin panel** to approve/deny requests and see who has access.
- Read-only vs edit **share role**.
- Conflict **detection** (warn on stale remote; do not auto-merge).

**Open decisions (blocking):**

1. What an approved person gets — **their own** private Estimator workspace
   (matches the per-account model; share specific budgets via links) **vs**
   access to **your** projects (shared team workspace).
2. Where the admin panel lives — owner-only panel **inside the app** **vs** a
   separate **`/admin`** page.

### Phase 2 — Domain depth

Quantity × rate line model (optional per line) → unlocks **rate cards/catalog**
and **category-scoped fringes/taxes** → rounding. Biggest effort, biggest payoff.

### Phase 3 — Lifecycle & trust

Estimate versioning/history + **lock/approve** (frozen client baseline) · change
orders · audit log.

### Phase 4 — Scale & integrations

Grid virtualization for large budgets · Sheets/Excel round-trip · attachments/
uploads + premium PDF-bid scan autofill.

---

## Recommended sequencing

Phase 0 (done) removed the data-loss footguns. **Phase 1** is the right next
step — it unblocks real use by other people and completes work already started.
**Phase 2** is the strategic leap from "comparison tool" to "budgeting tool".
