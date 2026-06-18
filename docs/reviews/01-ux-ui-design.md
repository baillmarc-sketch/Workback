# UX/UI Design Review

## Reviewer role & scope

Senior UX/UI designer, interaction-design review only (no engineering/security/perf
assessment except where it changes the user-facing experience). Scope is the whole
"Producer's Toolkit" web app at `/home/user/Workback`: the Workback calendar, the
Estimator, the Bid Specs module, the cross-app navigation, and the admin/access gates.
This is a pre-beta "battle test": the goal is to find what would frustrate, confuse, or
exclude a paying first-time user before the product ships.

Everything below is grounded in the actual source (file:line references where useful). I
read the navigation shell, the Workback interaction stack, and the shared dialog/popover
primitives directly; the Estimator/Bid Specs grids and the accessibility primitives were
audited in depth as well. No source was modified.

## Executive summary

The product is unusually polished for pre-beta: the Workback calendar's core loop
(click-to-create, drag-to-move, shift-downstream, lock, compress, undo/history) is fast,
direct, and well-fed back to the user, and the three modules share genuinely consistent
chrome (one `Modal`, one `Popover`, near-identical headers/toolbars/list dialogs) so it
reads as one product. The biggest systemic weakness is **accessibility of the `Popover`
primitive** — five of the most-used surfaces (event editor, create, "+N more", category
editor, account menu) have no focus trap, no focus move-in, no focus restore, and an
unnamed `role="dialog"`, which makes keyboard- and screen-reader-driven editing close to
impossible even though `Modal` does all of this correctly. The second systemic weakness is
**touch parity**: hover-only affordances (event-bar resize handles, the Estimator's delete
and note buttons) and a README that overpromises "fully editable" mobile leave real gaps on
phones. Onboarding is thin — there is no first-run tour or "what is this" moment; the app
relies on a single dashed hint and a sample project. Finally, destructive actions are
inconsistent (a polished `ConfirmDialog` exists but native `confirm()` and confirmation-less
deletes are used in many places), which matters directly for trust and for the planned
feedback button.

## Strengths

- **The core Workback loop is excellent.** Click an empty day to create
  (`App.tsx:469`), click an event to edit in place (`EventPopover.tsx`), drag to move,
  drag edges to resize (`EventBar.tsx:100-123`), Shift-drag to shift downstream. The
  "shifted-pulse" animation (`globals.css:39-49`, triggered via `Calendar.tsx:93-97`) is
  functional feedback, not decoration — it shows the user exactly what moved.
- **No save buttons, everything auto-commits**, with an undo stack and a browsable,
  restorable History. This is the right model for a scheduling tool and is applied
  consistently across all three modules.
- **`Modal.tsx` is a textbook accessible dialog**: focus move-in (`:32`), Tab focus trap
  (`:33-46`), focus restore to opener with an in-DOM guard (`:50-51`), Escape (`:20-24`),
  click-outside (`:60`), `role="dialog"` + `aria-modal` + `aria-label` (`:64-66`), labeled
  close button (`:73-77`). Every dialog built on it inherits this.
- **Strong cross-module consistency.** Estimator and Bid Specs reuse `Modal`, `Popover`,
  `AccountButton`, byte-identical toolbar button classes, twin headers, and identical
  live-presence / "Reload theirs / Keep mine" reconciliation banners. The platform feels
  cohesive.
- **Reduced-motion is respected** (`globals.css:66-79`) and a global `:focus-visible` ring
  is defined (`:82-86`) — both easy to forget and both done.
- **Rich, well-labeled in-context feedback**: sync-status pill, viewer presence banner,
  the warnings summary button (`WarningsButton.tsx`) with "Override all / Restore all",
  conflict flags on bars with their own tooltips (`EventBar.tsx:136-144`), and copy-confirm
  micro-states across export dialogs.
- **Touch-aware autofocus**: inputs use `autoFocus={!isCoarsePointer()}`
  (`CreatePopover.tsx:141`, `EventPopover.tsx:51`) to avoid the mobile keyboard popping
  up unbidden — a thoughtful detail.

## Findings

### Information architecture & navigation

**[High] The app's identity and the three modules are nearly invisible to a first-time
user.** The `AppBar` (the only cross-module navigation) **hides itself entirely** unless the
signed-in account can access more than one app (`AppBar.tsx:22`: `if (apps.length < 2 &&
!isAdmin) return null`). Since the Estimator and Bid Specs are gated `pro` and Workback is
the public default, a brand-new visitor sees *no* "Producer's Toolkit" bar, no tabs, and no
hint that the other two products exist. The product can't market its own breadth. Even the
`<title>` is "Workback — Producer's Toolkit" but the running app never shows the toolkit
framing to the people who'd buy it. *Recommendation: always render the brand bar; show
locked/`pro` tabs with a lock affordance that routes into the existing `AppGate` request
flow, instead of hiding them.*

**[Medium] Module switching lives only in a top bar that scrolls away and is stylistically
disconnected from each app's own header.** Each module then has its *own* second header
(title + Projects/Estimates/List + AccountButton) directly below. So there are two header
bands with two different "account" affordances conceptually, and the active-app cue (a small
filled tab in `AppBar`) is far from the content. *Recommendation: unify into a single
persistent app chrome; consider making the brand bar sticky like the toolbars are.*

**[Medium] Routing is hash-based and partly inconsistent.** `setApp` clears the hash for
Workback but writes `#app=estimator` for others (`toolkit.ts:69-77`), while share links use
`#e=`, `#bs=`, `#p=`, `#wb=`. A user who bookmarks `#app=estimator` lands correctly, but the
mixed scheme and the silent `history.replaceState` mean back-button behavior between modules
is unpredictable (switching apps doesn't push history). *Recommendation: decide whether
module switches are navigations (pushState, back-button works) or not, and apply it
uniformly.*

**[Low] Admin tab visibility is correct but the "Claim admin access" bootstrap
(`AdminGate.tsx`) is a power-user affordance with no explanation for anyone else.** Fine for
now; just flag it doesn't belong in a marketed surface.

### Core interaction flows

**[High] Destructive deletes are inconsistent and several have no confirmation or undo
affordance surfaced to the user.** Deleting an event from `EventPopover.tsx:251-259` and via
the Delete/Backspace key (`App.tsx:570-575`) is immediate with **no confirm and no toast**.
Undo exists (⌘Z) but the user is never told. Meanwhile a polished `ConfirmDialog.tsx` exists
and its own header comment says native `confirm()` "broke the design language" — yet
`ProjectsDialog.tsx` (`:279,300,373`), `ShareDialog.tsx:80` (reset link), and
`CategoryEditorPopover` all use native `confirm()`. So the app has three different
destructive-action patterns: silent delete, native `confirm()`, and the nice
`ConfirmDialog`. *Recommendation: route every destructive action through `ConfirmDialog`,
and after a no-confirm delete show a toast with an Undo button.*

**[Medium] Drag-to-create the *only* way to set an event longer than one day at creation
time is missing.** `CreatePopover` always creates a single-day event (`startDate = endDate =
day`, `CreatePopover.tsx:56-66`); to make it multi-day you create it, then drag the edge.
There's no drag-across-days-to-create and no end-date field in the create popover (the edit
popover has one). For a *workback* tool where durations are the point, this is friction.
*Recommendation: add a duration/end-date control to `CreatePopover`, or support
click-drag-across-days to create a span.*

**[Medium] The single most important power-feature — Shift-drag downstream — is discoverable
only by accident.** It's surfaced via a drag-overlay hint (`Calendar.tsx:276-280`), a
toolbar toggle (`Toolbar.tsx:86-93`), the empty-state hint, and the footer, which is
actually good coverage — but the toggle's icon `⇉ Shift` and the concept of "downstream"
are jargon. A first-timer won't know what "shift everything downstream" means without
trying it. *Recommendation: in the empty/onboarding state, show a one-line plain-language
explanation ("move a date and everything after it moves too").*

**[Medium] Resize handles are hover-only and invisible until hover.** `EventBar.tsx:100-123`
renders the edge grips at `opacity-0 group-hover/bar:opacity-100`. There is a coarse-pointer
fallback (`pointer-coarse:opacity-60`) which is good, but on desktop a user has no static
signal that bars are resizable. *Recommendation: a subtle persistent edge affordance, or a
resize cursor hint on the whole bar.*

**[Low] Sharing is a strong flow but the "Share" button does two things at once.** Clicking
Share both opens the dialog *and* copies the link immediately (`App.tsx:331-334`). That's
convenient, but the toast "Link copied" can fire before the user realizes they shared. The
fallback states are handled well (`App.tsx:305-328`). Minor: the reset-link confirm is a
native `confirm()` (see above).

**[Low] README/behavior mismatch on a default that affects every new event.** README says
"Include weekends checkbox (on by default)" but `CreatePopover.tsx:32` initializes
`includeWeekends = false` (i.e., weekends excluded by default). Whichever is intended, the
docs and the create popover should agree, because it silently changes where new bars land.

### Onboarding & empty states

**[High] There is no first-run onboarding.** A first-time Workback user is dropped into a
`sampleProject()` (`App.tsx:185-187`) with a single dashed hint above the grid ("Click any
day to add your first event…", `App.tsx:673-679`) that only appears when there are zero
events — and the sample project *has* events, so a true first-timer may not even see it.
There is no tour, no "what is a workback", no callout of Share/Export/Print, and the help
that exists (`ShortcutsDialog`) is reachable only by pressing `?` or a footer link. For a
product being marketed to producers who've never seen it, this is the biggest adoption risk
after accessibility. *Recommendation: a dismissible first-run overlay or coachmarks on the
three highest-value actions (create, shift-downstream, share/export), plus a visible Help
button in the toolbar.*

**[Medium] Help is inconsistently discoverable across the three modules.** Workback: `?` +
footer link, **no toolbar button**. Estimator: `?` + footer link, **no toolbar button**
(`EstimatorApp.tsx:275-287`) — and it's the most complex, formula-driven module.
Bid Specs: `?` + footer link **plus** a toolbar "AICP guides" button
(`BidSpecsToolbar.tsx:63-65`). So the one module that least needs a button has one. The
dialogs also differ in kind: `ShortcutsDialog` and `EstimatorHelpDialog` are keyboard/concept
references; `BidSpecsHelpDialog` is a links-and-bullets page with no shortcuts, so muscle
memory built in two modules breaks in the third. *Recommendation: a Help/`?` button in every
toolbar, and a consistent help dialog shell across modules.*

**[Medium] Empty sub-states inside a populated doc give no guidance.** A Workback "+N more"
overflow is fine, but e.g. a brand-new blank-template project, or an Estimator section with
all line items deleted, shows structure with no "add your first…" prompt. *Recommendation:
inline empty-row prompts.*

**[Low] Bid Specs "New" has no template picker** while the Estimator and Workback both offer
a "Start from" template row (`ProjectsDialog.tsx:219-242`, `EstimatesDialog`). Minor
inconsistency in the create flow.

### Mobile / responsive

**[High] Several core actions are hover-only and therefore unreachable on touch, despite the
README claiming the app is "fully editable" on mobile.** In the Estimator grid the per-row
**delete (×) and note (🗒) buttons are `opacity-0 group-hover:opacity-100`** — on a
touchscreen with no hover they never appear, so a user cannot delete a line item or open a
note from the grid at all. The inline tip even says "Hover a line for the 🗒 note button,"
instructing an interaction that doesn't exist on touch. Workback's resize grips have a
coarse-pointer fallback, but the Estimator's row controls do not. *Recommendation: make
row controls always-visible (or tap-to-reveal) on coarse pointers.*

**[Medium] Touch targets are frequently below the ~44px guideline.** Toolbar buttons are
`px-2.5 py-1.5` ~28px tall (`Toolbar.tsx:18`); month-nav `‹ › Today` and the `1M/2M/3M`
segmented control are small and tightly packed; Bid Specs provider toggles are ~20×24px.
Fiddly on phones. *Recommendation: enforce a 44px min hit area on primary controls,
especially the sticky toolbars.*

**[Medium] No explicit responsive viewport hardening.** `layout.tsx` sets a `Viewport`
export with theme color but not an explicit `width=device-width` (Next injects a default).
The calendar grid itself is dense; on a phone the multi-month stack and small day cells make
target acquisition hard. *Recommendation: verify the meta viewport and test the grid at
360px.*

**[Low] Done well:** `Popover` correctly becomes a bottom sheet on narrow viewports
(`Popover.tsx:66-79`) with a drag handle and safe-area padding; touch drag uses a 250ms hold
so swipes still scroll (`Calendar.tsx:74`). These are real responsive wins — the gap is in
the hover-only controls and target sizes, not the layout strategy.

### Accessibility

**[Critical] The `Popover` primitive is not accessible, and it backs five high-traffic
surfaces.** `Popover.tsx` renders `role="dialog"` (`:71,85`) with **no accessible name, no
`aria-modal`, no focus move-in, no focus trap, and no focus restore** to the trigger. It is
rendered in a portal at `document.body`, far from the trigger in DOM order. Consequences:
- Opening the **event editor, create popover, "+N more", category editor, or account menu**
  leaves focus on the trigger; a keyboard/SR user must Tab across the entire page into the
  portal to reach the controls, with nothing announced.
- Tab walks straight back out into the page behind the open popover.
- On close, focus is lost to `<body>`.

Because editing an event *is* the product, this effectively makes the calendar
non-operable by keyboard/screen-reader users. *Recommendation: lift `Modal`'s focus
trap/restore into a shared hook and have `Popover` use it; accept a `label`/`labelledby`
prop and set the day/title header as the dialog name.*

**[High] Form inputs in the popovers lack accessible names.** Start/End date inputs in
`EventPopover.tsx:141-157` use visual `<label>`s with no `htmlFor`/wrapping, so the date
fields have no programmatic name; the free-text time inputs in both `EventPopover` and
`CreatePopover` are placeholder-only (placeholders are not names). *Recommendation:
associate labels (`htmlFor`/`id` or wrap) and add `aria-label="Time"`.*

**[Medium] Dynamic status/alerts are not announced.** The conflict/warning banner in
`EventPopover` (`:71+`) and the sign-in error in `AccountButton.tsx:36` are not
`role="alert"`/`aria-live`, so they're silent to screen readers when they appear. The
Workback toast has `role="status"` (`App.tsx:760`) — good — but the Estimator and Bid Specs
toasts do **not** (`EstimatorApp.tsx:307`, `BidSpecsApp.tsx:267`), an inconsistency.
*Recommendation: `role="alert"` on errors/conflicts; `role="status"` on all three toasts.*

**[Medium] `AccountButton` trigger doesn't advertise its popup.** No `aria-haspopup`/
`aria-expanded` (`AccountButton.tsx:45-52`). Low effort, real SR benefit.

**[Medium] No body scroll-lock behind modals or bottom sheets.** Neither `Modal` nor
`Popover` locks background scroll; on mobile the page scrolls behind an open sheet.

**[Medium] Category/preset color selection sometimes relies on color alone.**
`CategorySwatches` exposes selection via `aria-pressed` (good), but its hover label readout
doesn't update on keyboard focus and isn't `aria-live`; `CategoryEditorPopover`'s preset
swatches have **no** programmatic selected state (selection is a CSS ring only) and its
label-name input has no accessible name. *Recommendation: mirror `CategorySwatches`'
`aria-pressed` pattern; add `aria-label` to the name input; add `onFocus` to the readout.*

**[Low] `Modal` uses `aria-label={title}` rather than `aria-labelledby` pointing at the
visible `<h3>`** (`Modal.tsx:66,72`), and has no `aria-describedby`. Minor; the dialog is
still named.

**[Low] Color contrast of secondary text.** `--color-ink-faint: #a3a29b` on `--color-paper:
#fafaf8` is roughly 2.1:1 — below WCAG AA (4.5:1) for the small `[11px]/[11.5px]` faint text
used pervasively (footers, captions, "current" tags, status pill labels). `--color-ink-soft:
#6f6e69` (~4.7:1) is borderline-OK at normal size. *Recommendation: darken `ink-faint` to at
least ~`#8a897f` for any text it's used on, or reserve it for non-text decoration only.*

### Consistency of patterns across modules

**[Medium] "Share" and "Print" behave differently per module under the same labels.**
Workback's Share opens a full **Share & export** dialog (link + share code + load-from-code +
JSON/.ics import, `ShareDialog.tsx`) and copies the link; the Estimator and Bid Specs Share
buttons **just copy a link and toast** — no dialog, no code/import options
(`EstimatorApp.tsx:210-222`, `BidSpecsApp.tsx:193-205`). Likewise Print: Estimator opens a
configurable `EstimatePrintDialog`; Bid Specs calls `window.print()` directly
(`BidSpecsApp.tsx:218`); Workback uses its own `PrintDialog`. Same button label, three
behaviors. *Recommendation: align the Share/Print affordances, or rename so users aren't
surprised.*

**[Medium] Editing models diverge sharply.** The Estimator grid is a polished
spreadsheet (type-to-edit, Enter/Tab/arrow nav, formula math, auto-scroll to new column),
while Bid Specs is plain inputs with click-only `+` row creation and **no keyboard row
creation/nav** for its wide 8-column tables. Both are defensible individually, but a user
moving between modules experiences two different "feels." *Recommendation: at minimum bring
Tab-to-next / Enter-to-add-row to the densest Bid Specs tables.*

**[Low] Native `alert()`/`confirm()` appear in module dialogs too** (e.g.
`EstimatePrintDialog` logo-too-large `alert()`, list-dialog deletes), reinforcing the
destructive-action inconsistency noted above.

### Feedback / affordance gaps (relevant to the planned feedback button)

**[Medium] There is no in-app feedback mechanism today** (confirmed: no feedback component
exists; the only "feedback" string in the codebase is an unrelated code comment in
`EstimateGrid.tsx`). For a pre-beta battle test you'll want one. *Recommendation when you
build it:* (a) make it reachable from a **persistent** location in the shared app chrome, not
a per-module footer, so it's available in every module including the gated ones; (b) capture
lightweight context automatically (active module via `parseAppFromHash`, project/estimate
id, viewport, signed-in vs anonymous) so reports are actionable; (c) route through the
existing `Modal` + toast pattern (not a new dialog style) for consistency and to inherit
focus management; (d) confirm submission with the existing `role="status"` toast and an
error path that's `role="alert"`. The existing `notify`/`NOTICE_EVENT` toast bus
(`App.tsx:131-135`) is a ready channel for the confirmation.

**[Low] Success feedback is asymmetric.** Failures toast ("Couldn't delete…"), but most
successful structural actions (delete project, reload teammate's version, reset link) are
silent. A feedback button's confirmation should set the precedent for symmetric success
toasts.

## Top 5 priorities before beta

1. **Make `Popover` accessible (Critical).** Lift `Modal`'s focus trap/restore into a shared
   hook, use it in `Popover`, give each popover an accessible name, and add scroll-lock. This
   single fix unblocks keyboard/screen-reader editing of events, categories, and the account
   menu — the heart of the product. (`Popover.tsx`, `Modal.tsx:27-53`.)
2. **Fix touch parity / kill hover-only controls (High).** Make the Estimator's row
   delete/note buttons and Workback's resize affordances visible/operable on coarse pointers,
   enforce 44px hit areas on the sticky toolbars, and correct the README's "fully editable
   mobile" claim to match reality. (`EstimateGrid.tsx` hover controls, `EventBar.tsx:100-123`,
   `Toolbar.tsx`.)
3. **Add real first-run onboarding + a persistent Help button (High).** A dismissible tour
   or coachmarks on create / shift-downstream / share-export, plus a visible Help affordance
   in every toolbar, with consistent help-dialog content across the three modules.
4. **Unify destructive actions on `ConfirmDialog` + Undo toasts (High).** Replace silent
   deletes and native `confirm()`/`alert()` everywhere; show an Undo affordance after
   no-confirm deletes. (`EventPopover.tsx:251`, `App.tsx:570`, `ProjectsDialog.tsx`,
   `ShareDialog.tsx:80`, `EstimatePrintDialog.tsx`.)
5. **Surface the toolkit and align cross-module patterns (Medium-High).** Always render the
   brand bar with locked `pro` tabs (don't hide the product's breadth, `AppBar.tsx:22`),
   align Share/Print behavior and labels across modules, and standardize toasts with
   `role="status"`. This also gives the planned feedback button a stable, always-present home.

## Accessibility checklist (pass / fail / unknown)

| Item | Status | Notes |
|---|---|---|
| Modal: focus moved in on open | Pass | `Modal.tsx:32` |
| Modal: focus trap (Tab cycling) | Pass | `Modal.tsx:33-46` |
| Modal: focus restored to opener on close | Pass | `Modal.tsx:50-51` (guarded) |
| Modal: `role="dialog"` + `aria-modal` + name | Pass | `Modal.tsx:64-66` (uses `aria-label` not `aria-labelledby`) |
| Popover: accessible name | **Fail** | `role="dialog"` with no name (`Popover.tsx:71,85`) |
| Popover: focus move-in / trap / restore | **Fail** | none implemented |
| Body scroll-lock behind modal/sheet | **Fail** | not implemented in `Modal` or `Popover` |
| Escape closes dialogs & popovers | Pass | `Modal.tsx:20-24`, `Popover.tsx:46-51` |
| Click-outside closes | Pass | `Modal.tsx:60`, `Popover.tsx:43-44` |
| All interactive elements are real buttons/inputs (no clickable divs) | Pass | confirmed across audited files |
| Icon-only buttons labeled | Pass | Close, Clear time, Account, swatches all labeled |
| Form inputs have accessible names | **Fail** | date inputs & time inputs unlabeled (`EventPopover.tsx:141-157`) |
| Dynamic errors/conflicts announced (`role="alert"`/`aria-live`) | **Fail** | conflict banner, sign-in error not announced |
| Toasts announced (`role="status"`) | Partial | Workback yes (`App.tsx:760`); Estimator/Bid Specs no |
| Trigger advertises popup (`aria-haspopup`/`aria-expanded`) | **Fail** | `AccountButton` lacks both |
| Selection state not color-only | Partial | `CategorySwatches` `aria-pressed` good; `CategoryEditorPopover` presets color-only |
| `:focus-visible` indicator present | Pass | `globals.css:82-86` |
| Reduced-motion honored | Pass | `globals.css:66-79` |
| Color contrast of body/secondary text (WCAG AA) | **Fail** | `ink-faint #a3a29b` on paper ≈ 2.1:1 for small text |
| Keyboard nav of calendar (create/select/move/delete) | Partial | shortcuts exist (`App.tsx:512-582`) but popover editing not keyboard-reachable |
| Estimator grid keyboard model | Pass | type-to-edit, Enter/Tab/arrows |
| Bid Specs keyboard row creation/nav | **Fail** | click-only `+`, no keyboard add/nav |
| Touch targets ≥ ~44px | **Fail** | toolbars/row controls below threshold |
| Hover-only controls have touch fallback | Partial | EventBar yes; Estimator row controls no |
| Document language set | Pass | `<html lang="en">` (`layout.tsx:51`) |
| Heading hierarchy in dialogs | Pass | `h3` title / `h4` sections, semantic `section`/`kbd` |
| Screen-reader test with real AT | Unknown | not performed; recommended before beta |
