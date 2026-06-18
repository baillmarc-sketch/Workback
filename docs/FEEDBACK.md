# In-App Feedback

A lightweight, dependency-free feedback channel so anyone using the app — signed
in or not — can report a bug or share an idea, and the owner can triage it from
the Admin page. It doubles as the app's first piece of error telemetry.

## For users

A **Feedback** button sits next to **Sign in** in every header, and a **Send
feedback** link sits in every footer (Workback, Estimator, Bid Specs, the
private-app gate, and the Admin page). It opens a single dialog where you can:

- pick a type — **Bug / Idea / Praise / Other**;
- write a message;
- optionally leave an **email** for a reply (prefilled if you're signed in);
- optionally attach a **screenshot** — paste it with ⌘/Ctrl+V right into the
  dialog, or click **Attach image**;
- choose whether to attach **technical details** (browser, screen size, and any
  recent in-app errors), on by default.

You don't need an account to send feedback.

## For the owner (triage)

**Admin → Feedback.** New reports are badged in the sub-nav and listed
newest-first. Each card shows the type, message, who sent it (name/email or
*Anonymous*), which app, and when. **Details** expands the full context —
viewport, path, app version, browser, the submitter's UID, any captured JS
errors (message + source + stack), and the screenshot (click to enlarge).

Actions per item: **Mark reviewed** / **Reopen**, and **Delete** (confirmed).
The "New" filter shows only unreviewed items; "All" shows everything.

## How it works (implementation)

| Piece | File |
|-------|------|
| Error ring buffer + global `error`/`unhandledrejection` capture | `src/lib/feedback/errorLog.ts` |
| Types, cloud read/write, context capture, screenshot downscaling | `src/lib/feedback/feedback.ts` |
| Provider (owns the one dialog, installs error capture) | `src/state/feedback.tsx` |
| Trigger button (inline + footer variants) | `src/components/feedback/FeedbackButton.tsx` |
| Submission dialog | `src/components/feedback/FeedbackDialog.tsx` |
| Admin triage section | `src/components/admin/FeedbackSection.tsx` |
| Storage rules | `database.rules.json` → `feedback` |

### Storage & security model

Reports live at `/feedback/{id}` in the Workback RTDB, where `{id}` is an
unguessable share-style random id. The node follows the same posture as
`/shared` and `/accessRequests`:

- **Create-open, append-only:** anyone (even unauthenticated) may *create* a new
  entry (`!data.exists() && newData.exists()`), but cannot read, edit, or delete
  others' entries. A signed-in user's token is attached only for Firebase-side
  attribution; it is never required.
- **Admin-read only:** `.read` is gated to `/admins/{uid}`.
- **Admin-write for triage:** admins can PATCH `status`/`reviewedAt`/`reviewedBy`
  and delete.
- **Bounded in the rules** so one report can't balloon the DB: `message` ≤ 4 000
  chars, `errors` ≤ 8 000, `screenshot` ≤ 400 000 (a downscaled JPEG data URL,
  ~300 KB). The client downscales screenshots to fit before upload.

The `$id` `.validate` is written to pass on both create (full object) and admin
partial-update, so marking an item reviewed never trips the create-time shape
check.

### Privacy notes

- The URL **hash is never stored** (it can contain share secrets `#p=`, `#wb=`,
  `#e=`, `#bs=`) — only the resolved app id and the pathname.
- If a user unchecks "Attach technical details," the browser string, viewport,
  and error list are omitted.

## Hardening / future work

- **App Check.** The open create endpoint shares the abuse surface of `/shared`.
  Turning on Firebase App Check (`APP_CHECK_SITE_KEY` in `src/lib/firebase.ts`)
  binds writes to the real app and is the recommended mitigation against scripted
  spam — see `docs/ADMIN_RUNBOOK.md`.
- **Notifications.** Triage is pull-based today (badge on the Admin page). A
  future enhancement could email the owner on new feedback (reuse
  `src/lib/admin/email.ts`).
- **`recordError(...)`** from `errorLog.ts` can be called at the existing
  `catch {}` swallow-sites the systems review identified, to enrich reports with
  errors the global handlers don't see.
