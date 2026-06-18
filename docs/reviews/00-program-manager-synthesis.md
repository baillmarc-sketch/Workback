# Program Manager Synthesis — Pre-Beta Readiness Review

_Prepared from the five role reviews in this folder (UX/UI, Graphic, Executive
Producer, Line Producer, Systems/Senior Eng). Date: 2026-06-18._

## Purpose

The owner wants to take **Workback Builder / Producer's Toolkit** to market and
is battle-testing it before a beta. I commissioned five independent reviews and
synthesized them here into a single prioritized plan, separating **"must fix to
let real people in safely"** from **"must fix to charge money"** from **"the
stuff that makes it a product people choose."**

## The one-paragraph verdict

This is a genuinely strong, production-literate toolkit with a defensible moat
(the workback engine, AICP-aligned bid specs, and credible budget templates are
sharper than Smartsheet/Monday/Excel). The architecture is sound and — important
— **admin authorization is correctly server-enforced**, not a client-side
costume. It is **GO for a free, invite-only design-partner beta** once a short
list of safety/correctness gates is closed, and **NO-GO for paid self-serve**
until billing, a few correctness bugs, and real-money trust features land. The
gaps are identity, consistency, and a handful of silent-wrong-answer bugs — not a
rewrite.

## How the five reviews agree (the cross-cutting themes)

Four independent themes showed up in more than one review. These are the real
signal:

1. **Silent wrong answers in the core math/scheduling.** The Line Producer found
   the engine is holiday-blind, tax is computed on the un-marked-up subtotal, and
   compression can stack events on one day while still showing "green." The Exec
   Producer independently flagged the estimator models *totals*, not *how budgets
   are built* (no quantity × rate). **A tool that quietly produces a wrong
   delivery date or a wrong bid total is the single most dangerous thing here** —
   it destroys trust faster than any missing feature.
2. **No observability / no error capture.** Systems Eng found zero
   `window.onerror`, no error boundary, pervasive `catch {}`. The UX review noted
   there was no feedback mechanism at all. _(This is the gap the new in-app
   feedback feature in this same change set directly addresses — see
   `docs/FEEDBACK.md`.)_
3. **Identity & consistency are unfinished.** Graphic Design: the product can't
   decide if it's "Workback" or "Producer's Toolkit," the favicon and iOS icon
   are different drawings, exports drift off-brand. UX: destructive actions use
   three different confirm patterns; Share/Print behave differently per module.
   None of these is hard; together they read as "not finished."
4. **No monetization layer exists at all.** Exec Producer + Systems Eng both
   confirmed: zero billing/seat/trial/quota code; the `free`/`pro` label is
   cosmetic. You literally cannot charge today without hand-onboarding everyone.

## Master priority list

Severity = blast radius × likelihood, merged across reviewers. P0 = before _any_
outside users. P1 = before charging. P2 = makes it competitive.

### P0 — Gate the beta on these (safety, data-loss, wrong-answers)

| # | Item | From | Why it's P0 |
|---|------|------|-------------|
| P0-1 | **Abuse-proof the open `/shared*` + `/feedback` write nodes** — add App Check (the hook already exists, `firebase.ts:29`), keep the size caps the feedback node now ships with, and apply the same `updatedAt`/size guards to team docs & `/users/.../projects`. | Systems | World-writable, no rate limit = denial-of-wallet / unbounded DB growth. |
| P0-2 | **Delete or auto-regenerate the committed `docs/` GitHub Pages bundle.** | Systems | It's a *stale second production deployment* on the same live DB, running pre-security-fix code. Highest "scary" rating. |
| P0-3 | **Fix the holiday-blind scheduler** — `workback.ts` must read the `closures` array the model already carries. | Line Producer | Silently lands deliveries/shoot days on holidays the user entered. |
| P0-4 | **Fix tax-on-subtotal + flag stacked/zero-length compressed events** — at minimum show the warning; ideally compute tax on (subtotal + markup). | Line Producer | Understates every taxable bid; "green" schedules that are actually broken. |
| P0-5 | **Accessibility floor on the shared `Popover`** (focus trap/restore, labelled dialog) — the event editor is a popover, so the core app is currently keyboard/SR-inoperable. | UX | Legal/ethical floor + the fix is to reuse what `Modal.tsx` already does. |
| P0-6 | **Ship error capture + a feedback channel.** | Systems/UX | ✅ **Done in this change set** (`installErrorCapture` + `/feedback` + Admin → Feedback). Beta needs a way to hear about the P0s above. |

### P1 — Gate paid launch on these (trust + money)

- **Billing**: Stripe + plan/seat/trial + make `entitlements.ts` actually
  enforce the `pro` tier. (Exec)
- **Quantity × rate in the Estimator** + a fringe/P&W derived line. Until this
  ships it's a bid-*comparison* tool, not a budgeting tool. (Line + Exec)
- **Estimate lock/approve + read-only client shares**; replace last-write-wins
  on shared docs so a teammate can't silently clobber an approved bid. (Exec +
  Systems)
- **Multi-currency that's real** (per-vendor currency + FX) or remove the
  leveling-across-currencies affordance so it can't mislead. (Line)
- **Touch parity**: hover-only delete/note controls are invisible on
  touchscreens, contradicting the "fully editable mobile" claim. (UX)
- **Brand resolution**: one name, one icon set, consistent exports. (Graphic)

### P2 — Wins that make it the chosen tool

- Wire **one** cross-module link (award a bid → seed a workback) to start
  delivering the "one workflow" promise. (Exec)
- First-run onboarding / a real empty state / rename "Shift downstream" out of
  jargon. (UX)
- Semantic color tokens; shared `<Icon>` set; brand the Gantt PNG export. (Graphic)
- Consolidate Share/Print behavior across the three modules. (UX)

## Recommended sequencing (battle-test plan)

1. **Week 0 (this change set):** feedback + error capture in. ✅
2. **Week 1 — "stop the bleeding":** P0-1, P0-2, P0-5 (security/ops/a11y — low
   risk, high protection). Stand up the beta behind invite-only.
3. **Week 2 — "trust the numbers":** P0-3, P0-4 + add engine/estimator
   regression tests (`scripts/verify-*`) for holidays, tax, and compression
   overlap so they can't regress.
4. **Invite 3–5 friendly design partners.** Watch the Admin → Feedback queue.
   Triage weekly. This is the real battle test.
5. **Weeks 3–6 — "make it sellable":** P1 stack, billing last (after the
   estimator is trustworthy enough to charge for).

## What we should chat about (open decisions for the owner)

1. **Positioning:** lead with **Workback + Bid Specs** (the strongest, most
   finished surfaces) and let the Estimator mature, or hold launch until the
   Estimator does quantity × rate? My rec: lead with Workback + Bid Specs.
2. **Name:** "Workback" (memorable, describes the hero feature) vs "Producer's
   Toolkit" (the platform). Pick one as the brand and demote the other to a
   tagline. My rec: **Workback** is the brand; "the producer's toolkit" is the
   descriptor.
3. **Beta shape:** free design-partner beta first (my strong rec), or wait for
   billing and go straight to paid? Free-first surfaces the P0 correctness bugs
   with low stakes.
4. **Where the Estimator math should land philosophically** — do we want
   audit-grade (tax/fringe/markup stacking, change-order trail), or "good enough
   to win the bid"? This decides how much of P1 is mandatory vs. fast-follow.
