# Graphic / Visual Design Review

## Reviewer role & scope

Reviewed as a senior graphic/visual & brand designer, **purely from a visual and
brand-identity perspective** — not engineering, UX flows, or accessibility for
its own sake (contrast is noted only where it affects polish). This is a
pre-beta "battle test" of Workback Builder ahead of putting it in front of
paying customers.

Surfaces examined:

- Brand & identity: `src/app/icon.svg`, `src/app/apple-icon.png`,
  `public/icon-192.png`, `public/icon-512.png`, `src/app/manifest.ts`,
  `src/app/layout.tsx`, `src/components/AppBar.tsx`, the three module headers.
- Color & tokens: `src/app/globals.css`, `src/lib/categories.ts`, plus a
  codebase-wide audit of hardcoded colors and Tailwind-palette usage.
- Typography: `src/app/layout.tsx` (`next/font`), `globals.css`, type-scale
  usage across components.
- Layout/density: `Toolbar.tsx`, `WeekRow.tsx`, `EventBar.tsx`,
  `estimator/EstimateGrid.tsx`, `Modal.tsx`.
- Iconography: full sweep for emoji / Unicode glyphs / inline SVG / icon libs.
- Client-facing export artifacts: `src/lib/exportGantt.ts`, `ExportDialog.tsx`,
  `estimator/EstimatePrintView.tsx`, `bidSpecs/BidSpecsPrintView.tsx`,
  print rules in `globals.css`.

No source code was modified.

## Executive summary

Workback has a genuinely tasteful, restrained editorial aesthetic — a warm
near-paper neutral palette, a serif/sans pairing (Fraunces + Inter), and the
discipline of letting saturated color belong only to schedule categories. That
foundation reads as "considered," which is rare in a tool this dense. However,
the **brand identity is not yet resolved**: the product can't decide whether it
is called "Workback" or "Producer's Toolkit," the app icon and the iOS icon are
two different drawings, and there is no logo lockup or brand presence anywhere
inside the running app. The biggest *visible* gaps are an **ad-hoc iconography
system** (a grab-bag of Unicode arrows ▸▾↺↻⇉, the multiplication sign as a close
button, and stray emoji like 🔗 and 🗒 mixed with three hand-drawn SVGs) and
**client-facing exports that drift off-brand** — the Gantt PNG renders in
`system-ui`, not the product's own typefaces. None of this is fatal, but the
icon/name/export issues are exactly the things a paying buyer notices first, so
they should be closed before beta.

## Strengths

- **A real point of view in the palette.** `globals.css:7-17` establishes a
  warm paper neutral (`--color-paper #fafaf8`), near-black ink, and graded
  ink-soft/ink-faint/hairline tokens. The deliberate rule — "category colors
  are the only saturated elements" — is sophisticated restraint and gives the
  product an editorial, calm feel rather than the typical SaaS rainbow.
- **Strong, intentional type pairing.** Fraunces (display, with optical-size
  axis) over Inter (UI) is a confident, on-trend editorial choice
  (`layout.tsx:5-16`). The 28px Fraunces title in the headers
  (`Header.tsx:17`) gives each document a magazine-masthead quality.
- **Token discipline for the neutral system is largely good.** Most text,
  borders, and surfaces use `text-ink`, `text-ink-soft`, `bg-surface`,
  `border-hairline`, etc., so the core chrome is consistent across all three
  modules and the admin panel.
- **The icon concept is good even if execution is split.** The "schedule rows
  planned back to a delivery milestone" mark (`icon.svg`) is a smart,
  ownable metaphor for a workback tool — it just needs to be the *only* version.
- **Category color choices are sensible.** The video-production palette
  (`categories.ts:4-14`) maps roles to intuitive hues (Production = red,
  Delivery = near-black) and `catText`/`color-mix` derive readable tinted bars
  rather than text-on-saturated-color (`EventBar.tsx:58-62`).
- **Export-as-product mindset.** The print CSS is unusually thoughtful — one
  landscape month per page with measured auto-fit scaling, an ink-friendly
  grayscale mode, and a separate portrait page for estimates
  (`globals.css:88-230`). The intent to make printed output first-class is a
  brand asset.
- **The estimate/bid-specs print views are clean documents.** Strong rules,
  uppercase tracked headers, tabular-nums for money
  (`EstimatePrintView.tsx:53-55`), and a recognizable AICP-style bordered grid
  for bid specs — these read as professional paperwork.

## Findings

### [Critical] The product has two names and no in-app brand presence
**Where:** `manifest.ts:10-12` (`name: "Producer's Toolkit"`,
`short_name: "Workback"`), `layout.tsx:20-38` (`applicationName: "Producer's
Toolkit"`, title `"Workback — Producer's Toolkit"`), `AppBar.tsx:27` (the only
visible wordmark, "Producer's Toolkit", text-only), all three headers which show
*the document title*, never the product.

A user who signs in to a single-app account never sees the AppBar at all
(`AppBar.tsx:22`), so the running product can display **zero** brand marks — no
logo, no name, just their project title. Meanwhile the metadata can't decide if
the product is "Workback," "Producer's Toolkit," or "Workback — Producer's
Toolkit." For a marketable product this is the single most important fix.
**Recommendation:** Pick one consumer-facing name and a clear relationship
(e.g. "Workback" the product, "Producer's Toolkit" the suite, or vice versa).
Put a small logomark + wordmark lockup in a persistent top-left position in
every module header (next to or above the editable title), and make the AppBar
wordmark a real lockup rather than `font-display` text.

### [Critical] Two different app icons — favicon vs. iOS icon don't match
**Where:** `src/app/icon.svg` / `public/icon-*.png` vs `src/app/apple-icon.png`.

The SVG/PNG icon is a black rounded-square (rx 7) with three left-aligned bars,
a faint vertical delivery guide, and a **filled white milestone dot** to the
right. The Apple icon is a visibly different drawing: a different rounded-square
radius/inset, only the top two bars rendered, the milestone reads as a dot that
merges into the middle bar, and the proportions differ. Side by side they look
like two apps. App-store/home-screen icon mismatch is an instant
"unfinished" tell. **Recommendation:** Generate every icon size from one master
SVG so the favicon, PWA maskable icon, and apple-touch icon are pixel-consistent.
Also confirm the maskable PNGs have adequate safe-area padding — at 192/512 the
mark currently runs close to the rounded-square edges, which iOS/Android will
clip under their own mask.

### [High] Iconography is an ad-hoc mix, not a coherent set
**Where:** widespread. Unicode glyphs do most of the icon work: `‹ ›`
(`Toolbar.tsx:42,55`), `▸ ▾` collapse carets (`Header.tsx:47`,
`EstimatorHeader.tsx:65,72`, `BidSpecsHeader.tsx:62`, `SpecEditor.tsx:54`,
`ProjectDetailsPanel.tsx:61`), `↺ ↻` undo/redo (`Toolbar.tsx:102,105` +
estimator/bidspecs toolbars), `⇉` shift (`Toolbar.tsx:92`), `★`/`↔`
(`EstimateGrid.tsx:375-376`), `▲▼` over/under, `×` as the close/clear/delete
glyph (`Modal.tsx:78`, `EventPopover.tsx:133`, `EstimateGrid.tsx:422`).
Mixed in are **emoji**: 🔗 for notes/links (`EstimateGrid.tsx:378`,
`EstimatorHelpDialog.tsx:51`) and 🗒 for line-item notes — the latter rendered
identically for both states (`EstimateGrid.tsx:455`: `{li.note ? "🗒" : "🗒"}`).
Then three hand-drawn inline SVGs (warning triangle, milestone diamond, lock) in
`EventBar.tsx`/`WarningsButton.tsx`. There is **no icon library** in
`package.json` and no shared `Icon` component.

Visually this means inconsistent weights, sizes, baselines, and rendering
(emoji are multicolor and render differently per-OS — a 🔗 on Windows vs. Mac vs.
Android looks like three different products). **Recommendation:** Adopt one
lightweight line-icon set (e.g. Lucide/Phosphor) or commission a small bespoke
set, wrap it in a single `<Icon>` component, and replace every Unicode glyph and
emoji. Keep the milestone diamond/lock SVGs but normalize them into the same set
(matching stroke width and 24px grid).

### [High] Client-facing Gantt export is off-brand typographically
**Where:** `exportGantt.ts:72,97` — the exported SVG declares
`font-family="system-ui, sans-serif"`. The on-screen app is Inter + Fraunces.

The Gantt PNG is the artifact most likely to land in a client deck or Teams
message, i.e. it *is* the brand to an end client — yet it renders in whatever
the OS default is, never in the product's typefaces, and carries no logo,
title block, or footer mark. It also uses its own hardcoded grays
(`#444`, `#888`, `#999`, `#d8d8d8`, `#eee`) and milestone-diamond convention
that don't quite match the in-app palette. **Recommendation:** Embed Inter (or
at least specify it with a safe fallback), add a small header band with the
project title + a subtle Workback wordmark/footer, and pull colors from the
shared tokens so the PNG reads as the same product as the screen.

### [High] No defined semantic color tokens — success/warning are scattered literals
**Where:** `globals.css` defines only `--color-danger`. Everything else is
improvised:
- **Success/synced green** `#10B981` is hardcoded as an arbitrary Tailwind
  value in at least six places (`Toolbar.tsx:124`, `App.tsx:609`,
  `EstimatorToolbar.tsx:53`, `EstimatorApp.tsx:245`, `BidSpecsToolbar.tsx:46`,
  `BidSpecsApp.tsx:223`) — and it happens to equal the Post-Production category
  color, so "saved" status and a schedule category share a hue.
- **Warning amber** uses raw Tailwind `amber-50/300/500` (`App.tsx:616-639`,
  `EstimatorApp.tsx:250-251`, `BidSpecsApp.tsx:228-229`).
- **Positive variance green** uses `#15803d`, `#86efac`, `#f0fdf4`
  (`EstimateGrid.tsx:365,510,647`, `ActualsGrid.tsx:273`).

The result is that "good/warning/bad" are expressed with at least three
unrelated greens and an off-system amber, none living in the token layer.
**Recommendation:** Add `--color-success`, `--color-warning`, and
`--color-success-soft`/`--color-warning-soft` tokens to `@theme` and route all
status colors through them. Choose a success green that does **not** collide with
the category palette.

### [Medium] Hardcoded surface tints bypass the token system
**Where:** day-cell backgrounds are literal beiges — `bg-[#edebe4]` (closed),
`bg-[#f6f5f1]` (weekend), `bg-[#f1efe9]` (drag-over) in `WeekRow.tsx:65-66`.
Shadows are ad-hoc `rgba(0,0,0,…)` values across `Popover.tsx:72,86`,
`EventBar.tsx:84`, `MonthBlock.tsx:67`. These work today but mean the calendar's
quiet background rhythm can't be retuned centrally and may drift from the paper
token over time. **Recommendation:** Promote weekend/closed/drag tints and a
small shadow scale into tokens.

### [Medium] Print/PDF views carry their own private gray ramp
**Where:** `EstimatePrintView.tsx:53-55,60-189` uses `#000`, `#444`, `#555`,
`#666`, `#bbb`, `#ddd`, `#eee`, `#f2f2f2`; `BidSpecsPrintView.tsx` uses Tailwind
`neutral-*`. These two client deliverables therefore have **subtly different
gray palettes from each other and from the app**. For documents you hand to a
client, that inconsistency undercuts the "one polished brand" impression.
**Recommendation:** Define a single print gray ramp (or reuse the ink tokens
mapped to print-safe values) and apply it across both print views. Also add a
consistent logo/footer treatment so estimate and bid-spec PDFs are visibly the
same family.

### [Medium] Three modules look unified in chrome but diverge in document identity
**Where:** all three headers (`Header.tsx`, `EstimatorHeader.tsx`,
`BidSpecsHeader.tsx`) share the 28px Fraunces title pattern (good), but the
exported documents diverge: the Gantt is a colorful timeline, the estimate is a
black-ruled portrait sheet, the bid spec is a dense neutral-bordered AICP grid.
Each is internally fine, yet a client receiving all three from the same vendor
would not immediately read them as one brand. **Recommendation:** A shared
document header system (logo + title block + date + "Confidential" line styled
identically) across all three exports would tie the suite together.

### [Low] App-store / marketing typography lives only as system fallbacks in places
**Where:** the empty-state and a few SVG strings render in `system-ui`
(`exportGantt.ts`), and the manifest/theme color is the paper neutral
(`manifest.ts:17-18`) which is fine, but there is no defined OG/social image,
which is the first brand impression in a link share. **Recommendation:** Add a
designed `opengraph-image` using the real fonts and icon.

### [Low] `×` (multiplication sign) used as the close affordance
**Where:** `Modal.tsx:78` and elsewhere. It's a common shortcut, but the
multiplication sign is visually lighter/narrower than a true close glyph and
varies by font. Rolls up into the icon-set fix above; flagged separately because
the close button is on every dialog. **Recommendation:** Use the icon set's
dedicated close/X.

### [Low] Collapse carets `▸ ▾` are visually weak and vertically misaligned
**Where:** `Header.tsx:47`, the two module headers, `SpecEditor.tsx:54`,
`ProjectDetailsPanel.tsx:61`. These triangle glyphs sit small and slightly off
the text baseline. Minor, but they're the most repeated affordance in the
editors. **Recommendation:** Replace with a chevron from the icon set.

## Brand readiness assessment

**Not yet ready to put in front of paying customers — but close, and the gap is
mostly identity, not aesthetics.** The visual *taste* is already above the bar
for this category: the palette, type pairing, and restraint would survive
scrutiny from a design-literate buyer. What is *not* ready is the brand layer
that buyers read as "is this a real, finished product": the product literally
has two names, two non-matching app icons, no logo anywhere inside the app, an
inconsistent emoji/Unicode/SVG icon situation, and client-facing exports that
render in a different typeface than the app and don't carry the brand. Those are
the exact signals a prospect uses to judge polish. The encouraging news is that
none of these are deep — they're a focused identity-and-consistency sprint, not
a redesign. Close the top five below and this is demonstrably "marketable."

## Top 5 visual priorities before beta

1. **Resolve the brand name + put it in the product.** Choose one consumer name
   and a clear product/suite relationship; align `manifest.ts` and `layout.tsx`;
   add a persistent logo + wordmark lockup to every module header and the AppBar.
2. **Ship one consistent app icon at every size.** Regenerate favicon, PWA
   maskable, and apple-touch from a single master SVG with proper safe-area
   padding so they're pixel-identical (fixes the `icon.svg` vs `apple-icon.png`
   mismatch).
3. **Adopt one icon set and a shared `<Icon>` component.** Replace all Unicode
   glyphs (`‹›▸▾↺↻⇉★↔▲▼×`) and emoji (🔗, 🗒) with one coherent line set;
   normalize the milestone/lock/warning SVGs into it.
4. **Brand the client-facing exports.** Embed the product typeface in the Gantt
   PNG (`exportGantt.ts`), unify the gray ramp across the estimate and bid-spec
   print views, and add a shared logo/title/footer block so all three
   deliverables read as one brand.
5. **Add semantic color tokens.** Introduce `--color-success`/`--color-warning`
   (plus soft variants) in `globals.css` and route the scattered `#10B981`,
   amber, and `#15803d`/`#f0fdf4` status colors through them — picking a success
   green that doesn't collide with the category palette.
