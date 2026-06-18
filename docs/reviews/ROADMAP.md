# Workback / Producer's Toolkit — Build Roadmap (next ~14 builds)

_Owner: Program Management. Source of truth for sequencing. Built on the findings
in `docs/reviews/` (UX, graphic, exec producer, line producer, systems) and the
synthesis in `00-program-manager-synthesis.md`. Date: 2026-06-18._

> **How to read this.** A "build" is one shippable increment (≈1 release on the
> train, roughly 1–2 weeks for a small team). Builds are **sequenced by
> dependency, not locked to dates** — durations are estimates and assume a lean
> team (1–2 eng + part-time design/PM). Each build has a hard **exit gate**; we
> don't start the next milestone until the gate is green. P0/P1/P2 tags map back
> to the review synthesis.

---

## 1. Operating model

| Aspect | Decision |
|--------|----------|
| **Cadence** | Release train every ~1–2 weeks; one build per train. Trunk-based; feature branches → PR → CI → merge to `main`. |
| **Environments** | `main` → staging (Firebase preview channel) → production on tag. Today there is only prod; **standing up staging is part of Build 1.** |
| **Definition of Done** | Typecheck + `next build` clean · `verify`/`smoke`/`stress` green · `test:rules` green for any rules change · a11y smoke for new UI · docs updated · feature flag default decided. |
| **Quality gates in CI** | Block merge on the above. (CI currently deploys but does not run the test suite — fixed in Build 1.) |
| **Versioning** | `1.x` through beta, `2.0` at GA. Bump `APP_VERSION` (`src/lib/feedback/feedback.ts`) every build so feedback ties to a build. |
| **Flagging** | New risky surfaces ship behind a flag / entitlement until validated in beta. |
| **Decision log** | Each build records the 1–2 reversible/irreversible decisions it made. |

### Phase map

| Milestone | Builds | Theme | Gate to exit |
|-----------|--------|-------|--------------|
| **A — Beta-ready** | 1–4 | Close every P0 (security, correctness, a11y) | All P0s fixed + staging + CI gates live → **open private beta** |
| **B — Beta hardening** | 5–6 | Listen, fix, make data loss-proof | Crash-free ≥99.5%, top beta bugs closed, no LWW data-loss path |
| **C — Trust & money** | 7–10 | Estimator depth + lifecycle + billing | A producer can build & approve a real budget; a customer can self-serve pay |
| **D — Differentiation & GTM** | 11–13 | One workflow + onboarding + brand | New user reaches "aha" unaided; one cross-module link works; brand is consistent |
| **E — GA** | 14 | Scale, support, launch | SLOs met, pen-test passed, pricing live → **public GA (2.0)** |

---

## 2. Build 0 — Feedback & error capture _(DONE)_

Shipped: in-app feedback (header + footer triggers), first error telemetry,
admin triage queue, `/feedback` rules + tests. This is the listening channel the
rest of the plan depends on. _Ref: `docs/FEEDBACK.md`._

---

## Milestone A — Beta-ready (Builds 1–4)

### Build 1 — "Lockdown" — infra, abuse-proofing, CI/CD hygiene
- **Outcome:** the platform is safe to point strangers at and we can ship without
  breaking prod.
- **Why now:** P0 security + the stale-deploy issue are the highest blast-radius,
  lowest-effort wins; staging/CI unblock everything after.
- **Scope (P0-1, P0-2):**
  - Enable **Firebase App Check** (hook already present, `firebase.ts:29`) on the
    open write nodes (`/shared*`, `/feedback`).
  - Add **size + monotonic-`updatedAt` guards** to `teamWorkspaces` docs and
    `/users/.../projects` in `database.rules.json` (parity with estimates/shares).
  - **Kill or auto-regenerate the stale `docs/` GitHub Pages bundle** — it's a
    second live deployment on the same prod DB running old code. Decide: retire
    Pages, or make CI rebuild it. Add a CI check so it can never drift again.
  - Stand up **staging** (Firebase preview channel) + **CI quality gates**
    (typecheck/build/verify/smoke/rules on every PR; deploy only on tag).
  - Route the existing `catch {}` swallow-sites through `recordError()` so beta
    errors surface in feedback.
- **Exit gate:** App Check enforced; no world-writable node without a size cap;
  one canonical deployment; CI blocks a red build; staging reachable.
- **Depends on:** none. **Risk:** App Check misconfig locking out real users →
  roll out in monitor-mode first. **Size:** M.

### Build 2 — "Trust the dates" — holiday-aware scheduler
- **Outcome:** the schedule never silently lands work on a non-working day.
- **Scope (P0-3):**
  - Wire the existing `closures` array into `src/lib/workback.ts`
    (`countWorkdays`/`addWorkdaysKey`, shift, lock-compression) — today it's only
    a visual grey-out in `layout.ts`.
  - Closures/blackout editing UI; optional holiday-calendar presets.
  - Regression tests in `scripts/verify-logic.ts` for shift/compress/duration
    across single + multi-day closures and a closure adjacent to a locked date.
- **Exit gate:** every scheduling op respects closures; new tests green; a
  delivery can't land on an entered holiday.
- **Depends on:** none (engine-local). **Risk:** edge interaction with locked
  dates → cover in tests. **Size:** M.

### Build 3 — "Trust the numbers" — estimator correctness
- **Outcome:** a producer can trust the totals enough to send the bid.
- **Scope (P0-4):**
  - Fix **tax computed on the un-marked-up subtotal**; define and implement the
    **stacking order** (subtotal → markup → contingency → tax) in
    `src/lib/estimator/totals.ts` / `formula.ts`.
  - **Flag overlapping / zero-length events** produced by compression (warning
    derivation currently only checks against locks).
  - Rounding/precision audit (cents not truncated in actuals/ledger reconcile).
  - Lock behavior with golden-master tests in `scripts/verify-estimator.ts`.
- **Exit gate:** tax/markup/contingency match a hand-worked reference bid;
  compression can't produce a silent overlap; rounding reconciles to the cent.
- **Depends on:** none. **Risk:** changing totals math invalidates saved
  estimates → add a migration/recompute + changelog note. **Size:** M–L.

### Build 4 — "Access for all" — a11y floor + touch parity
- **Outcome:** the core app is operable by keyboard, screen reader, and touch.
- **Scope (P0-5 + P1 touch):**
  - Extract the focus-trap/restore from `Modal.tsx` into a shared hook; apply to
    `Popover.tsx` (event editor, create, +N more, category, account) with a named
    `role="dialog"`.
  - Replace hover-only controls (Estimator row delete/note `opacity-0
    group-hover`) with touch-visible affordances; raise hit areas toward ~44px.
  - Consistent `role="status"` toasts across all three modules.
  - Keyboard + SR audit pass; document known gaps.
- **Exit gate:** event create/edit/delete fully keyboard-operable; line items
  deletable on touch; axe smoke shows no criticals.
- **Depends on:** none. **Risk:** popover focus management regressions → snapshot
  + manual SR check. **Size:** M.

> **🚦 BETA GATE (after Build 4):** all P0s closed, staging + CI live, feedback
> loop running → **invite 3–5 design partners (free, invite-only).**

---

## Milestone B — Beta hardening (Builds 5–6)

### Build 5 — "Listen & fix" — beta loop, metrics, performance
- **Outcome:** we measure real usage and burn down what partners actually hit.
- **Scope:**
  - Bug-bash driven by the **feedback queue**; weekly triage SLA.
  - Privacy-respecting **product analytics** (activation, retention, feature use)
    + an **error-rate dashboard** off the captured errors.
  - **Performance pass:** 40+ event schedule, large estimate grids, mobile
    drag/scroll; set budgets.
- **Exit gate:** crash-free sessions ≥99.5%; activation + retention instrumented;
  no P0/P1 bugs open from partners; perf budgets met.
- **Depends on:** Build 0/1. **Size:** M (mostly burn-down; scope flexes).

### Build 6 — "Data safety" — kill silent data loss
- **Outcome:** concurrent edits never silently clobber a teammate.
- **Scope:**
  - Replace **last-write-wins** on shared/team docs + `/users/.../projects` with
    conflict-aware sync (the app already has a "remote ahead" prompt — extend it
    + add a rule backstop where missing).
  - Versioning groundwork for estimates/specs (snapshots) — feeds Build 9.
  - Backup/restore + trash hardening; migration-path test coverage.
- **Exit gate:** a two-tab concurrent-edit test never loses data; restore works;
  migrations covered by tests.
- **Depends on:** Build 1 (rules guards). **Risk:** sync UX complexity → keep
  "their version / mine" model, don't build full CRDT. **Size:** L.

---

## Milestone C — Trust & money (Builds 7–10)

### Build 7 — "Estimator depth I" — quantity × rate + rate cards
- **Outcome:** it becomes a budgeting tool, not just a bid-comparison tool.
- **Scope (P1):** quantity × rate line model ("10 days @ $5k"), reusable rate
  cards, unit/day/flat types; migrate existing flat-amount lines.
- **Exit gate:** a real day-rate budget builds end-to-end; old estimates migrate
  losslessly; totals tie out with Build 3 math.
- **Depends on:** Build 3. **Risk:** schema migration of saved estimates →
  versioned schema + backfill test. **Size:** L (largest functional gap).

### Build 8 — "Estimator depth II" — fringes, currency, change orders
- **Outcome:** the numbers survive an audit.
- **Scope (P1):** fringe/P&W as a **derived line** scoped to labor; finalize
  markup/contingency/tax stacking on top of qty×rate; **real multi-currency**
  (per-vendor currency + FX) **or** remove the cross-currency leveling
  affordance so it can't mislead; change-order trail.
- **Exit gate:** P&W rolls into section subtotals; cross-currency leveling is
  either correct or gone; change history visible.
- **Depends on:** Build 7. **Size:** L.

### Build 9 — "Lifecycle" — lock → approve → client-ready
- **Outcome:** an estimate/bid spec can be frozen and shared safely with a client.
- **Scope (P1):** estimate/spec **lock & approve** states (immutable once
  approved), **versioned** revisions, **read-only client share links** (distinct
  from editable team links), approval audit trail.
- **Exit gate:** an approved bid can't be silently edited; a client opens a clean
  read-only view; revisions are diffable.
- **Depends on:** Build 6 (versioning), Build 8. **Size:** L.

### Build 10 — "Sell it" — billing & packaging
- **Outcome:** a customer can pay without us touching anything by hand.
- **Scope (P1):** **Stripe** integration; plans/seats/**trial**; make
  `src/lib/entitlements.ts` actually **enforce the `pro` tier** (today it's a
  cosmetic label); billing/account UI; dunning; entitlement↔rules sync; invoices.
- **Exit gate:** self-serve signup → trial → paid → entitlement granted, all
  automated; downgrade/cancel handled; rules enforce paid gating server-side.
- **Depends on:** Builds 7–9 (don't charge for an estimator you can't trust).
  **Risk:** entitlement drift between Stripe and RTDB → single source of truth +
  webhook reconciliation. **Size:** L–XL.

> **🚦 PAID GATE (after Build 10):** trustworthy estimator + lifecycle + billing →
> **open paid self-serve to the beta cohort.**

---

## Milestone D — Differentiation & GTM polish (Builds 11–13)

### Build 11 — "One workflow" — cross-module links
- **Outcome:** the three apps start behaving like one product (the "wow").
- **Scope (P2):** a shared **project** entity; **award a bid → seed a workback**;
  shoot/key dates flow estimate/spec → calendar; deliverables shared across
  modules. Start with the single highest-value link, not all of them.
- **Exit gate:** awarding a bid generates a pre-populated workback in one click.
- **Depends on:** Builds 7–9. **Size:** L.

### Build 12 — "First impressions" — onboarding & GTM surfaces
- **Outcome:** a new user reaches value without a guided tour from us.
- **Scope (P2 + Exec):** first-run onboarding, real empty states, template/sample
  gallery, rename jargon ("Shift downstream"), unify in-app Help across modules,
  surface that the Estimator/Bid Specs exist (today `AppBar` hides itself for
  single-app users), marketing landing page.
- **Exit gate:** unaided new-user activation rate hits target (set in Build 5).
- **Depends on:** Build 5 metrics. **Size:** M–L.

### Build 13 — "Brand & exports" — identity + client-facing polish
- **Outcome:** everything a client sees reads as one, finished brand.
- **Scope (P2 + Graphic):** resolve **one name + one icon set** (favicon/iOS/PWA
  currently differ); **semantic color tokens** (only `--color-danger` exists
  today); shared `<Icon>` component (replace ad-hoc unicode/emoji); **brand the
  client-facing exports** (Gantt PNG/PDF use system fonts + no logo); print
  consistency across modules.
- **Exit gate:** brand audit checklist passes; exported Gantt/PDF carry the brand
  and match in-app type.
- **Depends on:** none (parallelizable with D). **Size:** M.

---

## Milestone E — GA (Build 14)

### Build 14 — "GA readiness" — scale, support, launch
- **Outcome:** ready for unbounded public traffic and paying customers.
- **Scope:** load/scale testing + RTDB cost modeling; **SLOs + alerting**; status
  page; support runbook + intake; **external security review / pen-test**; legal
  (ToS/privacy/DPA); docs/help center; pricing page live; launch comms.
- **Exit gate:** SLOs met under load; pen-test criticals closed; support process
  live → **cut `2.0`, public GA.**
- **Depends on:** all prior. **Size:** L.

---

## 3. Cross-cutting tracks (continuous, every build)

| Track | Standing expectation |
|-------|----------------------|
| **Quality** | Every change ships with tests; CI gates enforced; weekly bug triage. |
| **Security** | Rules change ⇒ `test:rules` case; quarterly review; pen-test at GA. |
| **Observability** | New flows record errors via `recordError`; watch error-rate dashboard. |
| **Design system** | New UI uses shared tokens/components once Build 13 lands; no new ad-hoc colors/icons. |
| **Docs** | `docs/` updated per build; `ADMIN_RUNBOOK.md` kept current. |
| **Feedback** | Triage the in-app queue weekly; close the loop with reporters. |

---

## 4. Risk register (top risks)

| Risk | Impact | Likelihood | Mitigation | Owner |
|------|--------|-----------|------------|-------|
| Open write nodes abused (denial-of-wallet) | High | Med | Build 1 App Check + size caps + monitoring | Eng |
| Estimator math wrong in a sent bid | High | Med | Builds 3/7/8 + golden-master tests | Eng/PM |
| Silent concurrent-edit data loss | High | Med | Build 6 conflict-aware sync | Eng |
| Schema migration breaks saved work | High | Med | Versioned schemas + backfill tests (Builds 3,7) | Eng |
| Billing/entitlement drift | Med | Med | Single source of truth + webhook reconcile (Build 10) | Eng |
| Scope creep delays beta | Med | High | Hard P0-only gate before Milestone A exit | PM |
| Solo/lean capacity | Med | High | Sequence by dependency; parallelize D; cut P2 first | PM |

---

## 5. Success metrics by milestone

- **A (beta-ready):** 0 open P0s · CI gates live · crash-free ≥99% at invite.
- **B (beta):** crash-free ≥99.5% · activation & D7/D30 retention baselined · top
  partner bugs closed.
- **C (money):** ≥1 real budget built+approved by a partner · self-serve paid
  conversion working · estimator math validated against reference bids.
- **D (GTM):** unaided new-user activation target met · ≥1 cross-module link used
  in real projects · brand audit pass.
- **E (GA):** SLOs met under load · pen-test clean · paid logos onboarded
  self-serve.

---

## 6. Now / Next / Later snapshot

- **Now (this train):** Build 1 — Lockdown (security + staging + CI). Highest
  blast-radius, unblocks everything.
- **Next (Milestone A):** Builds 2–4 — trust the dates, trust the numbers,
  accessibility → then open the private beta.
- **Later:** estimator depth → lifecycle → billing (C); then one-workflow,
  onboarding, brand (D); then GA (E).

## 7. Assumptions & open dependencies

- Lean team (1–2 eng, part-time design/PM); durations scale with headcount.
- Stripe is the billing choice (revisit if a marketplace/Paddle is preferred for
  tax handling — could simplify VAT in Build 8/10).
- Decisions still owned by the founder (from the synthesis): **beta shape**
  (free-first recommended), **positioning** (lead with Workback + Bid Specs),
  **name** (pick one brand), **estimator philosophy** (audit-grade vs.
  win-the-bid) — these can shift the C/D ordering.
