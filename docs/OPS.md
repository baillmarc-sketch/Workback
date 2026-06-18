# Operations & Hardening Runbook

How to run the production hardening that can't live in code (it needs the
Firebase console or an external service). Pairs with `docs/ADMIN_RUNBOOK.md`
(access model) and the in-repo security rules + tests.

The app is a **static export with no server**; Firebase Realtime Database
security rules are the only server-side enforcement, and they **cannot express
payload-size caps or rate limits**. App Check is therefore the primary defense
against scripted abuse of the open endpoints (`/shared`, `/sharedEstimates`,
`/sharedBidSpecs`, `/accessRequests`).

---

## 1. Enable App Check (top priority)

The client is already wired — `src/lib/firebase.ts` starts App Check
automatically when `APP_CHECK_SITE_KEY` is non-empty (dynamically imported, so
zero bundle cost while off). Steps:

1. **reCAPTCHA v3 site key** — In the Firebase console → **App Check** → register
   the Web app → choose **reCAPTCHA v3** → it creates/links a reCAPTCHA v3 site
   key. (Or create one at google.com/recaptcha and paste it in.)
2. **Set the key** — put the site key in `APP_CHECK_SITE_KEY` in
   `src/lib/firebase.ts`, commit, and let the deploy ship it. (It's a public
   key — safe to commit, like the rest of `FIREBASE_CONFIG`.)
3. **Local/CI debug token** — App Check blocks non-browser clients, including
   the rules-test emulator? No — the emulator bypasses App Check, so
   `npm run test:rules` is unaffected. For local `next dev`, set
   `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` before init (or add the printed
   debug token in the console) so your dev browser isn't blocked.
4. **Monitor, then enforce** — In **App Check → APIs**, leave **Realtime
   Database** in *monitor* mode for a few days and watch the verified-vs-total
   ratio. Once legitimate traffic is ~100% verified, switch to **Enforce**.
   Enforcing flips DB access to require a valid App Check token.
5. **Rollback** — if legitimate users get blocked, set the API back to *monitor*
   in the console (no redeploy needed).

> Note: App Check raises the bar for scripted abuse; it is not a substitute for
> the security rules. Keep both.

---

## 2. Error monitoring

`src/lib/reporting.ts` is the single chokepoint for crashes:
- A React **ErrorBoundary** (`src/components/ErrorBoundary.tsx`) and Next's
  `app/global-error.tsx` catch render crashes and show a recoverable screen.
- `installGlobalErrorHandlers()` (wired in `app/page.tsx`) catches async
  rejections and event-handler errors.
- All of them call `reportError()`, which **logs to the console by default**.

To capture errors centrally, pick one:

- **Lightweight collector (no SDK):** set `REPORT_ENDPOINT` in
  `src/lib/reporting.ts` to a Cloud Function / logging URL. `reportError` will
  `sendBeacon`/`fetch` a JSON payload (message, stack, url, ua, ts). Cheap; no
  bundle weight.
- **Sentry:** `npm i @sentry/nextjs`, run `npx @sentry/wizard@latest -i nextjs`
  (or add `Sentry.init({ dsn })` in a client init), then forward inside
  `reportError`: `Sentry.captureException(err, { extra: context })`. The DSN is
  public; gate init behind an env value so it's off in dev.

---

## 3. Backups & recovery

- **Soft-deletes** are already recoverable: per-account trash
  (`/users/{uid}/{projectsTrash,estimatesTrash,bidSpecsTrash}`) via the Admin →
  Users drawer, and team trash (`/teamWorkspaces/{teamId}/trash`) via each app's
  workspace dialog.
- **Full DB backup:** enable scheduled RTDB backups (Firebase console → Realtime
  Database → Backups, on the Blaze plan), or run a periodic
  `firebase database:get / > backup.json` from a trusted machine/CI on a cron.
- **Recovery SLA:** document who can restore and how fast. Hard-deletes (trash
  purge) are unrecoverable without a DB backup — hence the backup above.

---

## 4. Rules deployment (no drift)

Rules deploy via CI only — never hand-edit in the console:
- `ci.yml` runs `npm run test:rules` (the emulator suite) on every PR.
- `firebase-hosting.yml` re-runs the rules tests as a deploy guard, then deploys
  Hosting **and** `database.rules.json` on push to `main`.

To change rules: edit `database.rules.json`, add/adjust cases in
`scripts/rules-test.ts`, get them green locally (`npm run test:rules`, needs
Java + the emulator), and merge.

---

## 5. Bootstrap / lockout

See `docs/ADMIN_RUNBOOK.md`. Short version: pin at least one owner UID
(Admin → "Enable UID recovery") so the account can never be locked out, even if
`/admins` is wiped or the hardcoded owner email changes.
