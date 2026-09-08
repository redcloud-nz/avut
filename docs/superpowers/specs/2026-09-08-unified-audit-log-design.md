# Unified Audit Log — Capture Layer

**Date:** 2026-09-08 (revised 2026-09-09)
**Status:** Design approved, pending spec review
**Scope:** Data model + write path only. No display/UI in this pass.

## Problem

AVUT has an org-scoped change log (`OrganizationLogEntry`) written via `ctx.logEvent`
on `organizationProcedure`. It cannot record anything that isn't tied to an
organization:

- `authenticatedProcedure` and `systemAdminProcedure` have no `logEvent` equivalent.
- `system-admin-router.ts` hand-rolls `prisma.organizationLogEntry.create(...)` calls,
  some borrowing an unrelated organization's ID to satisfy the required FK. Comments in
  `deleteUser` and `setUserRole` note "global user-level actions have no audit log home
  yet" (tracking issue #78).
- Account-security events (password change, email change, social account link/unlink,
  ban/unban, impersonation) flow through better-auth endpoints, not tRPC, and are not
  logged at all.

We also want the model to accommodate, without another schema rewrite:

- **Global/system modules** (`modules.ts` currently has `scope: "global"`; see the
  pseudo-global-org design, issues #92/#93) and a future **user-scoped module** (e.g.
  personal equipment). `ModuleScope` is intended to be realigned to the same three values
  this spec uses (`"organization" | "user" | "system"`) — out of scope here, noted for
  consistency.
- **Non-human actors** — cron jobs and batch processes (e.g. a D4H user import/sync that
  creates a `Person` and a `TeamMembership` in one run).
- Events that touch several entities at once (a skill moving from one package/group to
  another), surfaced on every affected entity's timeline.

## Goals

- One log table serving organization-, user-, and system-scoped events.
- A single write path (`recordLogEntry`) every caller funnels through.
- Capture the account-security essentials via better-auth `databaseHooks`.
- Per-entity and per-module timelines are queryable, including events whose direct target
  is a join row or which bridge multiple entities.
- Process-initiated entries record which process, and entries from one run are
  correlated.
- Existing `ctx.logEvent` call sites and the `$transaction([...])` pairing pattern keep
  working with no signature change.

## Non-goals

- No display surfaces. The user-settings "Security activity" card, per-entity history
  pages, and a global log viewer are follow-ups — unblocked by and independent of each
  other.
- No session-lifecycle logging (sign-in/sign-out), failed-attempt logging, or 2FA/passkey
  events (those plugins aren't enabled).
- No event bus / async indirection — single process, single sink.
- No cron/batch processes are being built here. The actor model just leaves room for them.

## Approach

**One `recordLogEntry` service, three thin entry points.** A server-only
`src/server/log-entry.ts` owns the write. Callers:

1. `organizationProcedure.logEvent` — unchanged external signature, delegates with
   `scope: "organization"`.
2. New `logEvent` on `authenticatedProcedure` (`scope: "user"`) and
   `systemAdminProcedure` (org-scoped when given an `organizationId`, else `scope: "user"`).
3. `databaseHooks` in `src/server/auth-log-hooks.ts`, wired into `auth.ts`, mapping
   Account/User/Session mutations to `recordLogEntry` calls.

Process/batch callers (future) use `withProcessRun` (below), which also calls
`recordLogEntry`.

Rejected: hooks writing Prisma directly (duplicates the scope invariant, `changes`
shaping, `nanoId16`, and vocabulary into `auth.ts` — drift). Rejected: an event bus (no
benefit here, adds a failure mode). Rejected: a generic polymorphic owner column (loses
typed relations, bigger rewrite of existing `logEntry.organization` sites) and synthetic
"system user" rows for processes (pollutes `User`, every auth/admin listing special-cases
them).

## Data model

### `LogEntry` (renamed from `OrganizationLogEntry`, `@@map("log_entries")`)

| group   | field            | notes                                                                                                                                                                                                                          |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| owner   | `scope`          | **new** `String` — `"organization" \| "user" \| "system"`. Intended to match a realigned `modules.ts` `ModuleScope`. Partly derivable from the FKs; kept explicit to guard the invariant and index the feeds.                  |
| owner   | `organizationId` | **now nullable** `String?`; relation optional. Set iff `scope = "organization"`.                                                                                                                                               |
| owner   | `ownerId`        | **new** `String?` → `User`, `onDelete: Cascade`, relation `owner`. The user whose log the entry belongs to. Set iff `scope = "user"`. Distinct from `userId` (the actor). `system` ⇒ both `organizationId` and `ownerId` null. |
| actor   | `userId`         | **now nullable** `String?` → `User`, `onDelete: Cascade`. The acting human.                                                                                                                                                    |
| actor   | `processKey`     | **new** `String?` — stable id of the acting process (e.g. `"d4h-user-sync"`). Not an FK; known values in a `Processes` code registry.                                                                                          |
| actor   | `batchId`        | **new** `String?` — correlation id (`nanoId16()`) shared by every entry written in one process run or bulk action.                                                                                                             |
| module  | `moduleId`       | **new** `String?` — the `ModuleId` this entry belongs to, when applicable. Makes "this module's activity feed" a first-class query.                                                                                            |
| event   | `action`         | unchanged `String` — vocabulary extended (below)                                                                                                                                                                               |
| event   | `objectType`     | unchanged `String` — vocabulary extended (below)                                                                                                                                                                               |
| event   | `objectId`       | unchanged `String`                                                                                                                                                                                                             |
| event   | `changes`        | unchanged `Json @default("{}")` — the authoritative field-level diff                                                                                                                                                           |
| event   | `description`    | unchanged `String?`                                                                                                                                                                                                            |
| event   | `metadata`       | unchanged `Json @default("{}")`                                                                                                                                                                                                |
| event   | `timestamp`      | unchanged `DateTime @default(now())`                                                                                                                                                                                           |
| fan-out | `objects`        | **new** — `LogEntryObject[]` relation                                                                                                                                                                                          |

**Invariants** (enforced in `recordLogEntry`, not DB CHECKs — Prisma models CHECKs poorly):

- Owner: `organization` ⇒ `organizationId` set, `ownerId` null. `user` ⇒ `ownerId` set,
  `organizationId` null. `system` ⇒ both null.
- Actor: exactly one of `userId` / `processKey` is set.
- `batchId` may be set for either actor kind; `processKey` runs always set it.

Indexes: keep `@@index([objectType, objectId])`; keep `@@index([organizationId])` (plain
nullable); add `@@index([scope, timestamp])`, `@@index([ownerId])`,
`@@index([moduleId])`, `@@index([batchId])`.

### `LogEntryObject` (new, `@@map("log_entry_objects")`)

| field        | type         | notes                                                                                                                                                                                                                                                                                                    |
| ------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `String @id` | `nanoId16()`                                                                                                                                                                                                                                                                                             |
| `logEntryId` | `String`     | → `LogEntry`, `onDelete: Cascade`                                                                                                                                                                                                                                                                        |
| `objectType` | `String`     | from the `objectType` vocabulary                                                                                                                                                                                                                                                                         |
| `objectId`   | `String`     |                                                                                                                                                                                                                                                                                                          |
| `role`       | `String`     | stored as text (adding a value never needs a migration), but **typed** as a closed union `LogRefRole = "primary" \| "context" \| "from" \| "to"` in `src/lib/schemas/` with a matching zod enum. `recordLogEntry` rejects anything off the union. Extending it = one-line code change, no schema change. |

Indexes: `@@index([objectType, objectId])`, `@@index([logEntryId])`.

A fan-out table: usually 1 row (`primary`), more when an entry bridges entities. The
`primary` row mirrors `LogEntry.objectType` / `objectId` and is added automatically by the
write helper. "Every entry touching Person X" = `log_entry_objects WHERE objectType =
'Person' AND objectId = 'X'` joined to `LogEntry`.

`role` disambiguation relies on `objectType` — `role = "from"` with `objectType =
"SkillPackage"` vs `objectType = "SkillGroup"` is unambiguous without compound tokens.
`changes` remains the authoritative record of _what_ changed at field level; refs are the
feed index. See the worked examples below.

### `action` vocabulary

Existing: `Approve`, `Archive`, `Create`, `Delete`, `Publish`, `Restore`, `Subscribe`,
`Unpublish`, `Unsubscribe`, `Update`.

Add: `Ban`, `Unban`, `Impersonate`, `Move` (display filters/badges on these).

### `objectType` vocabulary

Existing: `D4hAccessToken`, `I3Template`, `I3TemplateVariant`, `Organization`,
`OrganizationMembership`, `OrganizationSettings`, `Person`, `Skill`, `SkillCheckSession`,
`SkillGroup`, `SkillPackage`, `Team`, `TeamMembership`.

Add: `User`, `Account`, `Session`.

### `Processes` registry — `src/lib/processes.ts` (new, thin)

```ts
export const Processes = {
  "d4h-user-sync": { label: "D4H user sync" },
  // added as processes are built; none exist yet
} as const;
export type ProcessKey = keyof typeof Processes;
```

Mirrors the spirit of `modules.ts`: a single source of truth for `processKey` values and
their human labels.

## Write service — `src/server/log-entry.ts`

```ts
type LogActor = { userId: UserId } | { processKey: ProcessKey };

interface RecordLogEntryInput {
  scope: "organization" | "user" | "system";
  organizationId?: OrganizationId | null;
  ownerId?: UserId | null;
  actor: LogActor;
  batchId?: string;
  moduleId?: ModuleId;
  action: LogAction;
  objectType: LogObjectType;
  objectId: string;
  changes?: DiffChange[];
  description?: string;
  metadata?: Record<string, unknown>;
  /** Extra entities this entry is relevant to. The primary (objectType/objectId) is implicit. */
  refs?: { objectType: LogObjectType; objectId: string; role?: LogRefRole }[];
}

function recordLogEntry(
  input: RecordLogEntryInput,
  tx?: Prisma.TransactionClient,
): Prisma.PrismaPromise<LogEntry>;
```

- Validates the owner and actor invariants (throws on violation).
- Builds `objects` via a Prisma **nested create**: `{ data: { …, objects: { create: [{
...primary, role: "primary" }, ...refs.map((r) => ({ ...r, role: r.role ?? "context" }))]
} } }`. One `PrismaPromise` writes both tables atomically → `ctx.logEvent` keeps its
  single-promise contract and every existing `$transaction([...])` call site composes
  unchanged (see `docs/patterns/transactional-writes.md`).
- `tx` defaults to the module `prisma` client; callers inside an interactive transaction
  pass their `tx`.

### `withProcessRun` — `src/server/log-entry.ts`

```ts
async function withProcessRun<T>(
  processKey: ProcessKey,
  fn: (log: ProcessRunLogger) => Promise<T>,
): Promise<T>;
```

Mints one `batchId`, hands `fn` a `log(entry)` bound to `{ actor: { processKey }, batchId }`
so a batch process records each write without repeating the actor/batch fields. Used by
future cron/import/sync code; nothing calls it in this pass, but it ships so the pattern is
fixed.

## tRPC wiring — `src/trpc/init.ts`

- `organizationProcedure`'s `logEvent`: same `LogEventOptions` signature, now delegates to
  `recordLogEntry({ scope: "organization", organizationId: input.organizationId, actor: {
userId: ctx.auth.user.id }, ... })`. Return type stays `Prisma.PrismaPromise<LogEntry>`.
- New `logEvent` on `authenticatedProcedure`: `scope: "user"`, `ownerId: ctx.userId`,
  `actor: { userId: ctx.userId }`.
- New `logEvent` on `systemAdminProcedure`: optional `organizationId` param — present ⇒
  `scope: "organization"` with that org; absent ⇒ `scope: "user"` with `ownerId` = the
  subject user (from the procedure input). `actor: { userId: ctx.userId }` either way.
- `LogEventOptions` gains optional `refs`, `moduleId`; `objectType` union extended with
  `"User"`, `"Session"`, `"Account"`; `action` union extended with `"Ban"`, `"Unban"`,
  `"Impersonate"`, `"Move"`.
- `AuthenticatedOrganizationContext.logEvent` return type updated (`OrganizationLogEntry` →
  `LogEntry`).

## better-auth hooks — `src/server/auth-log-hooks.ts`

Pure mapping functions (mutation row + before/after values → `RecordLogEntryInput | null`),
plus a thin `databaseHooks` shell in `auth.ts` that calls them and then `recordLogEntry`.

| Hook                   | Condition                                   | Resulting entry                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user.update.after`    | `email` changed                             | `scope: "user"`, `ownerId`/actor = the user, `action: "Update"`, `objectType: "User"`, `objectId: user.id`, `changes: [modify email]`, `description: "Email address changed"`                                                       |
| `user.update.after`    | `banned` false→true                         | `scope: "user"`, `ownerId` = target user, `actor: { userId }` = admin from hook-context session, `action: "Ban"`, `objectType: "User"`, `objectId: user.id`, `changes` incl. `banReason`/`banExpires`                               |
| `user.update.after`    | `banned` true→false                         | as above, `action: "Unban"`                                                                                                                                                                                                         |
| `account.update.after` | credential-provider row, `password` changed | `scope: "user"`, `ownerId`/actor = the user, `action: "Update"`, `objectType: "User"`, `objectId: userId`, `changes: [{ kind: "modify", key: "password" }]` **marker only — no values**, `description: "Password changed"`          |
| `account.create.after` | social provider                             | `scope: "user"`, `ownerId`/actor = the user, `action: "Create"`, `objectType: "Account"`, `objectId: account.id`, `metadata: { providerId }`, ref → `{User, userId, "context"}`                                                     |
| `account.delete.after` | social provider                             | as above, `action: "Delete"`                                                                                                                                                                                                        |
| `session.create.after` | `impersonatedBy` set                        | `scope: "user"`, `ownerId` = impersonated user, `actor: { userId: impersonatedBy }`, `action: "Impersonate"`, `objectType: "User"`, `objectId: session.userId`, `metadata: { sessionId }`, `description: "Started impersonating …"` |

**Actor resolution:** a helper reads better-auth's hook context session for the acting
user. If genuinely absent (no request context), fall back to the affected user and record
`metadata.actorFallback = true`. Verify the hook-context shape against the installed
better-auth version during implementation.

**Password values are never stored** — the `changes` entry is a bare `{ kind: "modify",
key: "password" }` marker.

## Convert `system-admin-router.ts` hand-rolled entries

There is **no `banUser`/`impersonate` tRPC procedure** — those go through better-auth's
`admin` plugin from the client, which is why they're covered by `databaseHooks` above, not
here. The tRPC conversion is:

- `addOrganizationMember`, `createOrganization`, `removeOrganizationMember`,
  `setOrganizationMemberRole`, `updateOrganizationSettings` — the ~5 direct
  `prisma.organizationLogEntry.create(...)` calls move to `systemAdminProcedure`'s
  `logEvent` with an explicit `organizationId` (⇒ `scope: "organization"`), preserving
  current behaviour.
- `deleteUser`, `setUserRole` — the "no audit home yet" sites get real entries:
  `scope: "user"`, `ownerId` = the target user, `actor: { userId: ctx.auth.user.id }`,
  `objectType: "User"`. `setUserRole` → `changes: [modify role]`. `deleteUser` →
  `action: "Delete"`.
- `deleteUser`'s `deleteMany({ where: { userId } })` log cleanup: with `userId` now a
  nullable cascade FK this is likely redundant — verify and remove if the cascade covers
  it. (Note: entries where this user was the _actor_ cascade to `userId: null`, not
  deletion — decide whether a deleted actor's entries should be nulled or removed; default
  keep them with `userId: null`.)

## Migration

Single Prisma migration:

1. `ALTER TABLE organization_log_entries RENAME TO log_entries`.
2. Add `scope` (nullable), `owner_id`, `process_key`, `batch_id`, `module_id`.
3. `UPDATE log_entries SET scope = 'organization'` (all existing rows are org-scoped).
4. `ALTER COLUMN scope SET NOT NULL`.
5. `ALTER COLUMN organization_id DROP NOT NULL`; `ALTER COLUMN user_id DROP NOT NULL`.
6. Create `log_entry_objects` + its indexes.
7. Backfill `log_entry_objects`: one `primary` row per existing `LogEntry`
   (`SELECT id, object_type, object_id FROM log_entries`).
8. Add the new `LogEntry` indexes.

Manual post-migration check: row counts match; every existing entry has exactly one
`primary` ref; an org-scoped entry still resolves its `organization` relation; no row has
both `organization_id` and `owner_id`.

## Worked examples

### D4H user-sync run creates a Person and a TeamMembership

`withProcessRun("d4h-user-sync", async (log) => { … })` mints `batchId = "b_a1…"`.

- Entry 1: `scope: "organization"`, `organizationId: org_x`, `processKey: "d4h-user-sync"`,
  `batchId: "b_a1…"`, `moduleId: "admin"`, `action: "Create"`, `objectType: "Person"`,
  `objectId: person_1`. Refs: `{Person, person_1, "primary"}`.
- Entry 2: same owner/actor/batch, `action: "Create"`, `objectType: "TeamMembership"`,
  `objectId: tm_9`. Refs: `{TeamMembership, tm_9, "primary"}`, `{Person, person_1,
"context"}`, `{Team, team_5, "context"}`.

"What did that sync run do" = `WHERE batchId = 'b_a1…'`. Both entries surface on
person_1's timeline.

### Skill moves from (package A, group X) to (package B, group Y)

One entry: `scope: "organization"`, `moduleId: "skill-track"`, `action: "Move"`,
`objectType: "Skill"`, `objectId: skl_1`,
`changes: [{ key: "packageId", old: "pkg_A", new: "pkg_B" }, { key: "groupId", old:
"grp_X", new: "grp_Y" }]`.
Refs: `{Skill, skl_1, "primary"}`, `{SkillPackage, pkg_A, "from"}`, `{SkillGroup, grp_X,
"from"}`, `{SkillPackage, pkg_B, "to"}`, `{SkillGroup, grp_Y, "to"}`.

pkg_A's feed: `objectType='SkillPackage' AND objectId='pkg_A'` → shows "skill moved out";
direction from `role='from'`, detail from `changes`.

### User changes their own password

`scope: "user"`, `ownerId: usr_sam`, `actor: { userId: usr_sam }`, `action: "Update"`,
`objectType: "User"`, `objectId: usr_sam`, `changes: [{ kind: "modify", key: "password" }]`,
`description: "Password changed"`. Ref: `{User, usr_sam, "primary"}`.

### Admin changes Kim's global role

`scope: "user"`, `ownerId: usr_kim`, `actor: { userId: usr_admin }`, `action: "Update"`,
`objectType: "User"`, `objectId: usr_kim`, `changes: [{ kind: "modify", key: "role", old:
"user", new: "admin" }]`. Ref: `{User, usr_kim, "primary"}`. "Things done to Kim" hits the
primary ref; "things Kim did" hits `LogEntry.userId`. Self-service vs admin-initiated is
`userId === objectId`.

## Testing

- **`recordLogEntry` unit tests** (`src/server/log-entry.test.ts`): owner invariant (each
  valid combo passes, each invalid combo throws); actor invariant (exactly-one-of);
  `primary` ref auto-added and mirrors `objectType`/`objectId`; `refs` written with their
  `role` (default `"context"`); nested-create shape produces one entry + N refs.
- **`withProcessRun` unit test**: one `batchId` shared across multiple `log()` calls;
  actor is `{ processKey }`.
- **tRPC router tests** via `createMockPrisma`: extend `system-admin-router` tests to
  assert migrated call sites produce `LogEntry` rows with the right `scope`, `ownerId`,
  and refs.
- **better-auth hooks**: the `databaseHooks` shell can't run under jsdom / `server-only`.
  Test the **pure mapping functions** in `auth-log-hooks.ts` (row + before/after →
  `RecordLogEntryInput | null`): email-changed detection, ban/unban transitions,
  password-marker redaction, impersonation actor = `impersonatedBy`, non-matching updates
  return `null`. The hook wiring in `auth.ts` stays a thin untested shell.
- `create-prisma-mock` needs regenerated DMMF after the schema change
  (`npx prisma generate`).

## File summary

| File                                           | Change                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `prisma/schema.prisma`                         | rename model; `scope`, nullable `organizationId`/`userId`, `ownerId`, `processKey`, `batchId`, `moduleId`; `LogEntryObject`; indexes |
| `prisma/migrations/*`                          | the migration above                                                                                                                  |
| `src/lib/processes.ts`                         | **new** — `Processes` registry                                                                                                       |
| `src/lib/schemas/log-entry.ts`                 | **new** — `LogRefRole`, `LogAction`, `LogObjectType`, `LogScope` unions + zod enums                                                  |
| `src/server/log-entry.ts`                      | **new** — `recordLogEntry`, `withProcessRun`                                                                                         |
| `src/server/log-entry.test.ts`                 | **new**                                                                                                                              |
| `src/server/auth-log-hooks.ts`                 | **new** — pure mapping fns                                                                                                           |
| `src/server/auth-log-hooks.test.ts`            | **new**                                                                                                                              |
| `src/server/auth.ts`                           | `databaseHooks` shell                                                                                                                |
| `src/trpc/init.ts`                             | generalize `logEvent`, add sibling helpers, extend `LogEventOptions`                                                                 |
| `src/trpc/routers/system-admin-router.ts`      | convert hand-rolled entries                                                                                                          |
| `src/trpc/routers/system-admin-router.test.ts` | update assertions                                                                                                                    |
| `docs/patterns/transactional-writes.md`        | `OrganizationLogEntry` → `LogEntry`; note `refs`                                                                                     |
| `src/generated/dmmf.ts`                        | regenerated                                                                                                                          |

## Open questions for review

- `systemAdminProcedure.logEvent` inferring scope from an optional `organizationId` arg —
  clean enough, or pass an explicit `scope`?
- Deleted-actor policy: keep their entries with `userId: null` (default here) or cascade-delete?
- better-auth hook-context shape for actor resolution — verify against the installed
  version during implementation; the fallback path covers us if it's not reachable.
