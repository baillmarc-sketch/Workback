# Admin Runbook

Operational guide for the Producer's Toolkit access model. The app is a static
export — **the Realtime Database security rules (`database.rules.json`) are the
only enforcement.** There is no server.

## Access model at a glance

- **Workback** is public. **Estimator** and the **Admin** panel are private.
- A user gets Estimator access via any of: being an owner/admin, a direct grant
  (`/entitlements/{uid}/estimator`), an email invite (`/invites/{emailKey}`, on
  first sign-in), or being approved from the **Requests** queue.
- Admins are recorded in `/admins/{uid}` (the rules' source of truth); `/roles`
  is descriptive metadata kept in lockstep.
- Everyone who signs in is recorded in `/registry/{uid}` (email/name/photo) so
  the admin can see and manage them — a static export can't list Auth users.
- All admin actions are written to an append-only, immutable `/auditLog`
  (Admin → Activity).

## Owner bootstrap & lockout recovery

The root of trust is the hardcoded owner email in
`src/lib/entitlements.ts` (`OWNER_EMAILS`) and the rule in
`database.rules.json`. That account can always self-seed into `/admins`.

**Do this once:** sign in as the owner, open **Admin**, and click
**"Enable UID recovery"**. This pins your UID in `/config/ownerUids/{uid}`, which:

- lets that account re-seed itself into `/admins` **by UID** even if `/admins`
  is ever wiped — independent of the email; and
- makes it a **protected owner** that cannot be removed from `/admins` (by
  itself or another admin).

This removes the single-hardcoded-email point of failure. Pin at least one
trusted UID.

**If you're locked out** (all admins removed):
1. The hardcoded-email account, or any pinned `ownerUids` account, can sign in
   and re-grant itself admin (the rules allow the self-seed).
2. As a last resort, edit data directly in the Firebase console.

**Rotating / removing the owner email:** add the replacement account as an admin
and pin its UID first; only then change `OWNER_EMAILS` and redeploy. Never remove
the last bootstrap path.

## Deploying the security rules

CI owns this — do not edit rules in the Firebase console (that causes drift):

- `.github/workflows/ci.yml` runs `npm run test:rules` (the emulator suite) on
  every PR. A rule regression fails CI.
- `.github/workflows/firebase-hosting.yml` re-runs the rules tests as a deploy
  guard, then deploys both Hosting and `database.rules.json`
  (`firebase deploy --only database`) on push to `main`.

To change rules: edit `database.rules.json`, add/adjust cases in
`scripts/rules-test.ts`, get it green locally (`npm run test:rules`, needs Java +
the emulator), and merge to `main`.

## Enabling App Check (abuse hardening)

The open `/shared`, `/sharedEstimates`, and `/accessRequests` endpoints have no
rate limiting. To bind DB access to the real app:

1. Register the site with **reCAPTCHA v3** and add the Web app under
   **Firebase Console → App Check**.
2. Paste the reCAPTCHA site key into `APP_CHECK_SITE_KEY` in
   `src/lib/firebase.ts` and redeploy (the client init is already scaffolded and
   loads only when the key is set).
3. Turn on **enforcement** for the Realtime Database in the console once you've
   confirmed legitimate traffic is passing.

## Removing a user (data + access)

Admin → Users → **Remove user** revokes all access (entitlement, role, admin,
pending request, team memberships and invite) **and** deletes their `/registry`
profile and `/users/{uid}` data in one atomic operation. It is irreversible and
is audit-logged (`remove_user`). Protected owners and your own account can't be
removed.

## Audit log

Admin → **Activity** shows the newest entries (append-only, immutable per the
rules; `actorUid` is pinned to the writer). Use it to answer "who changed access
/ viewed data / recovered an item, and when."
