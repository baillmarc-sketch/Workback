# Systems / Senior Engineering & Security Review

## Reviewer role & scope

Pre-beta hardening review by a Systems Administrator / Senior Software Engineer.
Scope: the security model (Firebase RTDB rules + client enforcement), admin
authorization, secrets/config exposure, abuse/cost-explosion vectors, CI/CD and
deployment, reliability/data-integrity, code quality, and observability
readiness for a planned in-app feedback/error-capture feature.

Method: read-only code inspection with `file_path:line` citations. Stack
confirmed as built: Next.js App Router with `output: "export"` (static),
React 19, TypeScript (`strict: true`), Tailwind, Firebase RTDB + Google Auth,
REST access to RTDB (not the SDK's realtime listeners), `dnd-kit`, `lz-string`.
The product is a static export with **no backend**, so `database.rules.json` is
the entire server-side security boundary. I did not run the app or the emulator;
findings are from source.

## Executive summary (3-5 sentences)

The admin authorization model is genuinely server-enforced — `/admins/{uid}` is
the rules' source of truth, the client gate is cosmetic, and the
`scripts/rules-test.ts` emulator suite is unusually thorough for a project this
size. The two real, ship-blocking problems are both **abuse / cost** rather than
data-disclosure: the public `/shared`, `/sharedEstimates`, and `/sharedBidSpecs`
nodes are world-writable with **no size cap, no rate limit, and no App Check**,
so an unauthenticated attacker can write multi-MB payloads in a loop and run up
the RTDB bill or fill storage, and `/accessRequests` lets any signed-in user
spam unbounded records. The single scariest issue is that the **committed
`docs/` GitHub Pages bundle is a stale build (2026-06-15) pointed at the same
live production database** as the current Firebase Hosting site — a second,
out-of-date attack surface running superseded code and rules expectations
against real user data. Observability is **zero**: no error boundary, no logging
sink, not a single `console.error` in `src/`, so the planned feedback button has
nothing to capture today. Everything else is Medium/Low: redundant rule logic,
last-write-wins data loss on team docs, and a few maintainability nits.

## Architecture overview (as-built, brief)

- **Static export, no server.** `next.config.ts:10` sets `output: "export"`.
  Two deploy targets: Firebase Hosting (`firebase.json`, from `out/`) and GitHub
  Pages (committed `docs/`, built with `PAGES_BASE=/Workback`,
  `package.json:8`). Both talk to the same Firebase project (`firebase.ts:9`).
- **Auth:** Google sign-in via Firebase Auth (`state/auth.tsx`). All data access
  is **RTDB REST** with `?auth=<idToken>` query params
  (`lib/cloud.ts`, `lib/account.ts`, `lib/admin/*`), not the realtime SDK.
- **Access model** (`lib/admin/access.ts`, `lib/entitlements.ts`,
  `state/access.tsx`): a per-user `AccessSnapshot` (isAdmin / role / estimator /
  estimatorViaTeam / invitedEstimator) loaded once after sign-in; gating
  decisions are synchronous off that snapshot. The DB source of truth is
  `/admins`, `/roles`, `/entitlements`, `/invites`, `/teams`.
- **Data layout:** public `/shared*` share docs (unguessable ID is the only
  secret); per-account `/users/{uid}` (auth-gated); team-owned
  `/teamWorkspaces/{teamId}` (member-gated); admin namespaces
  (`/registry`, `/auditLog`, `/teams`, `/invites`, `/accessRequests`, `/config`).
- **Local-first:** `lib/storage.ts` is localStorage with a graceful quota
  fallback; cloud sync is per-project/per-doc last-write-wins by `updatedAt`.

## Security findings

### [Critical] Stale GitHub Pages build is a live second deployment on the same prod DB
`docs/` is committed to git (33 tracked files) and is a full static export of an
**older** app. Last commit touching the built bundle `docs/_next/` is
`a9f697d` (2026-06-15 21:10), whereas `src/` has had security-hardening commits
since, up to `03e833a` (2026-06-18 13:36). The Pages bundle embeds the same
`FIREBASE_CONFIG` (`firebase.ts:9`) and therefore reads/writes the **same live
production database** as the current Firebase Hosting site. Two consequences:
(1) users on `…github.io/Workback` run superseded client logic against real
data (e.g. any client-side migration/XSS-hardening fixes landed after 6-15 are
absent there — note commit history shows an SVG-export XSS fix `06b4004`); (2) a
stale build is a maintenance trap — nobody is regenerating it, so it silently
drifts further every commit. **Fix:** stop committing a hand-built `docs/`;
either retire the GitHub Pages target before beta, or rebuild it in CI on every
`main` push from the same commit (`build:pages`) so it can never lag, and gate
its existence on a single source of truth. At minimum, rebuild and recommit
`docs/` now so it matches `main`.

### [High] Public share nodes are world-writable with no size or rate limits (cost/abuse)
`database.rules.json:6-26` makes `/shared/$shareId`, `/sharedEstimates/$shareId`,
and `/sharedBidSpecs/$shareId` `.read: true` **and** `.write: true` for
unauthenticated clients. The only validation is `hasChildren([...])` plus a
monotonic `updatedAt` guard (lines 10, 17, 24). There is **no `.validate` on
payload size, child count, or string length** (confirmed: the only length check
in the whole ruleset is the presence-name cap at line 135). An attacker who
knows the path pattern (it is public, see `lib/cloud.ts:45`) can:
- `PUT` arbitrarily large JSON to a fresh random `$shareId` in a loop — RTDB
  bills on storage + download and this directly inflates cost / can exhaust the
  spark/blaze quota (a denial-of-wallet);
- create unlimited orphan share docs (each new `$shareId` passes `.validate`),
  growing the DB unboundedly with no cleanup path.
There is no auth, no App Check (`APP_CHECK_SITE_KEY = ""`, `firebase.ts:29`), and
no per-IP throttle (static export = none possible client-side). **Fix before
beta:** (a) enable Firebase App Check with reCAPTCHA v3 and turn on RTDB
enforcement — the scaffold already exists (`firebase.ts:29-48`,
`ADMIN_RUNBOOK.md:61`); this is the single highest-leverage mitigation. (b) Add a
hard size guard to each `$shareId` `.validate`, e.g.
`newData.child('id').isString() && newData.child('id').val().length < 64` plus a
total-payload cap — RTDB can't measure node byte size directly, but you can cap
the well-known large strings (notes/title/event arrays) and child counts. (c)
Consider requiring `auth != null` to *write* a share (reads can stay open), which
removes the anonymous-abuse path entirely at the cost of forcing publishers to
sign in.

### [High] `/accessRequests` and `/registry` self-writes are unauthenticated-of-the-app and unbounded
Any signed-in user may write `/accessRequests/{their-uid}`
(`database.rules.json:160-172`) and `/registry/{their-uid}`
(lines 46-60). The email is pinned to the verified token (good), but `name` and
`message` are arbitrary strings with **no length cap** (lines 167-168, 54), and
there's no rate limit on how often a user rewrites their record. A signed-in
abuser can park megabytes of text in `message`/`name`, repeatedly, and it lands
in the admin's queue. Lower severity than the fully-anonymous share nodes
because it requires a Google account, but it is still an unbounded write an
admin will see. **Fix:** add `.validate` length caps on `message`, `name`, and
the registry string fields (mirror the presence-name pattern, line 135), and
enable App Check so a script can't farm accounts cheaply.

### [Medium] Presence under `/shared/$shareId/_presence` bypasses the doc `.validate` and is anon-writable
`lib/presence.ts:22-30` heartbeats to `/shared/{shareId}/_presence/{sessionId}`.
Because RTDB `.validate` only runs against the node it's declared on, the
`$shareId` `.validate` (line 10, requiring `id`/`events`/`updatedAt`) does **not**
constrain writes to the deeper `_presence/*` leaves — they inherit only
`.write: true`. So an anonymous client can write arbitrary keys/values under any
known shareId's `_presence` with no schema and no size cap (the typed
`{name, t}` is a client convention, not enforced). This is a smaller version of
the share-abuse vector and an inconsistency with the team-workspace presence,
which *is* schema- and length-validated (`database.rules.json:131-142`). **Fix:**
add an explicit `_presence/$sessionId` `.validate` under `/shared/$shareId`
matching the team-presence rule (name length-capped, numeric `t`, `$other: false`).

### [Medium] `unpublishProject` / `unpublishEstimate` let anyone delete any share by ID
`lib/cloud.ts:67-72` and `lib/estimator/cloud.ts:27-32` issue `DELETE` on a
share node with no auth; the rules permit it (`.write: true`). Anyone who learns
a share link can delete the shared doc, not just the owner. This is inherent to
the "link is the only secret" model and is documented as such, but it means a
leaked link is a destructive capability, not just read. **Fix:** acceptable for
beta if shares are treated as ephemeral, but document it; if shares should be
durable, move ownership of a share under `/users/{uid}` or require the writer's
auth to match a stored `ownerUid`.

### [Low] Redundant chained `.replace` in the invite self-read rule (correct, but confusing)
`database.rules.json:150` derives an emailKey inside the rule via
`.replace('.', ',')` chained six times. In RTDB rules, `String.replace` already
replaces **all** occurrences (unlike JS's first-match), so the chain is redundant
and equivalent to `emailKey()`'s global replace (`lib/admin/email.ts:11`). It is
**not** a vulnerability — the rule is defense-in-depth on top of admin-only
invite *writes* — but it reads as if it were guarding against multi-dot emails
when it isn't doing what its shape implies, and `rules-test.ts:219-225` only
tests the single-dot `invited@example,com` case. **Fix:** collapse to one
`.replace('.', ',')` and add a multi-dot test email (e.g. `a.b.c@x.co`) so the
key-derivation parity with `emailKey()` is actually asserted.

### [Low] Owner bootstrap is a hardcoded email in both client and rules
`OWNER_EMAILS = ["baillmarc@gmail.com"]` (`lib/entitlements.ts:17`) and the same
literal in `database.rules.json:41`. This is intentional and well-reasoned (the
`config/ownerUids` pin is the durable upgrade, `ADMIN_RUNBOOK.md:21`), and a
hardcoded email in a public client bundle is not itself a secret. The residual
risk: it's a single string that must be changed in two places in lockstep
(`ADMIN_RUNBOOK.md:42` documents the dance). **Fix:** none required for beta;
ensure at least one `ownerUids` pin is set before launch so the email is no
longer load-bearing, and add a rules-test asserting the email + pin agree.

### [Note - not a finding] Firebase web config in the client is correct
`firebase.ts:9-17` ships the API key/appId in the bundle. This is normal and
expected for Firebase web apps — the key is an identifier, not a secret; security
is the rules + Auth (`firebase.ts:4-8` says so correctly). No service-account
JSON, private key, `.env`, or `client_secret` is present anywhere in the repo
(scanned). The CI service account is correctly a GitHub secret
(`firebase-hosting.yml:28,39`).

## Reliability & data-integrity findings

### [Medium] Team-workspace saves are last-write-wins with no monotonic guard — silent data loss
`lib/teamWorkspace.ts:52-64` `PUT`s the whole doc; the rule
(`database.rules.json:117-123`) validates only `id`+`updatedAt`, with **no**
`newData.updatedAt >= data.updatedAt` guard (unlike `/shared` and
`/users/.../estimates`). Two teammates editing the same file concurrently → the
later writer silently clobbers the earlier one; presence is the only
coordination and it's advisory. The code comment (`teamWorkspace.ts:11`)
acknowledges this. **Fix:** add the same monotonic `updatedAt` guard to the team
`docs` `.validate` that the share nodes already have, so a stale save is rejected
rather than overwriting newer work.

### [Medium] `/users/.../projects` and `projectsTrash` have no monotonic guard
`database.rules.json:194-208`: project and trash writes validate shape only,
while sibling `estimates`/`bidSpecs` (lines 209-213, 224-228) *do* enforce
`updatedAt` monotonicity. So the per-account project sync (`account.ts:20-27`,
the merge in `syncAccount` lines 97-155) relies entirely on the client to never
push a stale project — a buggy or malicious client can roll a user's project
back. The client merge is careful, but the rule should back it up. **Fix:** add
the monotonic guard to `projects/$pid` to match `estimates`.

### [Low] Legacy DB read + silent re-publish on share fetch
`lib/cloud.ts:79-96` falls back to a hardcoded legacy DB
(`eggs-ec17c…`, line 15) and, on a hit, **re-publishes** the adopted doc into the
new DB swallowing errors (`publishProject(...).catch(() => {})`, line 94). This
migration path is reasonable but: (a) it's a permanent dependency on a foreign
project staying alive; (b) the silent re-publish can fail invisibly, leaving the
link broken on next load with no signal. **Fix:** add a sunset date for the
legacy fallback and surface re-publish failures to the (planned) error sink.

### [Low] `localStorage` quota fallback drops undo history silently-ish
`storage.ts:61-91`: on quota exhaustion it deletes the project's history and
retries, notifying the user once via `notify()`. Reasonable, but the `notify`
is in-app only and the `warnedTrim` flag is module-global, so a user who clears
it never sees it again that session. Acceptable; worth capturing in the error
sink when it happens.

### [Low] `deleteRemoteProject` can be non-recoverable on bulk paths
`account.ts:36-53`: when `project` is omitted, only a tombstone is written and
the doc is unrecoverable (documented, lines 30-34). Estimator/bidSpecs deletes
have trash equivalents; ensure the bulk-reset path always passes the doc when
recoverability matters.

## CI/CD & ops findings

### [High] (cross-listed) `docs/` static export is built and committed by hand, not by CI
See the Critical above. `build:pages` (`package.json:8`) is a local-only manual
step (`rm -rf docs && cp -r out docs`); nothing in `.github/workflows/`
regenerates or verifies it. The Firebase deploy workflow
(`firebase-hosting.yml`) only ships `out/` + database rules. Net: the Pages
bundle is whatever a human last committed. **Fix:** either drop Pages or add a
CI job that rebuilds `docs/` from the deployed commit.

### [Medium] CI is good but doesn't run the rules tests as a *required* PR gate visibly + no lint
`ci.yml` runs typecheck → build → verify → smoke → `test:rules` on PRs and push;
the deploy workflow re-runs `test:rules` as a deploy guard
(`firebase-hosting.yml:23`). This is solid. Gaps: (a) **no ESLint** step despite
`eslint-disable` appearing in source (9 hits across `src/` for `as any` /
ts-ignore-family); (b) `tsconfig.json:20` **excludes `scripts/`** from
`typecheck`, so the verify/smoke/rules scripts are never type-checked by
`npm run typecheck` — a type error there only surfaces at runtime under `tsx`.
**Fix:** add a lint job; add a second `tsc` pass (or include) covering `scripts/`.

### [Medium] Deploy workflow writes the service account to a temp file in plaintext
`firebase-hosting.yml:34-37` `printf`s `$FIREBASE_SERVICE_ACCOUNT` to
`$RUNNER_TEMP/sa.json` to run `firebase deploy --only database`. On an
ephemeral GitHub runner this is acceptable, but the file isn't explicitly
shredded and the env var is passed to a `npx -y firebase-tools` invocation
(downloads latest at deploy time — supply-chain surface). **Fix:** pin
`firebase-tools` to the dev-dependency version already in `package.json`
(`^15.20.0`) rather than `npx -y` latest, and `rm -f "$RUNNER_TEMP/sa.json"` in a
trailing step / `if: always()`.

### [Low] Two workflows both trigger on push to `main` and both `npm ci` + build
`ci.yml` and `firebase-hosting.yml` both fire on `push: main` and duplicate
install/build/rules-test work. Minor cost/time; consider making deploy depend on
CI via `workflow_run` so you never deploy a commit that failed CI.

## Code quality & maintainability findings

- **TypeScript strictness is on** (`tsconfig.json:7 "strict": true`) — good.
  `skipLibCheck: true` is fine. The 9 `as any`/ts-ignore-family escapes in `src/`
  are worth auditing but none are in the security path I reviewed.
- **Rules-test coverage is genuinely strong** (`scripts/rules-test.ts`, ~60
  cases): admin bootstrap, self-escalation denial, invite forge closure
  (lines 219-225), protected-owner guard (250-261), team-workspace member
  gating, audit immutability. This is the best-tested part of the system and is
  the right thing to have tested, since the rules *are* the server. Gaps to add:
  a payload-size/abuse case for `/shared` (none today), a multi-dot invite email,
  and a monotonic-guard case for team docs (once added).
- **`verify`/`smoke`/`stress` scripts** (`scripts/verify-logic.ts` et al.) test
  pure domain logic (scheduling, layout, share encode/decode, ical, migrate) —
  meaningful and worth keeping — but they do **not** exercise auth, cloud sync,
  or the access snapshot. That's fine given the rules tests cover the security
  layer, but be clear that `npm run battle` proves the *engine*, not the
  *access model* (only `test:rules` does the latter).
- **Error handling is uniformly "swallow and return null/empty"**
  (`access.ts:35-43`, every admin list helper, presence, etc.). Excellent for
  resilience (one bad row never breaks a list) but it is the *root cause* of the
  zero-observability problem below: every failure is invisible.
- **Dead/!near-dead code:** `scripts/rules-test.ts:201 void estimate;` leaves an
  unused fixture; `lib/estimator/cloud.ts` has no monotonic-guard parity comment
  vs the rules. Minor.
- **Dependency risk:** lean tree (`firebase`, `next`, `react`, `lz-string`,
  `date-fns`, `dnd-kit`). `firebase-tools` is a devDep but invoked via
  `npx -y` at deploy (see above). No obviously abandoned packages.

## Observability & error-capture readiness (for the planned feedback feature)

**Current state: there is no observability at all.** Zero `console.error`/
`console.warn`/`console.log` in `src/` (grep confirmed 0), no `window.onerror`,
no `unhandledrejection` handler, no React **error boundary** (no
`componentDidCatch`/`ErrorBoundary` anywhere), and no third-party monitoring
(no Sentry/Bugsnag). Combined with the pervasive `try { … } catch {}` /
`.catch(() => {})` pattern, **failures are completely silent** — a user whose
sync, sign-in, share, or admin write fails sees at most a `notify()` toast (and
often not even that). For a static export with no server logs, this means you
have no way to know anything is broken in production.

For the planned feedback-button-that-captures-errors, the cleanest seams are:

1. **A React error boundary** wrapping the app shell (around `App`/the toolkit
   router) — today an unhandled render error white-screens with no trace.
2. **Global `window.addEventListener('error', …)` and `'unhandledrejection'`**
   installed in `state/auth.tsx`/`access.tsx`'s provider tree or `app/layout.tsx`
   — these would catch the many promise rejections currently swallowed.
3. **A single `reportError(err, context)` helper** that the existing
   swallow-sites call instead of bare `catch {}` — the natural choke points are
   `lib/admin/access.ts` (`getJson` catch, line 40), every admin list helper's
   catch, `lib/cloud.ts`/`account.ts` fetch failures, `presence.ts` heartbeats,
   and `state/access.tsx:84` (revalidation catch). Have it buffer the last N
   errors in memory so the feedback button can attach them.
4. **Capture target:** since there's no server, the feedback button can write a
   bounded report under a new auth-gated `/feedback/{uid}/{id}` node (admin-read,
   self-write, with strict length `.validate` — do *not* repeat the unbounded
   `/accessRequests` mistake) or POST to an external collector. Reuse the audit
   log's append-only pattern (`database.rules.json:174-188`) for immutability.

This is greenfield — there's nothing to retrofit, which makes it easy, but it
also means **today you are flying blind**.

## Top 5 must-fix-before-beta items

1. **[Critical] Fix the stale `docs/` GitHub Pages deployment.** It's an
   out-of-date second app on the live prod DB. Retire it, or rebuild it in CI on
   every `main` push so it can never lag. Rebuild + recommit now at minimum.
   (`docs/_next` @ 2026-06-15 vs `src/` @ 2026-06-18; `package.json:8`,
   `firebase.ts:9`)
2. **[High] Close the public-share abuse / cost-explosion vector.** Enable
   Firebase App Check (scaffold ready, `firebase.ts:29`) + RTDB enforcement, and
   add size/length `.validate` caps to `/shared`, `/sharedEstimates`,
   `/sharedBidSpecs` (`database.rules.json:6-26`). Strongly consider requiring
   `auth != null` to *write* a share.
3. **[High] Cap `/accessRequests` and `/registry` string fields and rate-limit
   via App Check.** Add length `.validate` on `message`/`name`/registry strings
   (`database.rules.json:54,167-168`) so a signed-in user can't park unbounded
   data in the admin queue.
4. **[Medium→ship-blocker for teams] Add monotonic `updatedAt` guards to
   team-workspace docs and `/users/.../projects`.** Today both are last-write-wins
   with no rule backstop, so concurrent edits cause silent data loss
   (`database.rules.json:117-123, 194-208`; `lib/teamWorkspace.ts:52`).
5. **[Medium] Add basic observability before launch, not after.** A React error
   boundary + global `error`/`unhandledrejection` handlers + a `reportError`
   helper feeding the planned feedback button. Right now `src/` has **zero**
   error logging and white-screens on render errors with no trace.
