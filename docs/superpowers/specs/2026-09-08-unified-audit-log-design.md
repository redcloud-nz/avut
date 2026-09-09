# Unified Audit Log — Capture Layer

**Date:** 2026-09-08 (revised 2026-09-09)
**Status:** Design approved; open questions resolved 2026-09-09, ready for planning
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
- Actions taken **while impersonating** are attributed to the impersonated user. Every
  existing `logEvent` call writes `ctx.auth.user.id`, which under impersonation is the
  subject, not the admin driving the session. The log currently blames the victim.

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
  is a join row or which bridge multiple entities, in a deterministic order.
- Actions taken under impersonation are attributed to the real actor.
- Entries survive the deletion of the user who wrote them, and stay readable.
- Operation-initiated entries record which operation, and entries from one run are
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
- No _unattended_ operations (cron, scheduled sync) are being built here, and no
  `withOperationRun` helper ships. `LogBatch` leaves room for them. Named operations
  themselves are not speculative: two exist in the codebase today and are wired in this
  pass.
- No `moduleId` column. It is a pure function of `objectType`; see "Module attribution".
- **No changes to the `changes` diff format.** The `src/lib/diff.ts` rework landed
  separately (merged 2026-09-09) and is a prerequisite of this pass, not part of it.
  `DiffChange` is now a zod discriminated union and `logEvent` parses against it; this spec
  consumes that format and does not alter it.
- No centralised redaction policy. The password marker below is handled case-by-case;
  a declared redaction key list enforced in `recordLogEntry` is a follow-up.

## Approach

**One `recordLogEntry` service, three thin entry points.** A server-only
`src/server/log-entry.ts` owns the write. Callers:

1. `organizationProcedure.logEvent` — unchanged external signature, delegates with
   `scope: "organization"`.
2. New `logEvent` on `authenticatedProcedure` (`scope: "user"`) and
   `systemAdminProcedure` (org-scoped when given an `organizationId`, else `scope: "user"`).
3. `databaseHooks` in `src/server/auth-log-hooks.ts`, wired into `auth.ts`, mapping
   Account/User/Session mutations to `recordLogEntry` calls.

Rejected: hooks writing Prisma directly (duplicates the scope invariant, `changes`
shaping, `nanoId16`, and vocabulary into `auth.ts` — drift). Rejected: an event bus (no
benefit here, adds a failure mode). Rejected: a generic polymorphic owner column (loses
typed relations, bigger rewrite of existing `logEntry.organization` sites) and synthetic
"system user" rows for operations (pollutes `User`, every auth/admin listing special-cases
them).

## Data model

### `LogEntry` (renamed from `OrganizationLogEntry`, `@@map("log_entries")`)

| group   | field            | notes                                                                                                                                                                                                         |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| order   | `sequence`       | **new** `Int @default(autoincrement())` — Postgres-assigned total write order. The canonical sort key for every feed; see "Ordering" below.                                                                   |
| owner   | `scope`          | **new** `String` — `"organization" \| "user" \| "system"`. Intended to match a realigned `modules.ts` `ModuleScope`. Partly derivable from the FKs; kept explicit to guard the invariant and index the feeds. |
| owner   | `organizationId` | **now nullable** `String?`; relation optional, `onDelete: Cascade`. Set iff `scope = "organization"`.                                                                                                         |
| owner   | `ownerId`        | **new** `String?` → `User`, `onDelete: Cascade`, relation `owner`. The user whose log the entry belongs to. Set iff `scope = "user"`. Distinct from `userId` (the actor). `system` ⇒ both null.               |
| actor   | `userId`         | **now nullable** `String?` → `User`, **`onDelete: SetNull`**. The acting human.                                                                                                                               |
| actor   | `actorLabel`     | **new** `String?` — the actor's display name + email, denormalized at write time so the entry stays readable after the user is deleted. Written by `recordLogEntry`, never by callers.                        |
| actor   | `impersonatorId` | **new** `String?` → `User`, `onDelete: SetNull`, relation `impersonator`. Set when the action was taken under an impersonated session; the admin actually driving it.                                         |
| actor   | `batchId`        | **new** `String?` → `LogBatch`, `onDelete: SetNull`. Set on every entry written by one bulk action or operation run. See `LogBatch` below.                                                                    |
| event   | `action`         | unchanged `String` — vocabulary extended (below)                                                                                                                                                              |
| event   | `objectType`     | unchanged `String` — vocabulary extended (below)                                                                                                                                                              |
| event   | `objectId`       | unchanged `String`                                                                                                                                                                                            |
| event   | `changes`        | unchanged `Json` — opaque here; format under separate review. Default corrected to `[]`.                                                                                                                      |
| event   | `description`    | unchanged `String?`                                                                                                                                                                                           |
| event   | `timestamp`      | unchanged `DateTime @default(now())`                                                                                                                                                                          |
| fan-out | `objects`        | **new** — `LogEntryObject[]` relation                                                                                                                                                                         |

**Write-time invariants** (enforced in `recordLogEntry`, not DB CHECKs — Prisma models
CHECKs poorly):

- Owner: `organization` ⇒ `organizationId` set, `ownerId` null. `user` ⇒ `ownerId` set,
  `organizationId` null. `system` ⇒ both null.
- Actor: `userId` is set unless the entry was written by an unattended run, in which case
  it is null and `batchId` points at a `LogBatch` whose `userId` is also null.
- `impersonatorId` may only be set alongside `userId`.
- `actorLabel` is always set when an actor is identifiable — the acting user for a human
  actor, the operation label for an operation run.

These are **write-time only, and do not hold on read.** `userId onDelete: SetNull` means
a human-actor entry can later hold a null `userId`; `ownerId onDelete: Cascade` removes
the row instead, so `scope: "user"` entries never survive with a null owner. Any read-side
code must tolerate a null actor and fall back to `actorLabel`. Do not re-assert these
invariants as read-side assumptions or zod parses on query results.

**No `metadata` column.** The existing one has never been written: `LogEventOptions`
never exposed it and the hand-rolled `system-admin-router` creates never set it, so every
row in `organization_log_entries` holds `{}`. It is dropped rather than carried forward,
because the two structures this design adds have taken over its job — `LogEntryObject`
holds related entities (queryably, rather than buried in JSON), and `changes` holds what
was set, including on `Create`. Every use this spec originally had for it moved to one of
those. If a genuinely unstructured need appears, a nullable `Json` column is a trivial
migration; carrying a dead one forward on the assumption that it will find a use is how it
stayed dead for this long.

### Deletion behaviour

| FK               | onDelete  | consequence                                                                                                                                                                               |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organizationId` | `Cascade` | Deleting an org removes its log. Unchanged from today.                                                                                                                                    |
| `ownerId`        | `Cascade` | Deleting a user removes their user-scoped log, including Ban/Unban and role-change entries recorded against them. Deliberate: favours right-to-erasure over post-deletion reconstruction. |
| `userId`         | `SetNull` | A deleted user's _actions elsewhere_ survive, anonymised to `userId: null` but still named by `actorLabel`.                                                                               |
| `impersonatorId` | `SetNull` | Same reasoning as `userId`.                                                                                                                                                               |

Consequence for `system-admin-router.deleteUser`: its explicit
`organizationLogEntry.deleteMany({ where: { userId } })` is now wrong as well as
redundant — it would delete entries this policy intends to keep. Remove it and let the
FKs do the work.

### Ordering

`sequence` is the canonical sort key. `timestamp` defaults to `CURRENT_TIMESTAMP`, which
in Postgres is **transaction start time** — so every entry written by one
`$transaction([...])` shares a byte-identical timestamp, and `ORDER BY timestamp` is
non-deterministic among them. That collision is not hypothetical: it fires on every
write-plus-`logEvent` pairing, which is the standard pattern in this codebase.

Feeds sort `ORDER BY sequence DESC`, and keyset pagination cursors on `sequence`.
`timestamp` remains the value we _display_. Sequence gaps are expected (rolled-back
transactions consume values) and harmless — only monotonicity matters.

Indexes: keep `@@index([objectType, objectId])`; keep `@@index([organizationId])`; add
`@@index([scope, sequence])`, `@@index([ownerId])`, `@@index([batchId])`,
`@@index([sequence])`.

> Deferred: the entity-timeline query (`log_entry_objects` filtered, `log_entries`
> sorted) sorts the whole matched set because the filter and the sort key live on
> different tables. Denormalizing `sequence` onto `LogEntryObject` with
> `@@index([objectType, objectId, sequence])` fixes it. Not worth doing now — entity
> timelines here are dozens of rows — and it backfills from a join if timelines ever get
> hot. Noted so it isn't rediscovered as a mystery.

### `LogEntryObject` (new, `@@map("log_entry_objects")`)

| field        | type         | notes                                                                                                                                                                                                                                                                                                    |
| ------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `String @id` | `nanoId16()`                                                                                                                                                                                                                                                                                             |
| `logEntryId` | `String`     | → `LogEntry`, `onDelete: Cascade`                                                                                                                                                                                                                                                                        |
| `objectType` | `String`     | from the `objectType` vocabulary                                                                                                                                                                                                                                                                         |
| `objectId`   | `String`     |                                                                                                                                                                                                                                                                                                          |
| `role`       | `String`     | stored as text (adding a value never needs a migration), but **typed** as a closed union `LogRefRole = "primary" \| "context" \| "from" \| "to"` in `src/lib/schemas/` with a matching zod enum. `recordLogEntry` rejects anything off the union. Extending it = one-line code change, no schema change. |

Indexes: `@@index([objectType, objectId])`, `@@index([logEntryId])`.

**Uniqueness.** A partial unique index guarantees exactly one primary row per entry:

```sql
CREATE UNIQUE INDEX log_entry_objects_primary_unique
  ON log_entry_objects (log_entry_id) WHERE role = 'primary';
```

Prisma can't express a partial unique index in the schema DSL, so this is hand-added to
the migration SQL and the model carries an explanatory comment. Additionally,
`recordLogEntry` silently drops any `refs` entry whose `objectType`/`objectId` matches the
primary, so a caller passing the primary again is a no-op rather than a duplicate row.

A fan-out table: usually 1 row (`primary`), more when an entry bridges entities. The
`primary` row mirrors `LogEntry.objectType` / `objectId` and is added automatically by the
write helper. "Every entry touching Person X" = `log_entry_objects WHERE objectType =
'Person' AND objectId = 'X'` joined to `LogEntry`.

`LogEntry.objectType`/`objectId` is a **denormalized cache of the primary ref**, kept so a
single-row read can render an entry without a join. `recordLogEntry` is the only writer of
both, and a unit test asserts they agree. Nothing else may write either.

`role` disambiguation relies on `objectType` — `role = "from"` with `objectType =
"SkillPackage"` vs `objectType = "SkillGroup"` is unambiguous without compound tokens.
`changes` remains the record of _what_ changed at field level; refs are the feed index.

### Module attribution

There is **no `moduleId` column.** A module is a pure function of `objectType`, so storing
it would be a derived value maintained at ~60 call sites. `src/lib/schemas/log-entry.ts`
exports the map and read-side code applies it:

| `objectType`                                                                                                           | module                  |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `D4hAccessToken`, `Organization`, `OrganizationMembership`, `OrganizationSettings`, `Person`, `Team`, `TeamMembership` | `admin`                 |
| `I3Template`, `I3TemplateVariant`                                                                                      | `i3`                    |
| `SkillCheckSession`                                                                                                    | `skill-track`           |
| `Skill`, `SkillGroup`, `SkillPackage`                                                                                  | `skill-package-builder` |
| `User`, `Account`, `Session`                                                                                           | none                    |

"This module's activity feed" is therefore `WHERE objectType IN (…)`, which the map
generates. The `Skill*` row is the one genuine ambiguity: those entities are _authored_ in
`skill-package-builder` and _consumed_ in `skill-track`; the map attributes them to where
they are mutated, which is where entries originate.

> The trade-off, recorded so it isn't relitigated: a stored `moduleId` would freeze
> attribution historically, so re-organising `modules.ts` later wouldn't retroactively
> move old entries. Deriving means a map fix rewrites history — which is the behaviour we
> want while the map is young and possibly wrong, and the wrong one once module boundaries
> are settled and audited. Revisit when a display exists; adding the column later is a
> nullable-column migration and a backfill from this same map.

### `action` vocabulary

Existing: `Approve`, `Archive`, `Create`, `Delete`, `Publish`, `Restore`, `Subscribe`,
`Unpublish`, `Unsubscribe`, `Update`.

Add: `Ban`, `Unban`, `Impersonate`, `Move` (display filters/badges on these).

### `objectType` vocabulary

Existing: `D4hAccessToken`, `I3Template`, `I3TemplateVariant`, `Organization`,
`OrganizationMembership`, `OrganizationSettings`, `Person`, `Skill`, `SkillCheckSession`,
`SkillGroup`, `SkillPackage`, `Team`, `TeamMembership`.

Add: `User`, `Account`, `Session`.

### `LogBatch` (new, `@@map("log_batches")`)

One row per bulk action or operation run; `LogEntry.batchId` references it. Run-level facts
live here once instead of being repeated on every entry.

| field          | type         | notes                                                                                     |
| -------------- | ------------ | ----------------------------------------------------------------------------------------- |
| `id`           | `String @id` | `nanoId16()` — this _is_ the `batchId`                                                    |
| `operationKey` | `String`     | **required** — which named operation this run was. Values from the `Operations` registry. |
| `userId`       | `String?`    | → `User`, `onDelete: SetNull`. Who initiated the run. Null for unattended runs.           |
| `actorLabel`   | `String?`    | denormalized initiator name, same rationale as on `LogEntry`                              |
| `description`  | `String?`    | human summary — "Synchronized memberships from linked D4H team"                           |
| `startedAt`    | `DateTime`   | `@default(now())`                                                                         |

Index: `@@index([operationKey, startedAt])`.

`operationKey` and `userId` are orthogonal, and that is the point of the shape: `operationKey`
says _what kind of operation_ this was, `userId` says _who set it off_. A user clicking
"sync from D4H" and a nightly cron running the same sync are the same operation with a
different initiator, and both are named. There is no such thing as an anonymous batch.

**When to open a batch:** a named operation that writes more than one `LogEntry`.
Single-entry mutations (`updateTeam`, `createPerson`) don't open one and don't need a
operation key, which is why `LogEntry.batchId` stays nullable.

Deliberately **not** included yet: `finishedAt`, status, and entry counts. A lifecycle
needs something to close it out, and for a bulk action inside one transaction start and
finish are the same instant. Those are the first fields to add when a genuinely
long-running operation lands.

**Why a table rather than a bare correlation id.** Grouping entries by a loose `batchId`
gives you N rows and no summary — you cannot say who triggered a run, when it began, what
it targeted, or that it happened at all if it wrote zero entries. `LogBatch` gives the run
an identity that can be displayed and queried on its own.

**Ordering constraint.** Entries reference the batch, so the batch row must exist before
them. Prisma's sequential `$transaction([...])` executes in array order, so
`[createBatch, ...writes, ...logEvents]` is correct — but reordering that array breaks the
FK, so keep the batch create first.

`onDelete: SetNull` on `LogEntry.batchId`: deleting a batch orphans its entries rather
than destroying audit rows. Nothing deletes batches today.

### `Operations` registry — `src/lib/operations.ts` (new)

```ts
export const Operations = {
  "d4h-team-import": { label: "D4H team import" },
  "d4h-team-sync": { label: "D4H team sync" },
} as const;
export type OperationKey = keyof typeof Operations;
```

Mirrors `modules.ts`: a single source of truth for `operationKey` values and their human
labels. Because `operationKey` is required, this registry is the closed vocabulary of
multi-entry operations in the app — adding one is a one-line edit, and the type stops you
inventing a key at a call site.

**What counts as a batch.** A batch correlates _independently meaningful events_. It does
not exist to group the row-writes of a single event. The test: would each entry belong, on
its own, on its own entity's timeline?

- A D4H import creating a `Person` — yes. "Created by D4H import" is exactly what you want
  on that person's page. Each entry stands alone; the batch says they happened together.
  **Batch.**
- A reorder writing `sequence: 3 → 4` on five skill groups — no. Nobody wants a sequence
  integer on a group's timeline. That is one event ("groups reordered") whose N-ness is an
  implementation detail of storing order in a column. **Not a batch — one entry.**

Getting this wrong in the second direction is what makes a batch concept metastasize:
every mutation touching more than one row starts claiming an operation key.

The two initial entries are the operations that pass that test today:

| key               | site                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- |
| `d4h-team-import` | `teams-router.createTeam`, D4H-linked branch — creates a Team, N Persons, N memberships |
| `d4h-team-sync`   | `teams-router.syncronizeD4HTeam` (sic — the repo spells it without the `h`)             |

Both are user-initiated, so they set `userId`; neither has an unattended counterpart yet.
Wiring them is mechanical (open a batch, thread `batchId` into the existing `logEvent`
calls) and is included in this pass — a registry with no callers would be exactly the
speculative surface we cut `moduleId` and the old `operationKey` column to avoid.

> Naming, settled 2026-09-09: this was `Processes`/`processKey` in the first draft.
> "Process" reads oddly for a user-clicked D4H import, and `Operations`/`OperationKey`
> covers both that and a future cron neutrally. Renamed while the registry still has no
> callers — later it would have touched the file, the type, the column, and every entry.

## Write service — `src/server/log-entry.ts`

```ts
/** A human actor, or none — an operation run identifies itself through its `LogBatch`. */
type LogActor = { userId: UserId; impersonatorId?: UserId; actorLabel?: string } | null;

interface RecordLogEntryInput {
  scope: "organization" | "user" | "system";
  organizationId?: OrganizationId | null;
  ownerId?: UserId | null;
  actor: LogActor;
  /** Existing `LogBatch.id`. Required when `actor` is null. */
  batchId?: string;
  action: LogAction;
  objectType: LogObjectType;
  objectId: string;
  changes?: DiffChange[];
  description?: string;
  /** Extra entities this entry is relevant to. The primary (objectType/objectId) is implicit. */
  refs?: { objectType: LogObjectType; objectId: string; role?: LogRefRole }[];
}

function recordLogEntry(
  input: RecordLogEntryInput,
  tx?: Prisma.TransactionClient,
): Prisma.PrismaPromise<LogEntry>;

/** Opens a batch. Returns a `PrismaPromise` so it composes into `$transaction([...])`. */
function createLogBatch(
  input: { operationKey: OperationKey; userId?: UserId; actorLabel?: string; description?: string },
  tx?: Prisma.TransactionClient,
): Prisma.PrismaPromise<LogBatch>;
```

- Validates the owner and actor invariants (throws on violation), including that a null
  `actor` is accompanied by a `batchId` — an entry with neither actor nor batch has no
  provenance at all and is rejected.
- Resolves `actorLabel` for a human actor. This needs the user's name/email, which the
  tRPC entry points already hold on `ctx.auth.user` and pass down — `recordLogEntry` does
  **not** issue a lookup query, since that would break the single-`PrismaPromise` contract
  below. The better-auth hooks pass the row they already have. When no label is available,
  it stays null.
- Drops `refs` duplicating the primary; rejects a `role` off the union.
- Builds `objects` via a Prisma **nested create**: `{ data: { …, objects: { create: [{
...primary, role: "primary" }, ...refs.map((r) => ({ ...r, role: r.role ?? "context" }))]
} } }`. One `PrismaPromise` writes both tables atomically → `ctx.logEvent` keeps its
  single-promise contract and every existing `$transaction([...])` call site composes
  unchanged (see `docs/patterns/transactional-writes.md`).
- `tx` defaults to the module `prisma` client; callers inside an interactive transaction
  pass their `tx`.

## tRPC wiring — `src/trpc/init.ts`

- `organizationProcedure`'s `logEvent`: same `LogEventOptions` signature, now delegates to
  `recordLogEntry({ scope: "organization", organizationId: input.organizationId, actor:
{ userId: ctx.auth.user.id, impersonatorId: ctx.auth.session.impersonatedBy ?? undefined },
  ... })`. Return type stays `Prisma.PrismaPromise<LogEntry>`.
- New `logEvent` on `authenticatedProcedure`: `scope: "user"`, `ownerId: ctx.userId`,
  same actor resolution.
- New `logEvent` on `systemAdminProcedure`: optional `organizationId` param — present ⇒
  `scope: "organization"` with that org; absent ⇒ `scope: "user"` with `ownerId` = the
  subject user (from the procedure input). Actor resolved the same way either way.
- **Impersonation is resolved centrally**, in one place per entry point, from
  `ctx.auth.session.impersonatedBy`. No call site passes it and no call site can forget it.
  `actorLabel` is likewise filled from `ctx.auth.user` centrally.
- `LogEventOptions` gains optional `refs`, `batchId`; `objectType` union extended with
  `"User"`, `"Session"`, `"Account"`; `action` union extended with `"Ban"`, `"Unban"`,
  `"Impersonate"`, `"Move"`.
- `AuthenticatedOrganizationContext.logEvent` return type updated (`OrganizationLogEntry` →
  `LogEntry`).

## better-auth hooks — `src/server/auth-log-hooks.ts`

Pure mapping functions (mutation row + the fields the write touched →
`RecordLogEntryInput | null`), plus a thin `databaseHooks` shell in `auth.ts` that calls
them and then `recordLogEntry`.

### Verified hook mechanics (better-auth 1.7.3)

Three facts, read out of `node_modules` rather than assumed, that constrain everything
below. Re-verify them on a major better-auth bump.

**`*.after` hooks run after the write commits, and a throw is not a rollback.**
`db/with-hooks.mjs` wraps every `after` hook in `queueAfterTransactionHook`, which
(`@better-auth/core/dist/context/transaction.mjs`) defers it until after commit and then
rethrows. Its core supports an `onAfterCommitHookError` handler, but better-auth never
passes one. So a throwing hook does not undo the password change — it commits and then
returns a 500 for an operation that succeeded. **Fail-closed is therefore unavailable, not
merely undesirable.** Every hook body wraps its work in `try/catch` and `console.error`s;
audit gaps are the accepted cost, and `auth.ts` carries a comment saying why.

**Hook payloads do not carry old values.** `update.before` receives the _update payload_
(`Partial<User>` — which fields the write touches); `update.after` receives the _resulting
row_. Neither carries the previous value. Consequences:

- Ban/unban: unaffected. The direction is a function of the new `banned` value.
- Password: unaffected. The entry is a bare marker with no values by design.
- Email: affected. Capturing the old address takes a deliberate read — see below.

**Impersonation end is observable.** `stopImpersonating` calls
`internalAdapter.deleteSession`, which routes through `deleteWithHooks("session")`; that
helper pre-reads the row and hands the full record — `impersonatedBy` included — to
`session.delete.after`. Sign-out and session revocation of an impersonated session fire the
same hook, and those genuinely are impersonation ends. No expired-session sweeper exists in
the adapter (expiry is checked on read), so there is no source of false positives. The
start-without-end asymmetry the first draft worried about does not apply; both are logged.

### Email change: capturing the old address

`user.update.before` reads the current row through our own prisma client and, if the
payload touches `email` and the address actually differs, stashes `{ old, new }` on a
module-level `WeakMap` keyed by the `GenericEndpointContext` object. `user.update.after`
looks the entry up and records the full old→new change, then deletes the key.

Recording in `after` rather than `before` means a write that fails leaves no entry. The
`WeakMap` keying means nothing leaks if `after` never runs, and no property is bolted onto
better-auth's context object. The extra read is one indexed `findUnique` on a path that
runs at most once per request, and it is scoped to this one field — no other hook needs
it.

If `context` is null (no request context), the stash is skipped and `after` records the
new address alone with a `console.warn`.

| Hook                   | Condition                                   | Resulting entry                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user.update.before`   | payload touches `email`, value differs      | No entry. Reads the current row and stashes `{ old, new }` on the `WeakMap` for the `after` hook.                                                                                                                                                  |
| `user.update.after`    | a stashed email change exists               | `scope: "user"`, `ownerId`/actor = the user, `action: "Update"`, `objectType: "User"`, `objectId: user.id`, `changes: [obj_mod email old→new]`, `description: "Email address changed"`                                                             |
| `user.update.after`    | `banned` false→true                         | `scope: "user"`, `ownerId` = target user, `actor: { userId }` = admin from hook-context session, `action: "Ban"`, `objectType: "User"`, `objectId: user.id`, `changes` incl. `banReason`/`banExpires`                                              |
| `user.update.after`    | `banned` true→false                         | as above, `action: "Unban"`                                                                                                                                                                                                                        |
| `account.update.after` | credential-provider row, `password` changed | `scope: "user"`, `ownerId`/actor = the user, `action: "Update"`, `objectType: "User"`, `objectId: userId`, `changes` = a bare marker **with no values**, `description: "Password changed"`                                                         |
| `account.create.after` | social provider                             | `scope: "user"`, `ownerId`/actor = the user, `action: "Create"`, `objectType: "Account"`, `objectId: account.id`, `changes` = the created row (incl. `providerId`), ref → `{User, userId, "context"}`                                              |
| `account.delete.after` | social provider                             | as above, `action: "Delete"`                                                                                                                                                                                                                       |
| `session.create.after` | `impersonatedBy` set                        | `scope: "user"`, `ownerId` = impersonated user, `actor: { userId: impersonatedBy }`, `action: "Impersonate"`, `objectType: "User"`, `objectId: session.userId`, ref → `{Session, session.id, "context"}`, `description: "Started impersonating …"` |
| `session.delete.after` | `impersonatedBy` set on the deleted row     | as above, `description: "Stopped impersonating …"`. Also fires on sign-out and session revocation of an impersonated session — both are genuine ends.                                                                                              |

**Actor resolution:** a helper reads `context.context.session?.user` — better-auth's
`GenericEndpointContext` is `EndpointContext & { context: AuthContext }`, and the admin
middleware populates `session` on the endpoints that matter (ban, unban, set-role). If
genuinely absent (no request context), fall back to the affected user and record a
`console.warn` — it is a diagnostic about our own code, not a fact about the event, so it
does not belong in the row. Confirm this shape still holds on a major better-auth bump.

**Password values are never stored** — the `changes` entry is a bare marker naming the
field, with no old or new value. The encoding is `DiffChange`'s `obj_mask`:
`{ type: "obj_mask", path: ["password"] }`. That variant already has a live producer (the
D4H access-token redaction added in the diff rework), so this is a second use of an
established shape rather than a type invented for one call site.

**Both ends of impersonation are logged.** Verified above: `stopImpersonating` deletes the
session row through the hooked path, so `session.delete.after` reliably carries
`impersonatedBy`. Timelines show start/stop pairs.

**Hook failure is swallowed.** Every hook body is `try/catch` + `console.error`, for the
reason given under "Verified hook mechanics": the underlying write has already committed by
the time the hook runs, so rethrowing breaks the user's operation without protecting the
audit trail.

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
  `scope: "user"`, `ownerId` = the target user, actor = the admin, `objectType: "User"`.
  `setUserRole` → `changes: [modify role]`. `deleteUser` → `action: "Delete"`.
  Note `deleteUser`'s own entry has `ownerId` = the user being deleted, so it cascades
  away with them. That is consistent with the erasure policy above, and means the record
  of a deletion does not outlive the deletion.
- `deleteUser`'s `deleteMany({ where: { userId } })` log cleanup: **remove it.** See
  "Deletion behaviour" — it now deletes entries the FK policy intends to keep.

## Migration

**The production database is empty.** No backfill, no data preservation, no hand-written
rename SQL. Update `prisma/schema.prisma` and let `prisma migrate dev` generate the
migration; a drop-and-create of `organization_log_entries` → `log_entries` is fine.

Two hand-edits to the generated SQL:

1. The partial unique index on `log_entry_objects (log_entry_id) WHERE role = 'primary'`
   (Prisma's DSL can't express it).
2. Nothing else — `sequence` as `SERIAL`/`GENERATED … AS IDENTITY` comes out of
   `@default(autoincrement())` correctly.

Local/dev databases with data will lose their log entries. That is acceptable; nothing
reads them.

## Worked examples

> `changes` payloads below are illustrative — the shapes are `DiffChange` values from
> `src/lib/diff.ts`, but the examples name fields rather than spelling out full entries.

### An unattended run creates a Person and a TeamMembership

Illustrative of the shape an unattended operation takes. `"d4h-user-sync"` is **not** in the
registry — no such operation exists — so this is what the first cron job would look like
after adding its key. No helper ships in this pass, so it opens its batch explicitly and
threads the id.

`createLogBatch({ operationKey: "d4h-user-sync", actorLabel: "D4H user sync", description:
"Imported members from D4H" })` → `bat_a1…`. Unattended, so no `userId`.

- Entry 1: `scope: "organization"`, `organizationId: org_x`, `actor: null`,
  `actorLabel: "D4H user sync"`, `batchId: "bat_a1…"`, `action: "Create"`,
  `objectType: "Person"`, `objectId: person_1`. Refs: `{Person, person_1, "primary"}`.
- Entry 2: same owner/batch, `action: "Create"`, `objectType: "TeamMembership"`,
  `objectId: tm_9`. Refs: `{TeamMembership, tm_9, "primary"}`, `{Person, person_1,
"context"}`, `{Team, team_5, "context"}`.

"What did that sync run do" is now a row — `log_batches` by id, with its entries via
`WHERE batchId = 'bat_a1…' ORDER BY sequence`. Both entries surface on person_1's
timeline; they share a `timestamp`, so `sequence` is what makes their order well-defined.
Because `actorLabel` is denormalized onto each entry, rendering the timeline never needs
to join `log_batches` just to name who acted.

### Bulk action: `syncronizeD4HTeam` (exists today)

[`teams-router.ts`](../../../src/trpc/routers/teams-router.ts) `syncronizeD4HTeam` writes
N `TeamMembership` deletes, N creates, and a `Team` update in one user-initiated mutation
— currently as unrelated entries sharing an identical `timestamp`. Wired:

- `createLogBatch({ operationKey: "d4h-team-sync", userId: ctx.userId, actorLabel,
description: "Synchronized memberships from linked D4H team" })` before the writes.
- Every `ctx.logEvent` in the run passes that `batchId`; `actor` stays the human.

The same operation run by a future nightly cron is the identical `operationKey` with
`userId: null` — which is exactly why the two fields are separate.

### Skill moves from (package A, group X) to (package B, group Y)

One entry: `scope: "organization"`, `action: "Move"`, `objectType: "Skill"`, `objectId: skl_1`, with `changes` recording the
`packageId` and `groupId` transitions.
Refs: `{Skill, skl_1, "primary"}`, `{SkillPackage, pkg_A, "from"}`, `{SkillGroup, grp_X,
"from"}`, `{SkillPackage, pkg_B, "to"}`, `{SkillGroup, grp_Y, "to"}`.

pkg_A's feed: `objectType='SkillPackage' AND objectId='pkg_A'` → shows "skill moved out";
direction from `role='from'`, detail from `changes`.

### User changes their own password

`scope: "user"`, `ownerId: usr_sam`, `actor: { userId: usr_sam }`, `action: "Update"`,
`objectType: "User"`, `objectId: usr_sam`, `changes` = password marker only,
`description: "Password changed"`. Ref: `{User, usr_sam, "primary"}`.

### Admin changes Kim's global role

`scope: "user"`, `ownerId: usr_kim`, `actor: { userId: usr_admin }`,
`actorLabel: "Dana Okafor <dana@…>"`, `action: "Update"`, `objectType: "User"`,
`objectId: usr_kim`, `changes` = the `role` transition. Ref: `{User, usr_kim, "primary"}`.
"Things done to Kim" hits the primary ref; "things Kim did" hits `LogEntry.userId`.
Self-service vs admin-initiated is `userId === objectId`.

### Admin impersonates Kim, then edits a Person

Two entries:

- The impersonation itself (from `session.create.after`): `scope: "user"`,
  `ownerId: usr_kim`, `userId: usr_admin`, `action: "Impersonate"`.
- The edit, written by the ordinary `organizationProcedure.logEvent` path with no special
  handling at the call site: `scope: "organization"`, `objectType: "Person"`,
  `userId: usr_kim` (the session's user), **`impersonatorId: usr_admin`**.

Reading `impersonatorId IS NOT NULL` gives "everything done under impersonation", and
Kim's own timeline correctly distinguishes what Kim did from what was done as Kim.

## Testing

- **`recordLogEntry` unit tests** (`src/server/log-entry.test.ts`): owner invariant (each
  valid combo passes, each invalid combo throws); actor invariant (exactly-one-of);
  `impersonatorId` rejected without `userId`; a null `actor` without a `batchId` rejected;
  `actorLabel` recorded; `primary` ref auto-added and mirrors
  `objectType`/`objectId`; a `ref` duplicating the primary is dropped; `refs` written with
  their `role` (default `"context"`); nested-create shape produces one entry + N refs.
- **Ordering test**: two entries written in one `$transaction([...])` share a `timestamp`
  but receive distinct, increasing `sequence` values. This is the regression test for the
  bug that motivated the column.
- **`createLogBatch` / batch tests**: a batch requires a `operationKey`; entries carrying a
  `batchId` resolve to it; an unattended batch (`userId: null`) produces entries with a
  null actor and an operation `actorLabel`.
- **Deletion tests**: deleting an actor leaves their entries with `userId: null` and an
  intact `actorLabel`; deleting an owner removes their `scope: "user"` entries.
- **tRPC router tests** via `createMockPrisma`: extend `system-admin-router` tests to
  assert migrated call sites produce `LogEntry` rows with the right `scope`, `ownerId`,
  and refs; assert `deleteUser` no longer deletes log rows.
- **Impersonation wiring test**: a context with `session.impersonatedBy` set produces an
  entry with `impersonatorId` populated, without the call site passing anything.
- **better-auth hooks**: the `databaseHooks` shell can't run under jsdom / `server-only`.
  Test the **pure mapping functions** in `auth-log-hooks.ts` (row + touched fields →
  `RecordLogEntryInput | null`): email-changed detection from a stashed old value,
  ban/unban transitions from the new `banned` value, password `obj_mask` marker carrying no
  value, impersonation start actor = `impersonatedBy`, impersonation end from a deleted
  session row, non-matching updates return `null`. Also assert the `WeakMap` stash is
  cleared after `after` consumes it, and that a mapping function throwing never escapes the
  hook body. The hook wiring in `auth.ts` stays a thin untested shell.
- `create-prisma-mock` needs regenerated DMMF after the schema change
  (`npx prisma generate`). Note `prisma-mock` does not emulate Postgres sequences, so
  `sequence` assertions may need the mock to assign values explicitly — verify during
  implementation and fall back to asserting relative order if it can't.

## File summary

| File                                           | Change                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                         | rename model; `sequence`, `scope`, nullable `organizationId`/`userId`, `ownerId`, `actorLabel`, `impersonatorId`, `batchId`; `LogEntryObject`; `LogBatch`; indexes; delete behaviours |
| `prisma/migrations/*`                          | generated migration + hand-added partial unique index                                                                                                                                 |
| `src/lib/operations.ts`                        | **new** — `Operations` registry, two initial entries                                                                                                                                  |
| `src/trpc/routers/teams-router.ts`             | `createTeam` (D4H branch) and `syncronizeD4HTeam` open a `LogBatch` and thread `batchId`                                                                                              |
| `src/lib/schemas/log-entry.ts`                 | **new** — `LogRefRole`, `LogAction`, `LogObjectType`, `LogScope` unions + zod enums                                                                                                   |
| `src/server/log-entry.ts`                      | **new** — `recordLogEntry`, module-derivation map                                                                                                                                     |
| `src/server/log-entry.test.ts`                 | **new**                                                                                                                                                                               |
| `src/server/auth-log-hooks.ts`                 | **new** — pure mapping fns                                                                                                                                                            |
| `src/server/auth-log-hooks.test.ts`            | **new**                                                                                                                                                                               |
| `src/server/auth.ts`                           | `databaseHooks` shell                                                                                                                                                                 |
| `src/trpc/init.ts`                             | generalize `logEvent`, add sibling helpers, central impersonation + actorLabel resolution, extend `LogEventOptions`                                                                   |
| `src/trpc/routers/system-admin-router.ts`      | convert hand-rolled entries; drop the log `deleteMany`                                                                                                                                |
| `src/trpc/routers/system-admin-router.test.ts` | update assertions                                                                                                                                                                     |
| `docs/patterns/transactional-writes.md`        | `OrganizationLogEntry` → `LogEntry`; note `refs`                                                                                                                                      |
| `src/generated/dmmf.ts`                        | regenerated                                                                                                                                                                           |

## Resolved questions

All four were settled on 2026-09-09, three of them by reading better-auth 1.7.3 in
`node_modules` rather than by preference.

- **better-auth hook failure semantics → fail-open.** Not a trade-off in the end: `after`
  hooks run post-commit and better-auth never supplies the `onAfterCommitHookError`
  handler its core supports, so a throwing hook returns a 500 for a write that already
  succeeded. Fail-closed does not exist on this path. Hooks catch and `console.error`; see
  "Verified hook mechanics".
- **Impersonation end → logged.** `stopImpersonating` deletes the session through the
  hooked path, so `session.delete.after` carries `impersonatedBy` reliably. Both ends of an
  impersonation appear on the timeline.
- **Old values in hooks → read-in-`before`, record-in-`after`.** Hook payloads carry no
  previous value. Only the email change needs one; it is captured with a targeted read in
  `user.update.before` stashed on a `WeakMap`. See "Email change: capturing the old
  address".
- **`systemAdminProcedure.logEvent` scope → inferred from `organizationId`, no explicit
  `scope` param.** An explicit scope alongside an `organizationId` is redundant in the
  valid cases and contradictory in the invalid ones (`scope: "user"` plus an
  `organizationId` has no meaning), so the parameter would exist only to be validated
  against the other one. Inference has a single source of truth.

## Follow-ups (explicitly out of scope)

- ~~The `changes` diff rework~~ — **done**, merged 2026-09-09. `src/lib/diff.ts` was
  rewritten flatten-then-diff with a `DiffChange` zod union, and `logEvent` parses against
  it.
- ~~`reorderGroups` / `reorderGroupSkills` log N entries where they should log one~~ —
  **done** in the same pass. Both now emit one entry against the parent using the new
  `arr_ord` change type. The `context` refs this spec adds are still a possible refinement,
  but the N-entries defect is fixed.
- Centralised redaction policy in `recordLogEntry` (password, tokens,
  `D4hAccessToken.token`, invitation tokens) rather than per-call-site discipline.
- `withOperationRun` (or whatever ergonomics fit) and the first real unattended operation; `LogBatch`
  gains `finishedAt`/status/counts at that point.
- A stored `moduleId`, if module attribution should be frozen historically once module
  boundaries settle.
- Display surfaces (per the non-goals).
- Denormalizing `sequence` onto `LogEntryObject` if entity timelines get hot.
