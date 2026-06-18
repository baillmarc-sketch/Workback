# Executive Producer Review (Product & Market)

## Reviewer role & scope

I reviewed Workback Builder as a seasoned Executive Producer at a creative/production
agency would — through a commercial and product-market lens, not an engineering one. The
question I'm answering is: *would I pay for this, roll it out to my team, and put its
outputs in front of a client?* I read the actual code (not the marketing): the workback
engine, the Estimator (`src/lib/estimator/totals.ts`, `formula.ts`, `templates.ts`,
`types.ts`, plus the grid/actuals/export UI), Bid Specs (`src/lib/bidSpecs/*`,
clause library, exports, print view), the access/entitlements layer
(`src/lib/entitlements.ts`, `src/lib/admin/*`, `src/lib/teamWorkspace.ts`,
`src/lib/toolkit.ts`), and the existing internal roadmap (`docs/ESTIMATOR_REVIEW.md`).
This review covers product-market fit, feature completeness end-to-end, trust in the
numbers and client-facing outputs, monetization/packaging, differentiation, and
go-to-market readiness. It does **not** cover code quality, security hardening, or
infra except where they bear directly on commercial viability.

## Executive summary (3-5 sentences)

Workback Builder is three genuinely useful, production-literate tools — a best-in-class
workback calendar, a credible bid-comparison Estimator, and an AICP-aligned Bid Specs
writer — bundled under one roof with a real shared identity, teams, and admin layer. The
products are built by someone who clearly knows the agency production workflow: the
templates, the AICP clause library, the triple-bid leveling, and the workback logic all
ring true, and the calendar in particular is sharper than what most agencies do today in
Smartsheet or PowerPoint. The two things standing between this and a marketable product
are commercial, not technical: (1) **there is no monetization layer at all** — access is
100% manual admin grants, with zero billing, subscriptions, seats, or trials — and (2)
**the Estimator models totals, not how budgets are actually built** (no quantity × rate,
no rate cards, global-only fringes), which is the one gap a working producer will notice
in the first ten minutes. It is beta-ready for a *hand-picked, free design-partner cohort*
this quarter, but it is not yet a self-serve commercial product. Pick one wedge (I'd lead
with Workback + Bid Specs), make it self-serve and billable, and add quantity×rate to the
Estimator before charging for it.

## What's genuinely strong / sellable

- **The workback calendar is the wedge, and it's excellent.** Lock-delivery-date with
  proportional gap compression, shift-downstream, review-round pairs with "duplicate
  round," workday-aware spanning, undo + persistent browsable history with restore, and
  five export formats (rich-text list, week overview, Gantt PNG, CSV, .ics) plus a real
  print-CSS PDF. This is the single most polished thing in the suite and it solves a
  daily, visceral agency pain — rebuilding a timeline in a deck every time a date slips.
  Nothing in Smartsheet/Monday/Excel does true workback (start moves, delivery never
  does) this cleanly, and StudioBinder/ShowRunnr don't really do agency workbacks at all.

- **Production literacy is real and it's a moat against generic tools.** The Estimator
  ships with credible video and event/experiential templates (real sections: Talent &
  Usage with "OCP incl. P&W," CMC Fee, P&W, music licensing tiers, glam; event
  fabrication/scenic/AV/strike), and starter assumptions blocks that read like an actual
  producer wrote them. Bid Specs is built on the AICP form vocabulary (firm vs cost-plus,
  the ~54-item provided-by checklist, OCP/EXB/VO talent counts, a 21-clause library with
  modern additions like AI disclosure, intimacy coordinators, and Green The Bid). A
  Smartsheet template can't credibly claim this. This domain fluency is the most
  defensible asset in the whole product.

- **Triple-bid leveling + actuals is a legitimate, sellable feature.** Internal "version"
  scenarios vs vendor "bid" columns, an awarded-bid flag, per-column and per-(section ×
  vendor) adjustment overrides, a baseline/delta row, and an Actuals view driven by a
  PO/invoice ledger (Committed = Σ POs, Actual = Σ invoices, Outstanding, Remaining).
  That's a coherent estimate → bid → award → track arc that genuinely competes with the
  Excel-and-email status quo for bid comparison.

- **The "platform" framing is right and already plumbed.** One sign-in, a toolkit menu
  bar, shared Google auth, team workspaces with denormalized grants, a real admin panel
  (users, invites, requests, teams, audit log, view-as), and a clean app registry where
  "adding an app = one entry." This is the correct architecture for "the Producer's
  Toolkit" and it's further along than most pre-beta products.

- **Outputs are client-credible.** Both the Estimator PDF (logo, project info grid,
  deliverables, sectioned budget with subtotals/adjustments/total, assumptions block) and
  the Bid Specs print view (AICP-style bordered grids, signature block) are print-CSS, not
  canvas screenshots — they look like documents, not app screenshots. I would not be
  embarrassed to send either to a client. CSV and .ics exports mean the data is never
  trapped.

## Findings & gaps (each tagged [Critical]/[High]/[Medium]/[Low])

### Monetization & business model

- **[Critical] There is no monetization layer whatsoever.** Searched the entire `src/`
  tree: zero Stripe/billing/subscription/checkout/trial/seat/quota code. Access to the
  "pro" apps is granted by hand in the admin panel (email invite, self-serve request →
  admin approve, or direct grant). The `entitlement: "free" | "pro"` field in
  `src/lib/toolkit.ts` is a **UI label only** — `src/lib/entitlements.ts` never consults
  it for payment; it checks owner/admin/grant/team/invite booleans. You cannot sell this
  today without manually onboarding every single customer. This is the #1 thing to fix
  before any paid beta.

- **[High] No usage limits, seat counting, or plan tiers exist** in the data model
  (`database.rules.json` entitlements node is just `estimator` + `estimatorViaTeam`
  booleans). There's nothing to meter, so there's no natural free→paid upgrade trigger.
  Packaging has to be designed from scratch (see Monetization section).

- **[Medium] The owner email is hardcoded** (`OWNER_EMAILS = ["baillmarc@gmail.com"]`).
  Fine as a bootstrap, but it means "the business" is currently one Google account. Before
  commercial launch this needs to be a proper org/owner concept (it partially is, via
  pinned owner UIDs, but the hardcode is a tell that this is still a personal project).

### Estimator — would a producer trust the numbers?

- **[Critical for "budgeting tool" positioning] The Estimator models totals, not how
  budgets are built.** There is no quantity × rate line model ("10 days @ $5,000"), no
  rate card / line catalog for reuse across estimates, and fringes/markup/tax are global
  percentages (the section × vendor matrix is a partial mitigation, not a fix). Every cell
  is a typed expression or a flat number. A working line producer builds budgets bottom-up
  from day rates and quantities; the first thing they'll try is "5 × 1200" and they'll
  find it works as arithmetic but there's no structured days/rate they can flex later.
  This is the single biggest credibility gap for the *budgeting* use case and the
  internal roadmap already flags it as P1. **Until this ships, sell the Estimator as a
  bid-comparison/leveling tool, not as a budgeting tool.**

- **[High] The core math is trustworthy and that matters.** I read `totals.ts` and
  `formula.ts` conceptually. Order of operations is fixed and additive (markup and
  contingency both computed off the raw subtotal, then summed — not compounded), which is
  the conservative, defensible convention and should be *stated on the PDF* so a client's
  finance team can reconcile it. The formula evaluator is a real shunting-yard parser (no
  `eval`), with sensible spreadsheet percent semantics (`15000+10%` = 16,500; `15000*10%`
  = 1,500), division-by-zero guarded, ranges normalized low≤high. This is genuinely
  trustworthy and a selling point — but the markup-vs-compounding convention is invisible
  to the user and should be surfaced.

- **[High] No estimate lifecycle: no lock/approve, no version history/diff, no audit
  trail.** "Duplicate" makes a v2 but there's no record of *which version went to the
  client*, no freeze-after-approval, no "who changed Catering." For real money moving
  through a tool, a producer (and their business manager) needs a defensible "this is the
  approved number." Roadmap has this as Phase 3; it's a trust blocker for finance buyers.

- **[High] No PO/change-order generation or accounting hand-off.** The ledger is
  manual-entry only — no PO document, no vendor email, no invoice matching, no QuickBooks/
  Xero/NetSuite/Deltek export, no GL/cost codes. Actuals tracking is a closed loop that
  can't talk to the systems that actually pay vendors. Fine for a lightweight tool;
  a dealbreaker for being the system of record.

- **[Medium] Last-write-wins sync with no conflict detection** on shared/account
  estimates. For a calendar this is acceptable ("anyone with the link" Drive model). For a
  budget where two producers edit numbers, silently clobbering a teammate's figures is a
  real-money trust risk. Read-only shares don't exist yet either.

- **[Low] Only 6 hardcoded currencies, no rounding rules.** Fine for US/UK/EU/AU/CA/JP
  agencies; a gap for global productions and not extensible without a code change.

### Bid Specs

- **[High] No usage-rights term library or SAG-AFTRA session/buyout structure.** The
  usage matrix and buyout are free text. Usage and talent buyouts are where bids actually
  get won, lost, and disputed; pre-built term presets ("US TV 1yr, non-excl, renewable,"
  "Global digital 2yr") and a guided session/buyout builder would be a genuine
  differentiator and are conspicuously absent.

- **[Medium] Clause library is broad but missing vendor-risk terms** — no kill/cancellation
  fees or reschedule penalties (the cancellation clause covers force majeure only), no
  explicit footage/deliverable IP-ownership clause, and insurance limits are generic (no
  $1M/$2M GL specifics). These are exactly the clauses a production company's business
  affairs lead scans for first.

- **[Medium] No approval/lock states and no role-based sharing** (shared link is
  all-or-nothing read-write). A spec that vendors can silently edit after the Q&A deadline
  is a process risk.

- **[Low] PDF export is browser-print only** (no one-click server-side PDF, no Word/Google
  Docs, no email-from-app). Works, but adds a manual step.

### Suite-wide workflow & PMF

- **[High] The three modules don't actually connect into one workflow.** The pitch is
  concept → estimate → workback → bid → deliverables, but the Estimator, Bid Specs, and
  Calendar are separate documents with separate stores. Awarding a bid doesn't seed a
  workback; an estimate's shoot dates don't flow to the calendar; deliverables aren't
  shared between Estimator and Bid Specs. Today it's three good apps sharing a login, not
  one workflow. The *integration* is the eventual "wow," and right now it's missing.

- **[Medium] No client-facing deliverables/review layer.** The README's own implied arc
  ends at "client deliverables," but there's no asset review, approval, or
  client-presentation surface — exports are the end of the line. Incumbents
  (Frame.io for review, StudioBinder for call sheets) own adjacent steps this doesn't
  touch.

- **[Medium] Mobile/accessibility and discoverability gaps in the Estimator** (per the
  internal review: 2px resize handles, power features hidden behind unmarked header
  clicks, no first-run explanation of the triple-bid → actuals flow). These hurt
  self-serve adoption specifically, where there's no one to train the user.

## Competitive positioning

| Need | Incumbent today | Where Workback Builder wins | Where it loses |
| --- | --- | --- | --- |
| Workback / timeline | Smartsheet, Monday, Excel, PowerPoint | True workback (lock delivery, compress gaps), review rounds, one-click client PDF/Gantt, .ics — purpose-built, not a generic grid | No resourcing, dependencies-as-graph, or portfolio view; single-project |
| Production budgeting | Excel, Showbiz/Movie Magic, Hot Budget, Deltek | Agency-native templates, triple-bid leveling, actuals ledger, clean PDF | No quantity×rate/rate cards, no fringe engine, no accounting integration, no approval lock |
| Bid specs / bid solicitation | Word/PDF AICP forms, email | Digital AICP-aligned spec, modern clauses, live share | No vendor portal, no usage/talent term library, no bid-back comparison loop |
| Production management | StudioBinder, ShowRunnr, Yamdu | Lighter, sharper on the workback + estimate slice | No call sheets, shot lists, contacts, scheduling, file review |

**The honest positioning:** Workback Builder is not trying to be StudioBinder (production
management) or Deltek (enterprise project accounting), and it shouldn't. Its defensible
niche is **the agency producer's pre-production paperwork** — the workback, the ballpark/
estimate, and the bid spec — the stuff agencies do in Excel and decks today because no
focused tool exists. That's a real, underserved wedge. The risk is positioning it as a
"production management platform" and getting compared (unfavorably, on breadth) to tools
that have a 5-year head start.

**Buyer & value prop:** The buyer is a Head of Production / Executive Producer / line
producer at a small-to-mid creative agency or production company (5–150 people). The core
value prop in one line: *"Stop rebuilding timelines and budgets in Excel and decks — a
producer-native toolkit for workbacks, estimates, and bid specs that exports client-ready
in one click."* The economic buyer cares about producer time saved and not embarrassing
themselves in front of clients; both are real and present here.

## Monetization & packaging recommendation

You're starting from zero on revenue plumbing, so design it deliberately. Recommended
model:

- **Free (Workback only, signed out or in):** Keep the calendar fully free and public.
  It's the wedge, the SEO/word-of-mouth engine, and the thing that gets a producer to
  trust you. Don't gate it. This is already how the code treats it (`workback` is always
  entitled).

- **Pro — per-seat, ~$15–25/user/mo (Estimator + Bid Specs + accounts/sync/teams):** The
  "pro" apps already exist in the registry. Gate them behind a real subscription. Per-seat
  is the natural fit because agencies buy seats and the team-workspace model is already
  built. A logical free→paid trigger once limits exist: free users get N saved
  estimates/specs or N shared docs; Pro is unlimited + team workspaces + read-only/role
  shares.

- **Team/Agency — flat per-org with admin, audit, SSO later:** The admin panel, audit log,
  and teams are already built — package them. This is where you charge $300–800/mo for a
  studio and where the audit/lock/approval features (once they exist) earn their keep.

What has to be built to charge anything:

1. **Stripe (or similar): customer, subscription, plan-tier, seat-count records**, plus
   webhook → write subscription status into `/entitlements`.
2. **Make `hasEntitlement()` consult subscription state**, not just admin grants. The
   access architecture is already data-driven and granular, so this is a clean extension —
   the hard part is the billing side, which is entirely absent.
3. **A self-serve checkout + a free trial (14 days) with an expiry check.** Today every
   user is hand-approved; that does not scale past a design-partner cohort.
4. **At least one metered limit on the free tier** to create an upgrade reason.

Pricing reality check: anchored against Smartsheet (~$9–32/user/mo), Monday (~$9–19),
StudioBinder (~$29–99), this priced at ~$19–25/seat for Pro is defensible *if* the
Estimator gets quantity×rate; without it, $19 is a stretch for the Estimator alone but
fair for Estimator + Bid Specs + the calendar's pro/team features together.

## Go / no-go for beta, and the 5 things needed first

**Verdict: GO for a free, invite-only design-partner beta this quarter. NO-GO for a paid,
self-serve commercial launch** until the five items below are done. The product is real
and the domain fluency is rare; what's missing is the commercial wrapper and one Estimator
depth gap. Run a free beta now to validate PMF and harvest testimonials/case studies, and
build the monetization layer in parallel — don't wait for one to start the other.

The 5 things needed first (in priority order):

1. **A monetization layer (Stripe + plan/seat/trial + entitlement enforcement).** Without
   this there is no business, only a hand-onboarded tool. Highest priority, biggest lift,
   entirely greenfield.

2. **Quantity × rate in the Estimator** (optional per line), even before full rate cards.
   This is the difference between "comparison tool" and "budgeting tool" and it's the
   first thing a producer will reach for. Until it's in, market the Estimator only as a
   bid-leveling/comparison tool so you don't over-promise.

3. **Estimate trust features: lock/approve + version-to-client tracking + read-only
   shares.** For real money to move through it, a producer needs a defensible "approved
   number" and protection from a teammate's last-write-wins clobber.

4. **Decide and sharpen the positioning to ONE wedge, and make that flow connect.** My
   recommendation: lead with "Workback + Bid Specs for agency producers," wire at least
   one cross-module link (award a bid → seed a workback, or share deliverables between
   Estimator and Bid Specs), and write the marketing site around that single workflow —
   not "a platform."

5. **Self-serve onboarding polish: first-run/empty-state guidance, the triple-bid →
   actuals explainer, and fix the hidden power-features/discoverability + mobile-density
   issues.** In a paid self-serve beta there's no one to train the user; the product has
   to teach itself, and right now its best features are hidden behind unmarked clicks.
