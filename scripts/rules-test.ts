/**
 * Security-rules unit tests for database.rules.json, run against the Firebase
 * Realtime Database emulator. This is the real gate for the admin access model:
 * a static export has no server, so the rules are the only enforcement.
 *
 * Run with:  npm run test:rules
 * (which wraps this in `firebase emulators:exec --only database`).
 */
import { readFileSync } from "fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { ref, get, set, update, remove } from "firebase/database";

const OWNER_EMAIL = "baillmarc@gmail.com";
const rules = readFileSync("database.rules.json", "utf8");

const ownerUid = "owner";
const adminUid = "admin";
const memberUid = "member";
const invitedUid = "invited";
const otherUid = "other";
const invitedEmail = "invited@example.com";
const invitedKey = "invited@example,com"; // emailKey(invitedEmail)

const project = { id: "p1", events: { x: 1 }, updatedAt: 1 };
const estimate = { id: "e1", updatedAt: 1 };

let env: RulesTestEnvironment;
let pass = 0;
const failures: string[] = [];

async function allow(name: string, op: Promise<unknown>) {
  try {
    await assertSucceeds(op);
    pass++;
    console.log("  ✓", name);
  } catch (e) {
    failures.push(`${name} — expected ALLOW but: ${(e as Error).message}`);
    console.log("  ✗", name, "(expected allow)");
  }
}

async function deny(name: string, op: Promise<unknown>) {
  try {
    await assertFails(op);
    pass++;
    console.log("  ✓", name);
  } catch (e) {
    failures.push(`${name} — expected DENY but: ${(e as Error).message}`);
    console.log("  ✗", name, "(expected deny)");
  }
}

function db(uid: string | null, email?: string) {
  const ctx = uid ? env.authenticatedContext(uid, email ? { email } : {}) : env.unauthenticatedContext();
  return ctx.database();
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.database();
    await set(ref(d, "/"), {
      admins: { [adminUid]: true },
      registry: {
        [memberUid]: { email: "member@example.com", emailKey: "member@example,com", lastSeen: 1, createdAt: 1 },
        [invitedUid]: { email: invitedEmail, emailKey: invitedKey, lastSeen: 1, createdAt: 1 },
      },
      entitlements: { [memberUid]: { estimator: true } },
      roles: { [memberUid]: "member" },
      invites: { [invitedKey]: { email: invitedEmail, estimator: true, createdAt: 1, invitedBy: "owner" } },
      users: {
        [memberUid]: {
          projects: { p1: project },
          projectsTrash: { pt1: { id: "pt1", events: { x: 1 }, updatedAt: 1 } },
          deleted: { pt1: 5 },
        },
      },
    });
  });
}

async function run() {
  const emu = process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000";
  const [host, portStr] = emu.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-workback",
    database: { rules, host, port: parseInt(portStr, 10) },
  });
  await env.clearDatabase();
  await seed();

  console.log("\nBootstrap / admins");
  await allow("owner self-seeds own /admins", set(ref(db(ownerUid, OWNER_EMAIL), `admins/${ownerUid}`), true));
  await allow("owner bootstrap is case-insensitive", set(ref(db("owner2", "BaillMarc@Gmail.Com"), "admins/owner2"), true));
  await deny("member cannot make self admin", set(ref(db(memberUid, "member@example.com"), `admins/${memberUid}`), true));
  await deny("member cannot make owner admin", set(ref(db(memberUid, "member@example.com"), `admins/${ownerUid}`), true));
  await deny("non-owner cannot self-seed admin", set(ref(db(otherUid, "other@example.com"), `admins/${otherUid}`), true));
  await allow("admin can grant admin to another", set(ref(db(adminUid, "admin@example.com"), `admins/${otherUid}`), true));
  await allow("admin can revoke an admin", remove(ref(db(adminUid, "admin@example.com"), `admins/${otherUid}`)));

  console.log("\nRegistry");
  await allow("user writes own registry (email matches token)", set(ref(db(memberUid, "member@example.com"), `registry/${memberUid}`), { email: "member@example.com", emailKey: "member@example,com", lastSeen: 2 }));
  await deny("user cannot forge a different email", set(ref(db(memberUid, "member@example.com"), `registry/${memberUid}`), { email: "someoneelse@example.com", lastSeen: 2 }));
  await deny("user cannot write another's registry", set(ref(db(memberUid, "member@example.com"), `registry/${otherUid}`), { email: "member@example.com", lastSeen: 2 }));
  await allow("user reads own registry", get(ref(db(memberUid, "member@example.com"), `registry/${memberUid}`)));
  await deny("user cannot read another's registry", get(ref(db(memberUid, "member@example.com"), `registry/${ownerUid}`)));
  await deny("non-admin cannot list registry", get(ref(db(memberUid, "member@example.com"), "registry")));
  await allow("admin can list registry", get(ref(db(adminUid, "admin@example.com"), "registry")));

  console.log("\nEntitlements (product gate, not self-grantable)");
  await allow("user reads own entitlements", get(ref(db(memberUid, "member@example.com"), `entitlements/${memberUid}`)));
  await deny("user cannot read another's entitlements", get(ref(db(memberUid, "member@example.com"), `entitlements/${otherUid}`)));
  await deny("user CANNOT self-grant estimator", set(ref(db(memberUid, "member@example.com"), `entitlements/${memberUid}/estimator`), true));
  await allow("admin grants estimator to a user", set(ref(db(adminUid, "admin@example.com"), `entitlements/${otherUid}/estimator`), true));

  console.log("\nRoles");
  await deny("user cannot set own role", set(ref(db(memberUid, "member@example.com"), `roles/${memberUid}`), "admin"));
  await allow("admin sets a role (+admin) via root patch", update(ref(db(adminUid, "admin@example.com"), "/"), { [`roles/${otherUid}`]: "admin", [`admins/${otherUid}`]: true }));
  await deny("admin cannot set an invalid role value", set(ref(db(adminUid, "admin@example.com"), `roles/${otherUid}`), "superuser"));

  console.log("\nTeams (admin only)");
  await deny("non-admin cannot read teams", get(ref(db(memberUid, "member@example.com"), "teams")));
  await allow("admin creates a team", set(ref(db(adminUid, "admin@example.com"), "teams/t1"), { name: "Crew", createdAt: 1 }));
  await allow("admin adds a member", set(ref(db(adminUid, "admin@example.com"), `teams/t1/members/${memberUid}`), true));
  await deny("non-admin cannot write teams", set(ref(db(memberUid, "member@example.com"), "teams/t2"), { name: "X" }));

  console.log("\nInvites");
  await deny("non-admin cannot create an invite (no self-escalation)", set(ref(db(memberUid, "member@example.com"), "invites/x@example,com"), { email: "x@example.com", estimator: true }));
  await allow("admin creates an invite", set(ref(db(adminUid, "admin@example.com"), "invites/new@example,com"), { email: "new@example.com", estimator: true, createdAt: 1, invitedBy: "admin" }));
  await allow("admin lists invites", get(ref(db(adminUid, "admin@example.com"), "invites")));
  await allow("invited user reads OWN invite (registry mirror)", get(ref(db(invitedUid, invitedEmail), `invites/${invitedKey}`)));
  await deny("member cannot read someone else's invite", get(ref(db(memberUid, "member@example.com"), `invites/${invitedKey}`)));

  console.log("\nAccess requests (self-service)");
  const reqUid = "req";
  const reqEmail = "req@example.com";
  await deny("anon cannot create a request", set(ref(db(null), `accessRequests/${reqUid}`), { email: reqEmail, createdAt: 1 }));
  await allow("user creates own request (email matches token)", set(ref(db(reqUid, reqEmail), `accessRequests/${reqUid}`), { email: reqEmail, name: "Req", message: "please", createdAt: 1 }));
  await deny("user cannot forge a different email", set(ref(db(reqUid, reqEmail), `accessRequests/${reqUid}`), { email: "someoneelse@example.com", createdAt: 1 }));
  await deny("user cannot write another's request", set(ref(db(reqUid, reqEmail), `accessRequests/${otherUid}`), { email: reqEmail, createdAt: 1 }));
  await allow("user reads own request", get(ref(db(reqUid, reqEmail), `accessRequests/${reqUid}`)));
  await deny("non-admin cannot list requests", get(ref(db(reqUid, reqEmail), "accessRequests")));
  await allow("admin lists requests", get(ref(db(adminUid, "admin@example.com"), "accessRequests")));
  await allow("admin approves (grant estimator + clear request, atomic)", update(ref(db(adminUid, "admin@example.com"), "/"), { [`entitlements/${reqUid}/estimator`]: true, [`accessRequests/${reqUid}`]: null }));
  await allow("user re-requests after dismissal", set(ref(db(reqUid, reqEmail), `accessRequests/${reqUid}`), { email: reqEmail, createdAt: 2 }));
  await allow("admin dismisses a request", remove(ref(db(adminUid, "admin@example.com"), `accessRequests/${reqUid}`)));

  console.log("\nUser data: admin override + recovery");
  await allow("user reads own data", get(ref(db(memberUid, "member@example.com"), `users/${memberUid}`)));
  await deny("user cannot read another's data", get(ref(db(memberUid, "member@example.com"), `users/${ownerUid}`)));
  await allow("admin reads another user's data (override)", get(ref(db(adminUid, "admin@example.com"), `users/${memberUid}`)));
  await allow("admin reads another user's trash", get(ref(db(adminUid, "admin@example.com"), `users/${memberUid}/projectsTrash`)));
  await allow("admin recovers a deleted project for a user", update(ref(db(adminUid, "admin@example.com"), `users/${memberUid}`), { "projects/pt1": { id: "pt1", events: { x: 1 }, updatedAt: 9 }, "deleted/pt1": null, "projectsTrash/pt1": null }));
  await deny("user cannot read another's estimates", get(ref(db(memberUid, "member@example.com"), `users/${adminUid}/estimates`)));
  void estimate;

  console.log("\nAnonymous");
  await deny("anon cannot read a user's data", get(ref(db(null), `users/${memberUid}`)));
  await deny("anon cannot read admins", get(ref(db(null), "admins")));
  await deny("anon cannot write registry", set(ref(db(null), `registry/${memberUid}`), { email: "x", lastSeen: 1 }));

  console.log("\nAudit log (append-only, actor-bound)");
  await deny("non-admin cannot read audit log", get(ref(db(memberUid, "member@example.com"), "auditLog")));
  await allow("admin appends an entry", set(ref(db(adminUid, "admin@example.com"), "auditLog/a1"), { ts: 1, actorUid: adminUid, action: "grant_estimator" }));
  await deny("admin cannot forge a different actor", set(ref(db(adminUid, "admin@example.com"), "auditLog/a2"), { ts: 1, actorUid: memberUid, action: "x" }));
  await deny("audit entries are immutable", set(ref(db(adminUid, "admin@example.com"), "auditLog/a1"), { ts: 2, actorUid: adminUid, action: "tamper" }));
  await allow("admin reads audit log", get(ref(db(adminUid, "admin@example.com"), "auditLog")));

  console.log("\nConfig / owner UIDs");
  await deny("non-admin cannot pin an owner uid", set(ref(db(memberUid, "member@example.com"), `config/ownerUids/${memberUid}`), true));
  await allow("admin pins an owner uid", set(ref(db(adminUid, "admin@example.com"), `config/ownerUids/${memberUid}`), true));

  console.log("\nInvite forge is closed");
  // Forge: member points their registry emailKey mirror at the invited user's key…
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), `registry/${memberUid}/emailKey`), invitedKey);
  });
  // …but the self-read rule derives the key from the verified registry email, so still denied.
  await deny("forged emailKey can't read another's invite", get(ref(db(memberUid, "member@example.com"), `invites/${invitedKey}`)));

  console.log("\nUser removal (admin erase)");
  await deny("non-admin cannot delete another's registry", remove(ref(db(memberUid, "member@example.com"), `registry/${otherUid}`)));
  await allow("admin erases a user's registry row", remove(ref(db(adminUid, "admin@example.com"), `registry/${memberUid}`)));
  await allow("admin erases a user's stored data", remove(ref(db(adminUid, "admin@example.com"), `users/${memberUid}`)));
  // otherUid is a non-pinned account (memberUid was pinned earlier in this suite,
  // so erasing its admins row is correctly blocked by the owner-pin guard).
  await allow("admin atomic-erases a user's access maps", update(ref(db(adminUid, "admin@example.com"), "/"), { [`entitlements/${otherUid}`]: null, [`roles/${otherUid}`]: null, [`admins/${otherUid}`]: null, [`accessRequests/${otherUid}`]: null }));

  console.log("\nShared docs (open by design — the share ID is the secret)");
  // Workback shares: anyone may read/write, but the doc must be well-formed.
  await allow("anon reads a workback share", get(ref(db(null), "shared/s1")));
  await allow("anon writes a valid workback share", set(ref(db(null), "shared/s1"), { id: "s1", events: { x: 1 }, updatedAt: 1 }));
  await deny("workback share missing updatedAt is rejected", set(ref(db(null), "shared/s2"), { id: "s2", events: { x: 1 } }));
  await deny("workback share with non-number updatedAt is rejected", set(ref(db(null), "shared/s3"), { id: "s3", events: { x: 1 }, updatedAt: "nope" }));
  // Shared estimates: open too, plus a monotonic updatedAt guard (no stale clobber).
  await allow("anon reads a shared estimate", get(ref(db(null), "sharedEstimates/se1")));
  await allow("anon writes a valid shared estimate", set(ref(db(null), "sharedEstimates/se1"), { id: "se1", updatedAt: 5 }));
  await allow("shared estimate updatedAt may advance", set(ref(db(null), "sharedEstimates/se1"), { id: "se1", updatedAt: 6 }));
  await deny("shared estimate updatedAt may not go backwards", set(ref(db(null), "sharedEstimates/se1"), { id: "se1", updatedAt: 4 }));
  await deny("shared estimate missing updatedAt is rejected", set(ref(db(null), "sharedEstimates/se2"), { id: "se2" }));

  console.log("\nProtected-owner guard (pinned owners can't be removed)");
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), "/"), {
      admins: { boss: true, helper: true },
      config: { ownerUids: { boss: true } },
    });
  });
  await deny("a pinned owner can't remove itself from admins", remove(ref(db("boss"), "admins/boss")));
  await deny("another admin can't remove a pinned owner", remove(ref(db("helper"), "admins/boss")));
  await deny("atomic user-erase can't strip a pinned owner", update(ref(db("helper"), "/"), { "admins/boss": null, "registry/boss": null }));
  await allow("a non-pinned admin can be removed", remove(ref(db("boss"), "admins/helper")));

  await env.cleanup();

  console.log(`\n${failures.length === 0 ? "✅" : "❌"} rules: ${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log("   -", f);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
