# Unified Audit Log — Capture Layer

**Date:** 2026-09-08
**Status:** Design approved, pending spec review
**Scope:** Data model + write path only. No display/UI in this pass.

## Problem

AVUT has an org-scoped change log (`OrganizationLogEntry`) written via `ctx.logEvent`
on `organizationProcedure`. It cannot record anything that isn't tied to an
organization:

- `authenticatedProcedure` and `systemAdminProcedure` have no `logEvent` equivalent.
- `system-admin-router.ts` hand-rolls `prisma.organizationLogEntry.create(...)` calls,
  some borrowing an unrelated organization's ID to satisfy the required FK. Comments at
  ~lines 233 and 612 explicitly note "global user-level actions have no audit log home yet".
- Account-security events (password change, email change, social account link/unlink,
  ban/unban, impersonation) flow through better-auth endpoints, not tRPC, and are not
  logged at all.

We want audit/history coverage for as much of the application as is reasonable, as one
unified log.

## Goals

- One log table serving organization-, user-, and system-scoped events.
- A single write path (`recordLogEntry`) that every caller funnels through.
- Capture the account-security essentials via better-auth `databaseHooks`.
- Per-entity timelines are queryable (e.g. "everything that touched this Person"),
  including events whose direct target is a join row.
- Existing `ctx.logEvent` call sites and the `$transaction([...])` pairing pattern keep
  working with no signature change.

## Non-goals

- No display surfaces. The user-settings "Security activity" card and a system-admin
  global log viewer are follow-ups, unblocked by and independent of each other.
- No session-lifecycle logging (sign-in/sign-out), failed-attempt logging, or 2FA/passkey
  events (those plugins aren't enabled).
- No event bus / async indirection — single process, single sink.

## Approach

**One `recordLogEntry` service, three thin entry points.** A server-only
`src/server/log-entry.ts` owns the write. Callers:

1. `organizationProcedure.logEvent` — unchanged external signature, delegates with
   `scope: "organization"`.
2. New `logEvent` on `authenticatedProcedure` (`scope: "user"`) and
   `systemAdminProcedure` (`scope: "system"`).
3. `databaseHooks` in `src/server/auth-log-hooks.ts`, wired into `auth.ts`, mapping
   Account/User/Session mutations to `recordLogEntry` calls.

Rejected: hooks writing Prisma directly (duplicates the scope invariant, `changes`
shaping, `nanoId16`, and `objectType` vocabulary into `auth.ts` — drift). Rejected: an
event bus (no benefit here, adds a failure mode).

## Data model

### `LogEntry` (renamed from `OrganizationLogEntry`, `@@map("log_entries")`)

| Field            | Change                                                             |
| ---------------- | ------------------------------------------------------------------ |
| `organizationId` | `String?` — now nullable; relation becomes optional                |
| `organization`   | optional relation                                                  |
| `scope`          | **new** `String` — `"organization" \| "user" \| "system"`          |
| `userId`         | unchanged — required, `onDelete: Cascade`. Always the acting user. |
| `action`         | unchanged `String` — vocabulary extended (below)                   |
| `objectType`     | unchanged `String` — vocabulary extended (below)                   |
| `objectId`       | unchanged `String`                                                 |
| `metadata`       | unchanged `Json @default("{}")`                                    |
| `changes`        | unchanged `Json @default("{}")`                                    |
| `description`    | unchanged `String?`                                                |
| `timestamp`      | unchanged `DateTime @default(now())`                               |
| `objects`        | **new** — `LogEntryObject[]` relation                              |

Indexes: keep `@@index([objectType, objectId])`; keep `@@index([organizationId])` (now a
plain nullable index); add `@@index([scope, timestamp])`.

**Scope invariant** (enforced in `recordLogEntry`, not a DB CHECK — Prisma models CHECKs
poorly):

- `scope: "organization"` ⇒ `organizationId` non-null
- `scope: "user"` / `"system"` ⇒ `organizationId` null

**`userId` stays required.** Every event captured in this pass has a human actor
(self-service auth changes → the user; admin actions → the admin). A future actor-less
system event (e.g. a cron cleanup) would require a nullable migration at that point —
accepted over loosening the column speculatively now.

### `LogEntryObject` (new, `@@map("log_entry_objects")`)

| Field        | Type                                       |
| ------------ | ------------------------------------------ |
| `id`         | `String @id` (`nanoId16()`)                |
| `logEntryId` | `String` → `LogEntry`, `onDelete: Cascade` |
| `objectType` | `String`                                   |
| `objectId`   | `String`                                   |
| `role`       | `String` — `"primary" \| "context"`        |

Indexes: `@@index([objectType, objectId])`, `@@index([logEntryId])`.

A fan-out table: usually 1 row (`primary`), 2–3 when an entry bridges entities. "Every
log entry touching Person X" = `log_entry_objects WHERE objectType='Person' AND
objectId='X'` joined to `LogEntry`. The `primary` row mirrors `LogEntry.objectType` /
`objectId` and is added automatically by the write helper.

### `action` vocabulary

Existing: `Approve`, `Archive`, `Create`, `Delete`, `Publish`, `Restore`, `Subscribe`,
`Unpublish`, `Unsubscribe`, `Update`.

Add explicit security actions (display will filter/badge on these):
`Ban`, `Unban`, `Impersonate`.

### `objectType` vocabulary

Existing: `D4hAccessToken`, `I3Template`, `I3TemplateVariant`, `Organization`,
`OrganizationMembership`, `OrganizationSettings`, `Person`, `Skill`, `SkillCheckSession`,
`SkillGroup`, `SkillPackage`, `Team`, `TeamMembership`.

Add: `User`, `Account`, `Session`.

## Write service — `src/server/log-entry.ts`

```ts
interface RecordLogEntryInput {
  scope: "organization" | "user" | "system";
  organizationId?: OrganizationId | null;
  userId: UserId;
  action: LogAction;
  objectType: LogObjectType;
  objectId: string;
  changes?: DiffChange[];
  description?: string;
  metadata?: Record<string, unknown>;
  /** Extra entities this entry is relevant to. The primary (objectType/objectId) is implicit. */
  context?: { objectType: LogObjectType; objectId: string }[];
}

function recordLogEntry(
  input: RecordLogEntryInput,
  tx?: Prisma.TransactionClient,
): Prisma.PrismaPromise<LogEntry>;
```

- Validates the scope invariant (throws on violation).
- Builds `objects` via a Prisma **nested create**:
  `{ data: { …, objects: { create: [{ …primary, role: "primary" }, ...context.map(role: "context")] } } }`.
  One `PrismaPromise` writes both tables atomically → `ctx.logEvent` keeps its
  single-promise contract and every existing `$transaction([...])` call site composes
  unchanged (see `docs/patterns/transactional-writes.md`).
- `tx` defaults to the module `prisma` client; callers inside an interactive transaction
  pass their `tx`.

## tRPC wiring — `src/trpc/init.ts`

- `organizationProcedure`'s `logEvent`: same `LogEventOptions` signature, now delegates to
  `recordLogEntry({ scope: "organization", organizationId: input.organizationId,
userId: ctx.auth.user.id, ... })`. Return type stays
  `Prisma.PrismaPromise<LogEntry>`.
- New `logEvent` on `authenticatedProcedure`: `scope: "user"`, actor `ctx.userId`, no
  `organizationId`.
- New `logEvent` on `systemAdminProcedure`: `scope: "system"`, actor `ctx.userId`.
- `LogEventOptions` gains optional `context: { objectType, objectId }[]`.
- `AuthenticatedOrganizationContext.logEvent` type updated (`OrganizationLogEntry` →
  `LogEntry`).

## better-auth hooks — `src/server/auth-log-hooks.ts`

Pure mapping functions (mutation row + before/after values → `RecordLogEntryInput | null`),
plus a thin `databaseHooks` shell in `auth.ts` that calls them and then `recordLogEntry`.

| Hook                   | Condition                                   | Resulting entry                                                                                                                                                                             |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user.update.after`    | `email` changed                             | `scope: "user"`, `action: "Update"`, `objectType: "User"`, `objectId: user.id`, `changes: [modify email]`, `description: "Email address changed"`                                           |
| `user.update.after`    | `banned` false→true                         | `scope: "system"`, `action: "Ban"`, `objectType: "User"`, `objectId: user.id`, actor from hook-context session, `changes` incl. `banReason`/`banExpires`                                    |
| `user.update.after`    | `banned` true→false                         | `scope: "system"`, `action: "Unban"`, `objectType: "User"`, `objectId: user.id`                                                                                                             |
| `account.update.after` | credential-provider row, `password` changed | `scope: "user"`, `action: "Update"`, `objectType: "User"`, `objectId: userId`, `changes: [modify password]` **marker only, no values**, `description: "Password changed"`                   |
| `account.create.after` | social provider                             | `scope: "user"`, `action: "Create"`, `objectType: "Account"`, `objectId: account.id`, `metadata: { providerId }`, context ref → `User`                                                      |
| `account.delete.after` | social provider                             | `scope: "user"`, `action: "Delete"`, `objectType: "Account"`, context ref → `User`                                                                                                          |
| `session.create.after` | `impersonatedBy` set                        | `scope: "system"`, `action: "Impersonate"`, `objectType: "User"`, `objectId: session.userId`, `userId: impersonatedBy`, `metadata: { sessionId }`, `description: "Started impersonating …"` |

**Actor resolution:** a helper reads better-auth's hook context session
(`context.context.session` / equivalent) for the acting user. If genuinely absent
(no request context), fall back to the affected user and record
`metadata.actorFallback = true`.

**Password values are never stored** — the `changes` entry for a password update is a
bare `{ kind: "modify", key: "password" }` marker with no `old`/`new`.

## Convert `system-admin-router.ts` hand-rolled entries

The ~6 direct `prisma.organizationLogEntry.create(...)` calls (`addOrganizationMember`,
`createOrganization`, and the ~lines 531 / 582 / 702 sites) move to the new
`systemAdminProcedure` `logEvent`:

- Genuinely org-scoped admin actions (`addOrganizationMember`, `createOrganization`) keep
  `scope: "organization"` — but this router's procedures are `systemAdminProcedure`, which
  won't have the org helper. Give `systemAdminProcedure`'s `logEvent` an optional
  `organizationId` param: when passed, `scope: "organization"`; when omitted,
  `scope: "system"`.
- The "no audit home yet" sites (~233, ~612 — global user actions in `banUser` /
  `deleteUser` context) get real `scope: "system"` entries.
- `deleteUser`'s `deleteMany({ where: { userId } })` for log cleanup stays (it's cascade
  housekeeping, not an audit write). Note: with `userId` cascade already on the FK this
  may become redundant — verify and remove if so.

## Migration

Single Prisma migration:

1. `ALTER TABLE organization_log_entries RENAME TO log_entries`.
2. Add `scope` column, nullable initially.
3. `UPDATE log_entries SET scope = 'organization'` (all existing rows are org-scoped).
4. `ALTER COLUMN scope SET NOT NULL`.
5. `ALTER COLUMN organization_id DROP NOT NULL`.
6. Create `log_entry_objects` table + indexes.
7. Backfill `log_entry_objects`: one `primary` row per existing `LogEntry`
   (`SELECT id, objectType, objectId FROM log_entries`).
8. Add `@@index([scope, timestamp])`.

Manual post-migration check: row counts match, sample entries have exactly one `primary`
ref, an org-scoped entry still resolves its `organization` relation.

## Testing

- **`recordLogEntry` unit tests** (`src/server/log-entry.test.ts`): scope invariant
  (each valid combo passes, each invalid combo throws); `primary` ref auto-added and
  mirrors `objectType`/`objectId`; `context` refs written with `role: "context"`;
  nested-create shape produces one entry + N refs.
- **tRPC router tests** via `createMockPrisma` — extend existing `system-admin-router`
  tests to assert the migrated call sites produce `LogEntry` rows with the right `scope`
  and refs.
- **better-auth hooks**: the `databaseHooks` shell can't run under jsdom / `server-only`.
  Test the **pure mapping functions** in `auth-log-hooks.ts` (row + before/after →
  `RecordLogEntryInput | null`): email-changed detection, ban/unban transitions,
  password-marker redaction, impersonation actor = `impersonatedBy`, non-matching updates
  return `null`. The hook wiring in `auth.ts` stays a thin untested shell.
- `create-prisma-mock` needs regenerated DMMF after the schema change
  (`npx prisma generate`).

## File summary

| File                                           | Change                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `prisma/schema.prisma`                         | rename model, `scope`, nullable `organizationId`, `LogEntryObject`, indexes |
| `prisma/migrations/*`                          | the migration above                                                         |
| `src/server/log-entry.ts`                      | **new** — `recordLogEntry`                                                  |
| `src/server/log-entry.test.ts`                 | **new**                                                                     |
| `src/server/auth-log-hooks.ts`                 | **new** — pure mapping fns                                                  |
| `src/server/auth-log-hooks.test.ts`            | **new**                                                                     |
| `src/server/auth.ts`                           | `databaseHooks` shell                                                       |
| `src/trpc/init.ts`                             | generalize `logEvent`, add sibling helpers, extend `LogEventOptions`        |
| `src/trpc/routers/system-admin-router.ts`      | convert hand-rolled entries                                                 |
| `src/trpc/routers/system-admin-router.test.ts` | update assertions                                                           |
| `docs/patterns/transactional-writes.md`        | update `OrganizationLogEntry` → `LogEntry`, note `context` refs             |
| `src/generated/dmmf.ts`                        | regenerated                                                                 |

## Open questions for review

- Does `systemAdminProcedure.logEvent` taking an optional `organizationId` (scope inferred
  from its presence) read cleanly, or is an explicit `scope` param better?
- Better-auth hook-context shape for actor resolution needs verifying against the installed
  version during implementation — the fallback path covers us if it's not reachable.
