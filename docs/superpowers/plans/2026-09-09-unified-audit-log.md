# Unified Audit Log — Capture Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the org-only `OrganizationLogEntry` with a `LogEntry` model that serves organization-, user-, and system-scoped events, written through a single `recordLogEntry` service that every caller — tRPC procedures and better-auth database hooks — funnels through.

**Architecture:** One server-side write service (`src/server/log-entry.ts`) owns the write and all its invariants. Three thin entry points delegate to it: `organizationProcedure.logEvent` (unchanged signature), new `logEvent` helpers on `authenticatedProcedure` and `systemAdminProcedure`, and better-auth `databaseHooks` whose logic lives in pure, testable mapping functions. A `LogEntryObject` fan-out table indexes each entry against every entity it touches, and a `LogBatch` row correlates the entries of one multi-entry operation.

**Tech Stack:** Next.js 16, TypeScript (ES2017 target), Prisma 7 + PostgreSQL, tRPC 11, zod 4, better-auth 1.7.3, Vitest + jsdom, `prisma-mock`, remeda.

**Spec:** [`docs/superpowers/specs/2026-09-08-unified-audit-log-design.md`](../specs/2026-09-08-unified-audit-log-design.md)

## Global Constraints

- **Never reset the database.** No `prisma migrate reset`, no `--force`, no `--force-reset`, no `--accept-data-loss`. Migrations are generated with `--create-only`, inspected, hand-edited, then applied with `npm run prisma migrate dev`. If a command offers to reset, abort and report.
- **`src/server/log-entry.ts` must not import `@/server/prisma`.** The Prisma client is injected by the caller, exactly as `src/server/organization-settings-store.ts` does and documents. This is what lets the file be unit-tested from the jsdom environment against `createMockPrisma()`.
- **Never import `@/server/auth`, `@/server/prisma`, or anything that imports them from a test file or a router file.** They throw under jsdom.
- Procedures within each tRPC router stay in alphabetical order.
- New record IDs use `nanoId16()` from `src/lib/id.ts`.
- Zod 4 syntax throughout.
- Pair a write with its log entry inside `ctx.prisma.$transaction([...])`, never `Promise.all([...])`.
- Every file gets the standard copyright header used by its neighbours:
  ```ts
  /*
   *  Copyright (c) 2026 A.V.U.T. Project.
   *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
   */
  ```
- Formatting is a pre-commit hook (`prettier --write`). Do not hand-format for style.
- After every task: `npx tsc --noEmit` and `npm run test:run` must both pass before committing.

## Deviations from the spec (deliberate, recorded here so they are not read as drift)

1. **`recordLogEntry(input, tx)` takes a required `tx`.** The spec says `tx` defaults to the module `prisma` client. It cannot: `src/server/organization-settings-store.ts` establishes — in a comment written for exactly this reason — that a server file needing a unit test must not import `@/server/prisma`. Every caller already holds a client (`ctx.prisma` in tRPC, the module `prisma` in `auth.ts`, which is genuinely server-only), so requiring it costs nothing.
2. **`actorLabel` is a top-level field of `RecordLogEntryInput`, not a member of `LogActor`.** The spec nests it inside the actor object, but an unattended run has `actor: null` and still needs a label ("D4H user sync"). Top-level covers both cases with one field.
3. **The D4H batch site is `teams-router.importTeamFromD4H`, not `createTeam`.** The spec's file summary names `createTeam`'s "D4H-linked branch"; no such branch exists. `createTeam` is the plain path and `importTeamFromD4H` (marked `@deprecated`, still live) is the D4H one.
4. **Ban/unban and password detection use the `before` payload, not just the `after` row.** The spec's "Verified hook mechanics" section establishes that `update.after` cannot tell which fields were touched. The same `WeakMap` stash that carries the previous email also carries the touched-key list. No extra read is needed for ban or password — only email needs a pre-value.

---

## File Structure

| File                                      | Responsibility                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prisma/schema.prisma`                    | `LogEntry` (renamed), `LogEntryObject`, `LogBatch`, and the `User`/`Organization` back-relations                                                       |
| `prisma/migrations/*/migration.sql`       | generated migration + hand-added partial unique index                                                                                                  |
| `src/generated/dmmf.ts`                   | regenerated so `prisma-mock` knows the new models                                                                                                      |
| `src/lib/schemas/log-entry.ts`            | the closed vocabularies — `LogScope`, `LogAction`, `LogObjectType`, `LogRefRole` — and the `objectType → ModuleId` map. Pure, importable from anywhere |
| `src/lib/operations.ts`                   | the `Operations` registry: the closed vocabulary of multi-entry operations                                                                             |
| `src/server/log-entry.ts`                 | `recordLogEntry` + `createLogBatch`. Owns every write-time invariant. Prisma client injected                                                           |
| `src/server/log-entry.test.ts`            | invariants, refs fan-out, batches, deletion behaviour                                                                                                  |
| `src/server/auth-log-hooks.ts`            | pure mapping functions: a better-auth mutation row + what the write touched → `RecordLogEntryInput[]`                                                  |
| `src/server/auth-log-hooks.test.ts`       | the mapping functions                                                                                                                                  |
| `src/server/auth.ts`                      | the `databaseHooks` shell — snapshot in `before`, map + record in `after`, catch everything                                                            |
| `src/trpc/init.ts`                        | three `logEvent` entry points; central impersonation and `actorLabel` resolution                                                                       |
| `src/trpc/routers/system-admin-router.ts` | hand-rolled entries converted; the log `deleteMany` removed; `deleteUser`/`setUserRole` gain real entries                                              |
| `src/trpc/routers/teams-router.ts`        | `importTeamFromD4H` and `syncronizeD4HTeam` open a `LogBatch` and thread `batchId`                                                                     |
| `src/trpc/routers/personnel-router.ts`    | `createPerson` gains an optional `batchId` so batch runs can thread it                                                                                 |
| `src/test/trpc-helpers.ts`                | mock context can set `impersonatedBy`                                                                                                                  |
| `docs/patterns/transactional-writes.md`   | `OrganizationLogEntry` → `LogEntry`; note `refs`                                                                                                       |

---

### Task 1: Schema, migration, and the model rename

Renames the model and adds the two new tables. Everything that referenced `organizationLogEntry` is repointed so the tree compiles and the suite stays green. `init.ts`'s `logEvent` gets a **stopgap** body here — Task 4 replaces it with a `recordLogEntry` delegation.

**Files:**

- Modify: `prisma/schema.prisma` — `OrganizationLogEntry` model (currently lines 241-258), `User` model (lines 22-47), `Organization` model
- Create: `prisma/migrations/<timestamp>_unified_audit_log/migration.sql` (generated, then hand-edited)
- Modify: `src/generated/dmmf.ts` (regenerated — never hand-edited)
- Modify: `src/trpc/init.ts:11,134,163`
- Modify: `src/trpc/routers/system-admin-router.ts` (6 `organizationLogEntry` references)
- Modify: `src/trpc/routers/skill-package-builder-router.test.ts:206,216,243,335,345`
- Modify: `src/trpc/routers/system-admin-router.test.ts:585`
- Modify: `src/trpc/routers/d4h-access-tokens-router.test.ts:86,154`

**Interfaces:**

- Produces: Prisma models `LogEntry`, `LogEntryObject`, `LogBatch`; client accessors `prisma.logEntry`, `prisma.logEntryObject`, `prisma.logBatch`. `LogEntry` has fields `id, sequence, scope, organizationId, ownerId, userId, actorLabel, impersonatorId, batchId, action, objectType, objectId, changes, description, timestamp` and an `objects` relation.

- [ ] **Step 1: Replace the `OrganizationLogEntry` model**

In `prisma/schema.prisma`, delete the whole `model OrganizationLogEntry { … }` block (it sits under the `// Logging Models` comment) and put these three models in its place:

```prisma
model LogEntry {
  id             String        @id
  // Postgres-assigned total write order. The canonical sort key for every feed.
  // `timestamp` is transaction START time, so entries written by one $transaction
  // share a byte-identical timestamp and cannot be ordered by it.
  sequence       Int           @default(autoincrement())

  // Owner. Exactly one of these is set, per `scope`; `system` sets neither.
  scope          String
  organizationId String?
  organization   Organization? @relation("log_entry_to_organization", fields: [organizationId], references: [id], onDelete: Cascade)
  ownerId        String?
  owner          User?         @relation("log_entry_to_owner", fields: [ownerId], references: [id], onDelete: Cascade)

  // Actor. `userId` is SetNull so a deleted user's actions elsewhere survive,
  // anonymised but still named by `actorLabel`.
  userId         String?
  user           User?         @relation("log_entry_to_user", fields: [userId], references: [id], onDelete: SetNull)
  actorLabel     String?
  impersonatorId String?
  impersonator   User?         @relation("log_entry_to_impersonator", fields: [impersonatorId], references: [id], onDelete: SetNull)
  batchId        String?
  batch          LogBatch?     @relation("log_entry_to_batch", fields: [batchId], references: [id], onDelete: SetNull)

  action         String
  objectType     String
  objectId       String
  changes        Json          @default("[]")
  description    String?
  timestamp      DateTime      @default(now())

  objects        LogEntryObject[] @relation("log_entry_object_to_log_entry")

  @@index([organizationId])
  @@index([objectType, objectId])
  @@index([scope, sequence])
  @@index([ownerId])
  @@index([batchId])
  @@index([sequence])
  @@map("log_entries")
}

// Fan-out index: which entities an entry is relevant to. Usually one row
// (`primary`, mirroring LogEntry.objectType/objectId), more when an entry
// bridges entities.
//
// A partial unique index — `ON log_entry_objects (log_entry_id) WHERE role =
// 'primary'` — guarantees exactly one primary row per entry. Prisma's DSL
// cannot express a partial unique index, so it is hand-added to the migration
// SQL and must be carried forward by hand if this table is ever recreated.
model LogEntryObject {
  id         String   @id
  logEntryId String
  logEntry   LogEntry @relation("log_entry_object_to_log_entry", fields: [logEntryId], references: [id], onDelete: Cascade)
  objectType String
  objectId   String
  role       String

  @@index([objectType, objectId])
  @@index([logEntryId])
  @@map("log_entry_objects")
}

// One row per multi-entry operation run. `operationKey` says what kind of
// operation it was; `userId` says who set it off. Both are meaningful and
// orthogonal — a user-clicked sync and a nightly cron share a key and differ
// in initiator.
model LogBatch {
  id           String     @id
  operationKey String
  userId       String?
  user         User?      @relation("log_batch_to_user", fields: [userId], references: [id], onDelete: SetNull)
  actorLabel   String?
  description  String?
  startedAt    DateTime   @default(now())

  entries      LogEntry[] @relation("log_entry_to_batch")

  @@index([operationKey, startedAt])
  @@map("log_batches")
}
```

- [ ] **Step 2: Update the `User` back-relations**

In `model User`, replace this line:

```prisma
  logEntries    OrganizationLogEntry[] @relation("organization_log_entry_to_user")
```

with:

```prisma
  logEntries      LogEntry[] @relation("log_entry_to_user")
  ownedLogEntries LogEntry[] @relation("log_entry_to_owner")
  impersonatedLogEntries LogEntry[] @relation("log_entry_to_impersonator")
  logBatches      LogBatch[] @relation("log_batch_to_user")
```

- [ ] **Step 3: Update the `Organization` back-relation**

Find the `Organization` model's log-entry back-relation (it reads `logEntries OrganizationLogEntry[] @relation("organization_log_entry_to_organization")`) and replace it with:

```prisma
  logEntries     LogEntry[] @relation("log_entry_to_organization")
```

Run `grep -n "OrganizationLogEntry" prisma/schema.prisma` — it must return nothing before you continue.

- [ ] **Step 4: Generate the migration WITHOUT applying it**

Run: `npm run prisma migrate dev -- --create-only --name unified_audit_log`

Expected: a new directory under `prisma/migrations/` containing `migration.sql`, and **nothing applied to the database yet**.

**If Prisma offers to reset the database, answer no and stop.** The production database is empty and dev databases may lose their log entries, but a reset destroys everything else. Report the prompt rather than accepting it.

- [ ] **Step 5: Hand-add the partial unique index**

Open the generated `migration.sql` and append this at the end:

```sql
-- Exactly one primary ref per entry. Prisma's schema DSL cannot express a
-- partial unique index, so it lives here.
CREATE UNIQUE INDEX "log_entry_objects_primary_unique"
  ON "log_entry_objects" ("logEntryId") WHERE "role" = 'primary';
```

Check the generated SQL also contains `"sequence" SERIAL` (or `GENERATED ... AS IDENTITY`) for `log_entries`. If it does not, the `@default(autoincrement())` did not land — fix the schema and regenerate rather than patching the SQL by hand.

- [ ] **Step 6: Apply the migration**

Run: `npm run prisma migrate dev`

Expected: the migration applies. Again, **do not accept a reset prompt.**

- [ ] **Step 7: Regenerate the Prisma client and DMMF**

Run: `npx prisma generate`

Expected: `src/generated/prisma/` and `src/generated/dmmf.ts` both refresh. `prisma-mock` reads the DMMF at runtime, so the test suite cannot see the new models until this runs.

- [ ] **Step 8: Stopgap — repoint `init.ts` at the new model**

This keeps the tree compiling. Task 4 replaces this body entirely; do not invest in it.

In `src/trpc/init.ts`, change the import on line 11 from:

```ts
import type { OrganizationLogEntry, Prisma } from "@/generated/prisma/client";
```

to:

```ts
import type { LogEntry, Prisma } from "@/generated/prisma/client";
```

Change the `logEvent` return type on line 134 from `Prisma.PrismaPromise<OrganizationLogEntry>` to `Prisma.PrismaPromise<LogEntry>`.

Replace the `logEvent` body (the `return tx.organizationLogEntry.create({…})` call) with:

```ts
return tx.logEntry.create({
  data: {
    id: nanoId16(),
    scope: "organization",
    organizationId: opts.input.organizationId,
    userId: opts.ctx.auth.user.id,
    action,
    objectType,
    objectId,
    changes: z.array(DiffChange.schema).parse(changes) as object[],
    description,
    objects: {
      create: [{ id: nanoId16(), objectType, objectId, role: "primary" }],
    },
  },
});
```

- [ ] **Step 9: Repoint `system-admin-router.ts`**

Replace all six `ctx.prisma.organizationLogEntry` occurrences with `ctx.prisma.logEntry`. The five `.create({ data: { … } })` calls each need two additions inside `data`: `scope: "organization",` immediately after `id`, and an `objects` nested create immediately after `description` (or after `changes` where there is no description), naming the same `objectType`/`objectId` that entry already uses. For example, `addOrganizationMember`'s becomes:

```ts
                ctx.prisma.logEntry.create({
                    data: {
                        id: nanoId16(),
                        scope: "organization",
                        organizationId: input.organizationId,
                        userId: ctx.auth.user.id,
                        action: "Create",
                        objectType: "OrganizationMembership",
                        objectId: id,
                        changes: [],
                        description: `Added user ${input.userId} as ${input.role}`,
                        objects: {
                            create: [
                                {
                                    id: nanoId16(),
                                    objectType: "OrganizationMembership",
                                    objectId: id,
                                    role: "primary",
                                },
                            ],
                        },
                    },
                }),
```

Leave the `deleteMany({ where: { userId: input.userId } })` on line 320 in place for now — Task 5 removes it, with the test that proves it should go.

- [ ] **Step 10: Repoint the test files**

In `src/trpc/routers/skill-package-builder-router.test.ts`, `src/trpc/routers/system-admin-router.test.ts`, and `src/trpc/routers/d4h-access-tokens-router.test.ts`, replace every `db.organizationLogEntry` with `db.logEntry`. No assertion content changes.

- [ ] **Step 11: Verify the tree**

Run: `npx tsc --noEmit && npm run test:run`
Expected: no type errors; the full suite passes with the same count as before this task (284 tests).

If `tsc` fails inside `.next/types` with route errors unrelated to this change, run `npx next typegen` and re-run.

- [ ] **Step 12: Commit**

```bash
git add prisma/ src/generated/ src/trpc/
git commit -m "feat(db): replace OrganizationLogEntry with scoped LogEntry model

Rename the model to LogEntry and make it serve organization-, user-, and
system-scoped events: nullable organizationId, new ownerId/scope, nullable
userId with SetNull so a deleted user's actions elsewhere survive, plus
actorLabel, impersonatorId and batchId.

Add LogEntryObject (the per-entity fan-out index, with a hand-written partial
unique index guaranteeing one primary ref per entry) and LogBatch (one row per
multi-entry operation run).

Add a sequence column. timestamp defaults to CURRENT_TIMESTAMP, which in
Postgres is transaction start time, so every entry written by one \$transaction
shares a byte-identical timestamp and ORDER BY timestamp is non-deterministic
among them — which is the standard write-plus-logEvent pattern in this codebase.

Drop the metadata column: it was never written by any call site.

The logEvent body here is a stopgap so the tree compiles; the recordLogEntry
delegation follows.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Vocabularies — `log-entry.ts` schemas and the `Operations` registry

Two small pure files that every later task imports. No runtime dependencies beyond zod and `modules.ts`.

**Files:**

- Create: `src/lib/schemas/log-entry.ts`
- Create: `src/lib/operations.ts`
- Test: `src/lib/schemas/log-entry.test.ts`

**Interfaces:**

- Consumes: `ModuleId` from `src/lib/modules.ts`.
- Produces:
  - `LogScope` (type + `LogScope.schema`), values `"organization" | "user" | "system"`
  - `LogAction` (type + `LogAction.schema`), 14 values
  - `LogObjectType` (type + `LogObjectType.schema`), 16 values
  - `LogRefRole` (type + `LogRefRole.schema`), values `"primary" | "context" | "from" | "to"`
  - `moduleIdForObjectType(objectType: LogObjectType): ModuleId | null`
  - `objectTypesForModule(moduleId: ModuleId): LogObjectType[]`
  - `Operations` registry and `OperationKey` type from `src/lib/operations.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/schemas/log-entry.test.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { Operations } from "@/lib/operations";

import {
  LogAction,
  LogObjectType,
  LogRefRole,
  LogScope,
  moduleIdForObjectType,
  objectTypesForModule,
} from "./log-entry";

describe("log-entry vocabularies", () => {
  it("accepts every scope and rejects anything else", () => {
    for (const scope of ["organization", "user", "system"]) {
      expect(LogScope.schema.parse(scope)).toBe(scope);
    }
    expect(LogScope.schema.safeParse("global").success).toBe(false);
  });

  it("includes the actions added for the audit log", () => {
    for (const action of ["Ban", "Unban", "Impersonate", "Move"]) {
      expect(LogAction.schema.parse(action)).toBe(action);
    }
    expect(LogAction.schema.safeParse("Frobnicate").success).toBe(false);
  });

  it("includes the object types added for the audit log", () => {
    for (const objectType of ["User", "Account", "Session"]) {
      expect(LogObjectType.schema.parse(objectType)).toBe(objectType);
    }
    expect(LogObjectType.schema.safeParse("Widget").success).toBe(false);
  });

  it("accepts every ref role and rejects anything else", () => {
    for (const role of ["primary", "context", "from", "to"]) {
      expect(LogRefRole.schema.parse(role)).toBe(role);
    }
    expect(LogRefRole.schema.safeParse("related").success).toBe(false);
  });
});

describe("moduleIdForObjectType", () => {
  it("attributes org-admin entities to the admin module", () => {
    expect(moduleIdForObjectType("Person")).toBe("admin");
    expect(moduleIdForObjectType("Team")).toBe("admin");
    expect(moduleIdForObjectType("D4hAccessToken")).toBe("admin");
  });

  it("attributes skill authoring entities to skill-package-builder", () => {
    expect(moduleIdForObjectType("Skill")).toBe("skill-package-builder");
    expect(moduleIdForObjectType("SkillGroup")).toBe("skill-package-builder");
    expect(moduleIdForObjectType("SkillPackage")).toBe("skill-package-builder");
  });

  it("attributes skill check sessions to skill-track", () => {
    expect(moduleIdForObjectType("SkillCheckSession")).toBe("skill-track");
  });

  it("attributes i3 templates to i3", () => {
    expect(moduleIdForObjectType("I3Template")).toBe("i3");
    expect(moduleIdForObjectType("I3TemplateVariant")).toBe("i3");
  });

  it("returns null for account entities, which belong to no module", () => {
    expect(moduleIdForObjectType("User")).toBeNull();
    expect(moduleIdForObjectType("Account")).toBeNull();
    expect(moduleIdForObjectType("Session")).toBeNull();
  });

  it("maps every declared object type, so the map cannot drift from the union", () => {
    for (const objectType of LogObjectType.values) {
      // Throws if the map has no entry — `undefined` is not `null`.
      expect(moduleIdForObjectType(objectType)).not.toBeUndefined();
    }
  });
});

describe("objectTypesForModule", () => {
  it("generates the WHERE-IN list for a module feed", () => {
    expect(objectTypesForModule("i3").sort()).toEqual(["I3Template", "I3TemplateVariant"]);
  });

  it("returns an empty list for a module with no logged entities", () => {
    expect(objectTypesForModule("notes")).toEqual([]);
  });
});

describe("Operations", () => {
  it("names the two multi-entry operations that exist today", () => {
    expect(Object.keys(Operations).sort()).toEqual(["d4h-team-import", "d4h-team-sync"]);
  });

  it("gives every operation a human label", () => {
    for (const operation of Object.values(Operations)) {
      expect(operation.label.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/schemas/log-entry.test.ts`
Expected: FAIL — cannot resolve `./log-entry` or `@/lib/operations`.

- [ ] **Step 3: Write `src/lib/operations.ts`**

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * The closed vocabulary of multi-entry operations — the `operationKey` on a
 * `LogBatch`.
 *
 * Mirrors `modules.ts`: one source of truth for the keys and their human
 * labels, so a call site cannot invent a key.
 *
 * A batch correlates *independently meaningful events* — ones that would each
 * belong, on their own, on their own entity's timeline. It does not exist to
 * group the row-writes of a single event. A D4H import creating a Person earns
 * an entry on that person's page and so is a batch; a reorder writing a
 * sequence integer across five rows is one event whose N-ness is an
 * implementation detail, and is one entry.
 */
export const Operations = {
  "d4h-team-import": { label: "D4H team import" },
  "d4h-team-sync": { label: "D4H team sync" },
} as const;

/** Identifier for a named multi-entry operation. */
export type OperationKey = keyof typeof Operations;
```

- [ ] **Step 4: Write `src/lib/schemas/log-entry.ts`**

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { ModuleId } from "@/lib/modules";

/**
 * Which log a `LogEntry` belongs to.
 *
 * Partly derivable from the entry's foreign keys, but kept explicit so the
 * owner invariant can be guarded on write and the per-scope feeds can be
 * indexed. Intended to match a realigned `modules.ts` `ModuleScope`.
 */
const logScopeValues = ["organization", "user", "system"] as const;

export const LogScope = {
  values: logScopeValues,
  schema: z.enum(logScopeValues),
} as const;

export type LogScope = (typeof logScopeValues)[number];

/** What happened. */
const logActionValues = [
  "Approve",
  "Archive",
  "Ban",
  "Create",
  "Delete",
  "Impersonate",
  "Move",
  "Publish",
  "Restore",
  "Subscribe",
  "Unban",
  "Unpublish",
  "Unsubscribe",
  "Update",
] as const;

export const LogAction = {
  values: logActionValues,
  schema: z.enum(logActionValues),
} as const;

export type LogAction = (typeof logActionValues)[number];

/** What it happened to. */
const logObjectTypeValues = [
  "Account",
  "D4hAccessToken",
  "I3Template",
  "I3TemplateVariant",
  "Organization",
  "OrganizationMembership",
  "OrganizationSettings",
  "Person",
  "Session",
  "Skill",
  "SkillCheckSession",
  "SkillGroup",
  "SkillPackage",
  "Team",
  "TeamMembership",
  "User",
] as const;

export const LogObjectType = {
  values: logObjectTypeValues,
  schema: z.enum(logObjectTypeValues),
} as const;

export type LogObjectType = (typeof logObjectTypeValues)[number];

/**
 * How a `LogEntryObject` relates to its entry.
 *
 * Stored as text so adding a value never needs a migration, but typed as a
 * closed union — `recordLogEntry` rejects anything off it. Disambiguation
 * relies on `objectType`, so `"from"` needs no compound tokens: `role: "from"`
 * with `objectType: "SkillPackage"` is unambiguous against the same role with
 * `objectType: "SkillGroup"`.
 */
const logRefRoleValues = ["primary", "context", "from", "to"] as const;

export const LogRefRole = {
  values: logRefRoleValues,
  schema: z.enum(logRefRoleValues),
} as const;

export type LogRefRole = (typeof logRefRoleValues)[number];

/**
 * Module attribution, derived rather than stored.
 *
 * A module is a pure function of `objectType`, so a `moduleId` column would be
 * a derived value maintained at ~60 call sites. Deriving means a fix to this
 * map rewrites history — the behaviour we want while the map is young and
 * possibly wrong, and the wrong one once module boundaries are settled. Revisit
 * when a display exists.
 *
 * `Skill`/`SkillGroup`/`SkillPackage` are the one genuine ambiguity: they are
 * authored in `skill-package-builder` and consumed in `skill-track`. They are
 * attributed to where they are mutated, which is where entries originate.
 */
const moduleByObjectType: Record<LogObjectType, ModuleId | null> = {
  Account: null,
  D4hAccessToken: "admin",
  I3Template: "i3",
  I3TemplateVariant: "i3",
  Organization: "admin",
  OrganizationMembership: "admin",
  OrganizationSettings: "admin",
  Person: "admin",
  Session: null,
  Skill: "skill-package-builder",
  SkillCheckSession: "skill-track",
  SkillGroup: "skill-package-builder",
  SkillPackage: "skill-package-builder",
  Team: "admin",
  TeamMembership: "admin",
  User: null,
};

/** The module an entry about this kind of object belongs to, or null for account entities. */
export function moduleIdForObjectType(objectType: LogObjectType): ModuleId | null {
  return moduleByObjectType[objectType];
}

/** The object types whose entries make up a module's activity feed. */
export function objectTypesForModule(moduleId: ModuleId): LogObjectType[] {
  return LogObjectType.values.filter((objectType) => moduleByObjectType[objectType] === moduleId);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/schemas/log-entry.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Type check the whole tree**

Run: `npx tsc --noEmit && npm run test:run`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/schemas/log-entry.ts src/lib/schemas/log-entry.test.ts src/lib/operations.ts
git commit -m "feat(log): add log entry vocabularies and the Operations registry

Closed unions for scope, action, objectType and ref role, each with a zod enum
so recordLogEntry can reject anything off them.

Module attribution is a derived map rather than a stored column: a module is a
pure function of objectType, so storing it would mean maintaining a derived
value at ~60 call sites. A test walks the whole objectType union so the map
cannot drift from it.

Operations is the closed vocabulary of multi-entry operations, mirroring
modules.ts so a call site cannot invent a batch key.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The write service — `recordLogEntry` and `createLogBatch`

The heart of the design. Every invariant lives here and nowhere else.

**Files:**

- Create: `src/server/log-entry.ts`
- Test: `src/server/log-entry.test.ts`

**Interfaces:**

- Consumes: `LogAction`, `LogObjectType`, `LogRefRole`, `LogScope` from `@/lib/schemas/log-entry`; `OperationKey` from `@/lib/operations`; `DiffChange` from `@/lib/diff`; `OrganizationId` from `@/lib/schemas/organization`; `UserId` from `@/lib/schemas/user`; `nanoId16` from `@/lib/id`.
- Produces:
  ```ts
  export type LogActor = { userId: UserId; impersonatorId?: UserId } | null;
  export interface LogEntryRef {
    objectType: LogObjectType;
    objectId: string;
    role?: LogRefRole;
  }
  export interface RecordLogEntryInput {
    scope: LogScope;
    organizationId?: OrganizationId | null;
    ownerId?: UserId | null;
    actor: LogActor;
    actorLabel?: string;
    batchId?: string;
    action: LogAction;
    objectType: LogObjectType;
    objectId: string;
    changes?: DiffChange[];
    description?: string;
    refs?: LogEntryRef[];
  }
  export interface CreateLogBatchInput {
    operationKey: OperationKey;
    userId?: UserId;
    actorLabel?: string;
    description?: string;
  }
  export class LogEntryInvariantError extends Error {}
  export type LogEntryPrisma = Pick<PrismaClient, "logEntry" | "logBatch">;
  export function recordLogEntry(
    input: RecordLogEntryInput,
    tx: LogEntryPrisma,
  ): Prisma.PrismaPromise<LogEntry>;
  export function createLogBatch(
    input: CreateLogBatchInput,
    tx: LogEntryPrisma,
  ): Prisma.PrismaPromise<LogBatch>;
  export function formatActorLabel(name: string, email: string): string;
  ```

**Notes for the implementer:**

- `recordLogEntry` **parses `changes` against `DiffChange.schema`.** `logEvent` does this today; moving it here keeps the guarantee and extends it to the better-auth hooks. The `as object[]` cast that follows is Prisma's Json input plumbing and cannot be removed — the parse is what makes it safe.
- `recordLogEntry` **validates synchronously and then returns the un-awaited `PrismaPromise`.** Do not make it `async` — an `async` function would wrap the write in a plain promise, and the existing `ctx.prisma.$transaction([...])` call sites throughout the codebase require a real `PrismaPromise`. Throwing before the return is what makes an invariant violation surface at the call site rather than inside a transaction array.
- One nested create writes both tables atomically, which is what preserves the single-promise contract.
- `prisma-mock` quirk worth knowing: a `Json` column left at its schema **default** comes back as the string `"[]"`, not an array. Explicitly-written values come back as real arrays. Always write `changes` explicitly.

- [ ] **Step 1: Write the failing test**

Create `src/server/log-entry.test.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";

import {
  createLogBatch,
  formatActorLabel,
  LogEntryInvariantError,
  recordLogEntry,
  type RecordLogEntryInput,
} from "./log-entry";

const T = {
  org: OrganizationId.create(),
  actor: UserId.create(),
  owner: UserId.create(),
  admin: UserId.create(),
};

function baseInput(): RecordLogEntryInput {
  return {
    scope: "organization",
    organizationId: T.org,
    actor: { userId: T.actor },
    actorLabel: "Ada Lovelace <ada@example.com>",
    action: "Update",
    objectType: "Person",
    objectId: "person_1",
  };
}

describe("recordLogEntry — owner invariant", () => {
  const db = createMockPrisma();

  it("accepts organization scope with an organizationId and no ownerId", async () => {
    const entry = await recordLogEntry(baseInput(), db);
    expect(entry.scope).toBe("organization");
    expect(entry.organizationId).toBe(T.org);
    expect(entry.ownerId).toBeNull();
  });

  it("accepts user scope with an ownerId and no organizationId", async () => {
    const entry = await recordLogEntry(
      { ...baseInput(), scope: "user", organizationId: null, ownerId: T.owner },
      db,
    );
    expect(entry.scope).toBe("user");
    expect(entry.ownerId).toBe(T.owner);
    expect(entry.organizationId).toBeNull();
  });

  it("accepts system scope with neither", async () => {
    const entry = await recordLogEntry(
      { ...baseInput(), scope: "system", organizationId: null },
      db,
    );
    expect(entry.scope).toBe("system");
    expect(entry.organizationId).toBeNull();
    expect(entry.ownerId).toBeNull();
  });

  it("rejects organization scope without an organizationId", () => {
    expect(() => recordLogEntry({ ...baseInput(), organizationId: null }, db)).toThrow(
      LogEntryInvariantError,
    );
  });

  it("rejects organization scope carrying an ownerId", () => {
    expect(() => recordLogEntry({ ...baseInput(), ownerId: T.owner }, db)).toThrow(
      LogEntryInvariantError,
    );
  });

  it("rejects user scope without an ownerId", () => {
    expect(() =>
      recordLogEntry({ ...baseInput(), scope: "user", organizationId: null }, db),
    ).toThrow(LogEntryInvariantError);
  });

  it("rejects user scope carrying an organizationId", () => {
    expect(() => recordLogEntry({ ...baseInput(), scope: "user", ownerId: T.owner }, db)).toThrow(
      LogEntryInvariantError,
    );
  });

  it("rejects system scope carrying an owner", () => {
    expect(() =>
      recordLogEntry(
        { ...baseInput(), scope: "system", organizationId: null, ownerId: T.owner },
        db,
      ),
    ).toThrow(LogEntryInvariantError);
  });
});

describe("recordLogEntry — actor invariant", () => {
  const db = createMockPrisma();

  it("records the acting user and their denormalized label", async () => {
    const entry = await recordLogEntry(baseInput(), db);
    expect(entry.userId).toBe(T.actor);
    expect(entry.actorLabel).toBe("Ada Lovelace <ada@example.com>");
  });

  it("records an impersonator alongside the acting user", async () => {
    const entry = await recordLogEntry(
      { ...baseInput(), actor: { userId: T.actor, impersonatorId: T.admin } },
      db,
    );
    expect(entry.userId).toBe(T.actor);
    expect(entry.impersonatorId).toBe(T.admin);
  });

  it("accepts a null actor when a batchId supplies the provenance", async () => {
    const batch = await createLogBatch(
      { operationKey: "d4h-team-sync", actorLabel: "D4H team sync" },
      db,
    );
    const entry = await recordLogEntry(
      { ...baseInput(), actor: null, batchId: batch.id, actorLabel: "D4H team sync" },
      db,
    );
    expect(entry.userId).toBeNull();
    expect(entry.batchId).toBe(batch.id);
    expect(entry.actorLabel).toBe("D4H team sync");
  });

  it("rejects an entry with neither an actor nor a batch — it has no provenance at all", () => {
    expect(() => recordLogEntry({ ...baseInput(), actor: null }, db)).toThrow(
      LogEntryInvariantError,
    );
  });
});

describe("recordLogEntry — refs fan-out", () => {
  const db = createMockPrisma();

  it("adds a primary ref mirroring objectType and objectId", async () => {
    const entry = await recordLogEntry(baseInput(), db);
    const objects = await db.logEntryObject.findMany({ where: { logEntryId: entry.id } });

    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({
      objectType: "Person",
      objectId: "person_1",
      role: "primary",
    });
    expect(objects[0].objectType).toBe(entry.objectType);
    expect(objects[0].objectId).toBe(entry.objectId);
  });

  it("writes extra refs, defaulting their role to context", async () => {
    const entry = await recordLogEntry(
      {
        ...baseInput(),
        objectId: "skill_1",
        objectType: "Skill",
        action: "Move",
        refs: [
          { objectType: "SkillPackage", objectId: "pkg_a", role: "from" },
          { objectType: "SkillPackage", objectId: "pkg_b", role: "to" },
          { objectType: "Team", objectId: "team_5" },
        ],
      },
      db,
    );

    const objects = await db.logEntryObject.findMany({ where: { logEntryId: entry.id } });
    expect(objects).toHaveLength(4);
    expect(objects.map((o) => [o.objectId, o.role]).sort()).toEqual(
      [
        ["pkg_a", "from"],
        ["pkg_b", "to"],
        ["skill_1", "primary"],
        ["team_5", "context"],
      ].sort(),
    );
  });

  it("drops a ref that duplicates the primary rather than writing a second row", async () => {
    const entry = await recordLogEntry(
      {
        ...baseInput(),
        refs: [{ objectType: "Person", objectId: "person_1", role: "context" }],
      },
      db,
    );

    const objects = await db.logEntryObject.findMany({ where: { logEntryId: entry.id } });
    expect(objects).toHaveLength(1);
    expect(objects[0].role).toBe("primary");
  });

  it("rejects a role off the closed union", () => {
    expect(() =>
      recordLogEntry(
        {
          ...baseInput(),
          refs: [
            {
              objectType: "Team",
              objectId: "team_5",
              role: "related" as never,
            },
          ],
        },
        db,
      ),
    ).toThrow(LogEntryInvariantError);
  });

  it("rejects an objectType off the closed union", () => {
    expect(() => recordLogEntry({ ...baseInput(), objectType: "Widget" as never }, db)).toThrow(
      LogEntryInvariantError,
    );
  });
});

describe("recordLogEntry — ordering", () => {
  const db = createMockPrisma();

  it("assigns a distinct, increasing sequence to each entry", async () => {
    const first = await recordLogEntry(baseInput(), db);
    const second = await recordLogEntry(baseInput(), db);
    const third = await recordLogEntry(baseInput(), db);

    expect(typeof first.sequence).toBe("number");
    expect(second.sequence).toBeGreaterThan(first.sequence);
    expect(third.sequence).toBeGreaterThan(second.sequence);
  });
});

describe("createLogBatch", () => {
  const db = createMockPrisma();

  it("records the operation key and the initiating user", async () => {
    const batch = await createLogBatch(
      {
        operationKey: "d4h-team-import",
        userId: T.actor,
        actorLabel: "Ada Lovelace <ada@example.com>",
        description: "Imported members from D4H",
      },
      db,
    );

    expect(batch.operationKey).toBe("d4h-team-import");
    expect(batch.userId).toBe(T.actor);
    expect(batch.description).toBe("Imported members from D4H");
  });

  it("allows an unattended run with no initiating user", async () => {
    const batch = await createLogBatch(
      { operationKey: "d4h-team-sync", actorLabel: "D4H team sync" },
      db,
    );
    expect(batch.userId).toBeNull();
    expect(batch.actorLabel).toBe("D4H team sync");
  });

  it("rejects an operation key off the registry", () => {
    expect(() => createLogBatch({ operationKey: "not-a-real-operation" as never }, db)).toThrow(
      LogEntryInvariantError,
    );
  });
});

describe("deletion behaviour", () => {
  it("anonymises an actor's entries elsewhere but keeps them readable", async () => {
    const db = createMockPrisma();
    const actorId = UserId.create();

    await db.user.create({
      data: { id: actorId, name: "Ada Lovelace", email: "ada@example.com" },
    });
    await db.organization.create({
      data: { id: T.org, name: "Org", slug: `org-${nanoId16()}`, createdAt: new Date() },
    });

    await recordLogEntry(
      {
        ...baseInput(),
        actor: { userId: actorId },
        actorLabel: "Ada Lovelace <ada@example.com>",
      },
      db,
    );

    await db.user.delete({ where: { id: actorId } });

    const entries = await db.logEntry.findMany({ where: { organizationId: T.org } });
    expect(entries).toHaveLength(1);
    expect(entries[0].userId).toBeNull();
    expect(entries[0].actorLabel).toBe("Ada Lovelace <ada@example.com>");
  });

  it("removes a user's own scope-user log when they are deleted", async () => {
    const db = createMockPrisma();
    const ownerId = UserId.create();
    const adminId = UserId.create();

    await db.user.create({
      data: { id: ownerId, name: "Kim Park", email: "kim@example.com" },
    });
    await db.user.create({
      data: { id: adminId, name: "Dana Okafor", email: "dana@example.com" },
    });

    await recordLogEntry(
      {
        scope: "user",
        ownerId,
        actor: { userId: adminId },
        actorLabel: "Dana Okafor <dana@example.com>",
        action: "Ban",
        objectType: "User",
        objectId: ownerId,
      },
      db,
    );

    expect(await db.logEntry.count()).toBe(1);

    await db.user.delete({ where: { id: ownerId } });

    expect(await db.logEntry.count()).toBe(0);
  });
});

describe("formatActorLabel", () => {
  it("renders a name and email in the denormalized form", () => {
    expect(formatActorLabel("Ada Lovelace", "ada@example.com")).toBe(
      "Ada Lovelace <ada@example.com>",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/server/log-entry.test.ts`
Expected: FAIL — cannot resolve `./log-entry`.

- [ ] **Step 3: Write `src/server/log-entry.ts`**

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * The single write path for the audit log.
 *
 * Deliberately NOT marked `server-only` and deliberately free of any `@/server/prisma`
 * import — the Prisma client is injected by the caller, so this can be exercised from the
 * jsdom test environment against `createMockPrisma()`. Same reasoning as
 * `organization-settings-store.ts`.
 *
 * Every write-time invariant lives here rather than in database CHECK constraints, which
 * Prisma models poorly. They are write-time only and DO NOT hold on read: `userId` is
 * `onDelete: SetNull`, so a human-actor entry can later hold a null `userId`. Read-side
 * code must tolerate a null actor and fall back to `actorLabel`. Do not re-assert these
 * invariants as zod parses on query results.
 */

import * as z from "zod";

import type { LogBatch, LogEntry, Prisma, PrismaClient } from "@/generated/prisma/client";
import { DiffChange } from "@/lib/diff";
import { nanoId16 } from "@/lib/id";
import { Operations, type OperationKey } from "@/lib/operations";
import { LogObjectType, LogRefRole, type LogAction, type LogScope } from "@/lib/schemas/log-entry";
import type { OrganizationId } from "@/lib/schemas/organization";
import type { UserId } from "@/lib/schemas/user";

/** The slice of the Prisma client this module needs. */
export type LogEntryPrisma = Pick<PrismaClient, "logEntry" | "logBatch">;

/**
 * A human actor, or none.
 *
 * An operation run identifies itself through its `LogBatch` instead, which is why a null
 * actor is only legal alongside a `batchId`.
 */
export type LogActor = { userId: UserId; impersonatorId?: UserId } | null;

/** An extra entity an entry is relevant to. The primary is implicit. */
export interface LogEntryRef {
  objectType: LogObjectType;
  objectId: string;
  role?: LogRefRole;
}

export interface RecordLogEntryInput {
  scope: LogScope;
  organizationId?: OrganizationId | null;
  ownerId?: UserId | null;
  actor: LogActor;
  /**
   * The actor's display name and email, denormalized so the entry stays readable after
   * the user is deleted — or the operation label for an unattended run.
   */
  actorLabel?: string;
  /** An existing `LogBatch.id`. Required when `actor` is null. */
  batchId?: string;
  action: LogAction;
  objectType: LogObjectType;
  objectId: string;
  changes?: DiffChange[];
  description?: string;
  /** Extra entities this entry is relevant to. The primary is added automatically. */
  refs?: LogEntryRef[];
}

export interface CreateLogBatchInput {
  operationKey: OperationKey;
  userId?: UserId;
  actorLabel?: string;
  description?: string;
}

/** Thrown when a log entry would violate a write-time invariant. */
export class LogEntryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogEntryInvariantError";
  }
}

/** The denormalized actor label format. One place, so entries render consistently. */
export function formatActorLabel(name: string, email: string): string {
  return `${name} <${email}>`;
}

function assertOwnerInvariant(input: RecordLogEntryInput): void {
  const hasOrganization = input.organizationId != null;
  const hasOwner = input.ownerId != null;

  switch (input.scope) {
    case "organization":
      if (!hasOrganization)
        throw new LogEntryInvariantError(
          'A log entry with scope "organization" requires an organizationId.',
        );
      if (hasOwner)
        throw new LogEntryInvariantError(
          'A log entry with scope "organization" must not set an ownerId.',
        );
      return;
    case "user":
      if (!hasOwner)
        throw new LogEntryInvariantError('A log entry with scope "user" requires an ownerId.');
      if (hasOrganization)
        throw new LogEntryInvariantError(
          'A log entry with scope "user" must not set an organizationId.',
        );
      return;
    case "system":
      if (hasOrganization || hasOwner)
        throw new LogEntryInvariantError(
          'A log entry with scope "system" must set neither an organizationId nor an ownerId.',
        );
      return;
  }
}

function assertActorInvariant(input: RecordLogEntryInput): void {
  if (input.actor == null && input.batchId == null) {
    throw new LogEntryInvariantError(
      "A log entry with no actor requires a batchId — an entry with neither has no provenance.",
    );
  }
}

/**
 * Record a log entry, and the `LogEntryObject` rows indexing it, as one write.
 *
 * Validates synchronously and returns the un-awaited `PrismaPromise`, so an invariant
 * violation surfaces at the call site and the result still composes into
 * `prisma.$transaction([...])`. Do not make this `async`.
 */
export function recordLogEntry(
  input: RecordLogEntryInput,
  tx: LogEntryPrisma,
): Prisma.PrismaPromise<LogEntry> {
  assertOwnerInvariant(input);
  assertActorInvariant(input);

  const objectType = parseOrThrow(
    LogObjectType.schema,
    input.objectType,
    `Unknown objectType "${input.objectType}".`,
  );

  // Refs duplicating the primary are a no-op, not a duplicate row — a caller passing
  // the primary again should not trip the partial unique index.
  const refs = (input.refs ?? []).filter(
    (ref) => !(ref.objectType === objectType && ref.objectId === input.objectId),
  );

  const refRows = refs.map((ref) => ({
    id: nanoId16(),
    objectType: parseOrThrow(
      LogObjectType.schema,
      ref.objectType,
      `Unknown ref objectType "${ref.objectType}".`,
    ),
    objectId: ref.objectId,
    role: parseOrThrow(LogRefRole.schema, ref.role ?? "context", `Unknown ref role "${ref.role}".`),
  }));

  return tx.logEntry.create({
    data: {
      id: nanoId16(),
      scope: input.scope,
      organizationId: input.organizationId ?? null,
      ownerId: input.ownerId ?? null,
      userId: input.actor?.userId ?? null,
      actorLabel: input.actorLabel ?? null,
      impersonatorId: input.actor?.impersonatorId ?? null,
      batchId: input.batchId ?? null,
      action: input.action,
      objectType,
      objectId: input.objectId,
      // Parsed, not merely cast. `logEvent` used to do this; centralising it here
      // means the better-auth hooks and every future caller get it too. The cast is
      // Prisma's Json input plumbing and is unavoidable — the parse is the guarantee.
      changes: z.array(DiffChange.schema).parse(input.changes ?? []) as object[],
      description: input.description,
      objects: {
        create: [
          {
            id: nanoId16(),
            objectType,
            objectId: input.objectId,
            role: "primary",
          },
          ...refRows,
        ],
      },
    },
  });
}

/**
 * Open a batch.
 *
 * Entries reference the batch, so the batch row must exist before them. Prisma's
 * sequential `$transaction([...])` runs in array order, so `[createBatch, ...writes,
 * ...logEvents]` is correct — but reordering that array breaks the FK. Keep the batch
 * create first.
 */
export function createLogBatch(
  input: CreateLogBatchInput,
  tx: LogEntryPrisma,
): Prisma.PrismaPromise<LogBatch> {
  if (!(input.operationKey in Operations)) {
    throw new LogEntryInvariantError(
      `Unknown operationKey "${input.operationKey}". Add it to the Operations registry.`,
    );
  }

  return tx.logBatch.create({
    data: {
      id: nanoId16(),
      operationKey: input.operationKey,
      userId: input.userId ?? null,
      actorLabel: input.actorLabel ?? null,
      description: input.description,
    },
  });
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new LogEntryInvariantError(message);
  return result.data;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/log-entry.test.ts`
Expected: PASS, 24 tests.

- [ ] **Step 5: Type check and run the full suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/server/log-entry.ts src/server/log-entry.test.ts
git commit -m "feat(log): add the recordLogEntry write service

One service owns every write-time invariant: the owner rules per scope, the
rule that an entry with no actor needs a batch for provenance, the closed
objectType and ref-role unions, and the automatic primary ref mirroring
objectType/objectId.

Validates synchronously and returns the un-awaited PrismaPromise. An async
wrapper would break every existing prisma.\$transaction([...]) call site, and
validating before the return is what makes a violation surface at the call site
rather than inside a transaction array.

One nested create writes the entry and its refs atomically, preserving the
single-promise contract logEvent depends on.

The Prisma client is injected rather than imported, so this is unit-testable
from jsdom — same reasoning as organization-settings-store.ts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: tRPC entry points — three `logEvent` helpers

Replaces Task 1's stopgap. Impersonation and `actorLabel` are resolved centrally, once per entry point, so no call site can forget them.

**Files:**

- Modify: `src/trpc/init.ts`
- Modify: `src/test/trpc-helpers.ts`
- Modify: `docs/patterns/transactional-writes.md`
- Test: `src/trpc/init.test.ts` (create)

**Interfaces:**

- Consumes: `recordLogEntry`, `formatActorLabel`, `LogActor` from `@/server/log-entry`; `LogAction`, `LogObjectType` from `@/lib/schemas/log-entry`.
- Produces:
  - `AuthenticatedOrganizationContext.logEvent(options: LogEventOptions, tx?): Prisma.PrismaPromise<LogEntry>` — signature unchanged from today, `LogEventOptions` gains `refs` and `batchId`
  - `AuthenticatedContext.logEvent(options: LogEventOptions, tx?): Prisma.PrismaPromise<LogEntry>` — `scope: "user"`, `ownerId` = the calling user
  - `SystemAdminContext.logEvent(options: SystemAdminLogEventOptions, tx?): Prisma.PrismaPromise<LogEntry>` — `organizationId` present ⇒ organization scope; absent ⇒ user scope with the given `ownerId`

**Notes for the implementer:**

- `LogEventOptions.action` and `.objectType` become the `LogAction` / `LogObjectType` types from `@/lib/schemas/log-entry` rather than the inline unions currently in this file. The inline unions are deleted — two copies of a vocabulary is exactly the drift the registry exists to prevent.
- `ctx.auth.session.impersonatedBy` is read through a narrow structural cast. The `Session` model has the column and the `admin` plugin declares it, but better-auth's `$Infer` chain is not guaranteed to surface it, and a cast here is cheaper than a compile break in a file every router imports.

- [ ] **Step 1: Write the failing test**

Create `src/trpc/init.test.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import * as z from "zod";

import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { authenticatedProcedure, createTrpcRouter, organizationProcedure } from "./init";

const T = {
  org: OrganizationId.create(),
  user: UserId.create(),
  admin: UserId.create(),
};

const db = createMockPrisma();

const testRouter = createTrpcRouter({
  orgWrite: organizationProcedure({ person: ["update"] })
    .input(z.object({ personId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.logEvent({
        action: "Update",
        objectType: "Person",
        objectId: input.personId,
        refs: [{ objectType: "Team", objectId: "team_1" }],
      });
      return { ok: true as const };
    }),

  userWrite: authenticatedProcedure.mutation(async ({ ctx }) => {
    await ctx.logEvent({
      action: "Update",
      objectType: "User",
      objectId: ctx.userId,
      description: "Password changed",
    });
    return { ok: true as const };
  }),
});

function makeCaller(session: { impersonatedBy?: string | null } = {}) {
  return testRouter.createCaller(
    createAuthenticatedMockContext({
      user: { id: T.user, name: "Ada Lovelace", email: "ada@example.com" },
      session,
      permissions: { person: ["update"], organization: ["view"] },
      prisma: db,
    }),
  );
}

describe("organizationProcedure.logEvent", () => {
  it("writes an organization-scoped entry with the acting user and a denormalized label", async () => {
    await makeCaller().orgWrite({ organizationId: T.org, personId: "person_1" });

    const entries = await db.logEntry.findMany({ where: { objectId: "person_1" } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      scope: "organization",
      organizationId: T.org,
      ownerId: null,
      userId: T.user,
      actorLabel: "Ada Lovelace <ada@example.com>",
      impersonatorId: null,
    });
  });

  it("writes the primary ref and any extra refs the call site passed", async () => {
    await makeCaller().orgWrite({ organizationId: T.org, personId: "person_2" });

    const entry = (await db.logEntry.findMany({ where: { objectId: "person_2" } }))[0];
    const objects = await db.logEntryObject.findMany({ where: { logEntryId: entry.id } });

    expect(objects.map((o) => [o.objectId, o.role]).sort()).toEqual(
      [
        ["person_2", "primary"],
        ["team_1", "context"],
      ].sort(),
    );
  });

  it("attributes an impersonated action to the admin driving it, with no call-site change", async () => {
    await makeCaller({ impersonatedBy: T.admin }).orgWrite({
      organizationId: T.org,
      personId: "person_3",
    });

    const entry = (await db.logEntry.findMany({ where: { objectId: "person_3" } }))[0];
    expect(entry.userId).toBe(T.user);
    expect(entry.impersonatorId).toBe(T.admin);
  });
});

describe("authenticatedProcedure.logEvent", () => {
  it("writes a user-scoped entry owned by the calling user", async () => {
    await makeCaller().userWrite();

    const entries = await db.logEntry.findMany({
      where: { scope: "user", objectId: T.user },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      scope: "user",
      ownerId: T.user,
      organizationId: null,
      userId: T.user,
      description: "Password changed",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/trpc/init.test.ts`
Expected: FAIL — `ctx.logEvent` is not a function on `authenticatedProcedure`, and `refs` is not a valid option.

- [ ] **Step 3: Add the actor resolver and rewrite `logEvent` in `src/trpc/init.ts`**

Replace the `@/generated/prisma/client` import and add the new imports at the top of the file:

```ts
import type { LogEntry, Prisma } from "@/generated/prisma/client";
import type { LogAction, LogObjectType } from "@/lib/schemas/log-entry";
import {
  formatActorLabel,
  recordLogEntry,
  type LogActor,
  type LogEntryRef,
} from "@/server/log-entry";
```

`DiffChange` is still imported for the `changes` type on `LogEventOptions`, and `z` is still
used by the `organizationProcedure` input schema. `nanoId16` is not: the Task 1 stopgap was
its only use in this file, and `recordLogEntry` mints the ids now — delete
`import { nanoId16 } from "@/lib/id";`.

Add this helper just above `organizationProcedure`:

```ts
/**
 * Resolve the acting user from a session, centrally.
 *
 * Impersonation is resolved here rather than at call sites: every `logEvent` caller gets
 * `impersonatorId` populated without passing anything, and none of them can forget it.
 * Without this, an action taken while impersonating is attributed to the impersonated
 * user — the log blames the victim.
 *
 * `impersonatedBy` is read structurally: the `Session` model has the column and the
 * `admin` plugin declares it, but better-auth's `$Infer` chain is not guaranteed to
 * surface it, and a cast is cheaper here than a compile break in a file every router
 * imports.
 */
function resolveActor(auth: AuthSession): { actor: LogActor; actorLabel: string } {
  const impersonatedBy = (auth.session as { impersonatedBy?: string | null }).impersonatedBy;

  return {
    actor: {
      userId: UserId.schema.parse(auth.user.id),
      impersonatorId: impersonatedBy ? UserId.schema.parse(impersonatedBy) : undefined,
    },
    actorLabel: formatActorLabel(auth.user.name, auth.user.email),
  };
}
```

- [ ] **Step 4: Replace `LogEventOptions` and add the system-admin variant**

Replace the whole `interface LogEventOptions { … }` block at the bottom of the file (its inline `action` and `objectType` unions are now duplicates of the registry) with:

```ts
export interface LogEventOptions {
  action: LogAction;
  objectType: LogObjectType;
  objectId: string;
  changes?: DiffChange[];
  description?: string;
  /** Extra entities this entry is relevant to. The primary is implicit. */
  refs?: LogEntryRef[];
  /** An existing `LogBatch.id`, when this entry is part of a multi-entry operation. */
  batchId?: string;
}

/**
 * A system administrator acts outside any one organization, so the target log is chosen
 * per call: an `organizationId` puts the entry in that organization's log, and its absence
 * puts it in the subject user's own log, which is what `ownerId` names.
 *
 * Scope is inferred rather than passed. An explicit `scope` alongside an `organizationId`
 * would be redundant in the valid cases and contradictory in the invalid ones.
 */
export type SystemAdminLogEventOptions = LogEventOptions &
  (
    | { organizationId: OrganizationId; ownerId?: never }
    | { organizationId?: never; ownerId: UserId }
  );
```

- [ ] **Step 5: Rewrite `organizationProcedure`'s `logEvent` to delegate**

Replace the `function logEvent(...)` declaration inside `organizationProcedure`'s `.use(...)` with:

```ts
function logEvent(options: LogEventOptions, tx: Prisma.TransactionClient = opts.ctx.prisma) {
  const { actor, actorLabel } = resolveActor(opts.ctx.auth);

  return recordLogEntry(
    {
      scope: "organization",
      organizationId: opts.input.organizationId,
      actor,
      actorLabel,
      ...options,
    },
    tx,
  );
}
```

- [ ] **Step 6: Add `logEvent` to `authenticatedProcedure`**

Extend the `AuthenticatedContext` type:

```ts
export type AuthenticatedContext = Context & {
  auth: AuthSession;
  userId: UserId;
  /**
   * Records an entry in the calling user's own log — account-level events with no
   * organization. Returns the un-awaited `PrismaPromise`, same contract as the
   * organization-scoped helper.
   */
  logEvent: (
    options: LogEventOptions,
    tx?: Prisma.TransactionClient,
  ) => Prisma.PrismaPromise<LogEntry>;
};
```

and build it in the existing `authenticatedProcedure.use(...)`, replacing the `enhancedCtx` construction:

```ts
const userId = UserId.schema.parse(ctx.auth.user.id);

const enhancedCtx: AuthenticatedContext = {
  ...ctx,
  auth: ctx.auth,
  userId,
  logEvent(options: LogEventOptions, tx: Prisma.TransactionClient = ctx.prisma) {
    const { actor, actorLabel } = resolveActor(ctx.auth);

    return recordLogEntry({ scope: "user", ownerId: userId, actor, actorLabel, ...options }, tx);
  },
};
```

Note `ctx.auth` is narrowed to non-null by the guard above it, so `resolveActor(ctx.auth)` type-checks.

- [ ] **Step 7: Add `logEvent` to `systemAdminProcedure`**

Replace the `systemAdminProcedure` definition with:

```ts
/*
 * `Omit<…, "logEvent">` is load-bearing. A plain intersection would merge the inherited
 * `logEvent` signature with this one into an overload set, and a call passing
 * `organizationId` would resolve against the inherited signature and be rejected as an
 * excess property. Replacing the member outright is what makes the system-admin options
 * type actually usable.
 */
export type SystemAdminContext = Omit<AuthenticatedContext, "logEvent"> & {
  logEvent: (
    options: SystemAdminLogEventOptions,
    tx?: Prisma.TransactionClient,
  ) => Prisma.PrismaPromise<LogEntry>;
};

export const systemAdminProcedure = authenticatedProcedure.use(async ({ ctx, next }) => {
  if (ctx.auth.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "System administrator access required.",
    });
  }

  const enhancedCtx: SystemAdminContext = {
    ...ctx,
    logEvent(options: SystemAdminLogEventOptions, tx: Prisma.TransactionClient = ctx.prisma) {
      const { actor, actorLabel } = resolveActor(ctx.auth);
      const { organizationId, ownerId, ...rest } = options;

      return recordLogEntry(
        organizationId
          ? { scope: "organization", organizationId, actor, actorLabel, ...rest }
          : { scope: "user", ownerId, actor, actorLabel, ...rest },
        tx,
      );
    },
  };

  return next({ ctx: enhancedCtx });
});
```

- [ ] **Step 8: Let the mock context set `impersonatedBy`**

In `src/test/trpc-helpers.ts`, change the override type:

```ts
    session?: Partial<AuthSession["session"]> & { impersonatedBy?: string | null };
```

and change the session construction so the spread can add a field the inferred type may not carry — the `satisfies` moves onto the inner literal, which still type-checks the defaults:

```ts
            session: {
                ...({
                    id: nanoId16(),
                    createdAt: mockDate,
                    updatedAt: mockDate,
                    expiresAt: addDays(nowDate, 1),
                    userId: user.id,
                    token: "mock-session-token",
                } satisfies AuthSession["session"]),
                ...session,
            },
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run src/trpc/init.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 10: Update the transactional-writes pattern doc**

In `docs/patterns/transactional-writes.md`, replace `OrganizationLogEntry` with `LogEntry` on line 4 and in the signature on line 25. Then add this paragraph immediately after the signature block:

```markdown
`logEvent` also accepts `refs` — extra entities the entry should surface on, beyond the
`objectType`/`objectId` primary. `recordLogEntry` writes the primary ref itself and drops
any `refs` entry that duplicates it, so passing the primary again is a no-op rather than a
duplicate row. Entries are ordered by `sequence`, not `timestamp`: in Postgres
`CURRENT_TIMESTAMP` is transaction _start_ time, so every entry written by one
`$transaction([...])` — which is exactly this pattern — shares a byte-identical timestamp.
```

- [ ] **Step 11: Type check and run the full suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: both clean. The `system-admin-router.ts` `ctx.prisma.logEntry.create` calls from Task 1 still compile — they are converted in Task 5.

- [ ] **Step 12: Commit**

```bash
git add src/trpc/init.ts src/trpc/init.test.ts src/test/trpc-helpers.ts docs/patterns/transactional-writes.md
git commit -m "feat(log): route every tRPC logEvent through recordLogEntry

organizationProcedure.logEvent keeps its signature and delegates. Two new
siblings: authenticatedProcedure.logEvent writes to the calling user's own log,
and systemAdminProcedure.logEvent picks the target log from an optional
organizationId — present means that organization's log, absent means the
subject user's own, which ownerId names.

Impersonation is resolved centrally, once per entry point, from
session.impersonatedBy. No call site passes it and none can forget it. Until
now every logEvent wrote the session user, which under impersonation is the
subject rather than the admin driving the session — the log blamed the victim.

LogEventOptions gains refs and batchId, and its inline action/objectType unions
are replaced by the registry's, so the vocabulary has one definition.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Convert `system-admin-router.ts`

The five hand-rolled `logEntry.create` calls become `ctx.logEvent`, the two "no audit home yet" sites get real entries, and the log `deleteMany` goes.

**Files:**

- Modify: `src/trpc/routers/system-admin-router.ts`
- Test: `src/trpc/routers/system-admin-router.test.ts`

**Interfaces:**

- Consumes: `ctx.logEvent(options: SystemAdminLogEventOptions, tx?)` from Task 4.

**Notes for the implementer:**

- There is **no `banUser` or `impersonate` tRPC procedure.** Those go through better-auth's `admin` plugin from the client and are covered by Task 7's hooks, not here.
- `deleteUser`'s own entry has `ownerId` = the user being deleted, so it cascades away with them. That is consistent with the erasure policy and means the record of a deletion does not outlive the deletion. Write it anyway — it is correct for the window in which it exists, and the alternative (a system-scoped entry naming a deleted user) contradicts the policy.

- [ ] **Step 1: Write the failing test**

Append to `src/trpc/routers/system-admin-router.test.ts` (keep the file's existing fixture conventions and `describe` structure; these are new top-level `describe` blocks):

```ts
describe("systemAdminRouter — audit entries", () => {
  it("records an organization-scoped entry when adding a member", async () => {
    const db = createMockPrisma();
    const orgId = OrganizationId.create();
    const adminId = UserId.create();
    const memberId = UserId.create();

    await db.organization.create({
      data: { id: orgId, name: "Org", slug: `org-${nanoId16()}`, createdAt: new Date() },
    });
    await db.user.create({
      data: { id: adminId, name: "Dana Okafor", email: "dana@example.com", role: "admin" },
    });
    await db.user.create({
      data: { id: memberId, name: "Kim Park", email: "kim@example.com" },
    });

    const caller = systemAdminRouter.createCaller(
      createAuthenticatedMockContext({
        user: {
          id: adminId,
          name: "Dana Okafor",
          email: "dana@example.com",
          role: "admin",
        },
        prisma: db,
      }),
    );

    await caller.addOrganizationMember({
      organizationId: orgId,
      userId: memberId,
      role: "member",
    });

    const entries = await db.logEntry.findMany({
      where: { objectType: "OrganizationMembership" },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      scope: "organization",
      organizationId: orgId,
      ownerId: null,
      userId: adminId,
      action: "Create",
    });
    expect(entries[0].actorLabel).toBe("Dana Okafor <dana@example.com>");
  });

  it("records a user-scoped entry against the subject when changing a global role", async () => {
    const db = createMockPrisma();
    const adminId = UserId.create();
    const subjectId = UserId.create();

    await db.user.create({
      data: { id: adminId, name: "Dana Okafor", email: "dana@example.com", role: "admin" },
    });
    await db.user.create({
      data: { id: subjectId, name: "Kim Park", email: "kim@example.com", role: "user" },
    });

    const caller = systemAdminRouter.createCaller(
      createAuthenticatedMockContext({
        user: {
          id: adminId,
          name: "Dana Okafor",
          email: "dana@example.com",
          role: "admin",
        },
        prisma: db,
      }),
    );

    await caller.setUserRole({ userId: subjectId, role: "admin" });

    const entries = await db.logEntry.findMany({ where: { objectType: "User" } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      scope: "user",
      ownerId: subjectId,
      organizationId: null,
      userId: adminId,
      action: "Update",
      objectId: subjectId,
    });
    expect(entries[0].changes).toContainEqual({
      type: "obj_mod",
      path: ["role"],
      prev: "user",
      curr: "admin",
    });
  });

  it("no longer deletes a deleted user's entries elsewhere — the FK policy keeps them", async () => {
    const db = createMockPrisma();
    const orgId = OrganizationId.create();
    const adminId = UserId.create();
    const subjectId = UserId.create();

    await db.organization.create({
      data: { id: orgId, name: "Org", slug: `org-${nanoId16()}`, createdAt: new Date() },
    });
    await db.user.create({
      data: { id: adminId, name: "Dana Okafor", email: "dana@example.com", role: "admin" },
    });
    await db.user.create({
      data: { id: subjectId, name: "Kim Park", email: "kim@example.com" },
    });

    // An action the subject took in an organization, which must survive their deletion.
    await db.logEntry.create({
      data: {
        id: nanoId16(),
        scope: "organization",
        organizationId: orgId,
        userId: subjectId,
        actorLabel: "Kim Park <kim@example.com>",
        action: "Update",
        objectType: "Person",
        objectId: "person_1",
        changes: [],
      },
    });

    const caller = systemAdminRouter.createCaller(
      createAuthenticatedMockContext({
        user: {
          id: adminId,
          name: "Dana Okafor",
          email: "dana@example.com",
          role: "admin",
        },
        prisma: db,
      }),
    );

    await caller.deleteUser({ userId: subjectId });

    const survivors = await db.logEntry.findMany({ where: { objectId: "person_1" } });
    expect(survivors).toHaveLength(1);
    expect(survivors[0].userId).toBeNull();
    expect(survivors[0].actorLabel).toBe("Kim Park <kim@example.com>");
  });
});
```

This file already imports everything these tests need — `nanoId16`, `OrganizationId`,
`UserId`, `createMockPrisma`, `createAuthenticatedMockContext`, and `systemAdminRouter`. No
import changes.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/trpc/routers/system-admin-router.test.ts`
Expected: FAIL — `setUserRole` writes no entry, and `deleteUser` still deletes the survivor.

- [ ] **Step 3: Convert the five hand-rolled creates**

In each of `addOrganizationMember`, `createOrganization`, `removeOrganizationMember`, `setOrganizationMemberRole`, and `updateOrganizationSettings`, replace the `ctx.prisma.logEntry.create({ data: { … } })` call with the equivalent `ctx.logEvent`. The pattern, using `addOrganizationMember` as the worked example:

```ts
                ctx.logEvent({
                    organizationId: input.organizationId,
                    action: "Create",
                    objectType: "OrganizationMembership",
                    objectId: id,
                    changes: [],
                    description: `Added user ${input.userId} as ${input.role}`,
                }),
```

`id`, `userId`, `scope`, `actorLabel`, and the primary ref are all supplied by `recordLogEntry`. Drop them from every call site. `createOrganization`'s entry keeps `objectType: "Organization"`, `objectId: organizationId`; `removeOrganizationMember`'s keeps `action: "Delete"`, `objectType: "OrganizationMembership"`, `objectId: membership.id`; `setOrganizationMemberRole`'s keeps `action: "Update"` with the same description; `updateOrganizationSettings`'s callback becomes:

```ts
                (changes) =>
                    ctx.logEvent({
                        organizationId: input.organizationId,
                        action: "Update",
                        objectType: "OrganizationSettings",
                        objectId: input.organizationId,
                        changes,
                        description: "Updated settings from system administration",
                    }),
```

The now-unused `const userId = ctx.auth.user.id;` in `updateOrganizationSettings` should be removed if nothing else in that procedure uses it.

Delete the three stale comments that say `systemAdminProcedure` has no `ctx.logEvent` (they sit above `addOrganizationMember`, `createOrganization`, and `updateOrganizationSettings`) — it does now.

- [ ] **Step 4: Give `setUserRole` a real entry**

`setUserRole` already loads the subject as `target` and normalizes its role into
`currentRole`, and it returns early when there is no actual transition — so by the time
either branch runs, `currentRole !== input.role` is guaranteed and both values are in hand.

Replace the demotion branch's `$transaction` array and the plain-update tail with:

```ts
if (input.role === "user") {
  const otherAdmins = await ctx.prisma.user.count({
    where: { role: "admin", id: { not: input.userId } },
  });
  if (otherAdmins === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot demote the last system administrator.",
    });
  }

  const [updated] = await ctx.prisma.$transaction([
    ctx.prisma.user.update({
      where: { id: input.userId },
      data: { role: input.role },
    }),
    ctx.prisma.session.deleteMany({ where: { userId: input.userId } }),
    ctx.logEvent({
      ownerId: input.userId,
      action: "Update",
      objectType: "User",
      objectId: input.userId,
      changes: diffObject({ role: currentRole }, { role: input.role }),
      description: `Changed global role from ${currentRole} to ${input.role}`,
    }),
  ]);

  return { id: updated.id, role: updated.role };
}

const [updated] = await ctx.prisma.$transaction([
  ctx.prisma.user.update({
    where: { id: input.userId },
    data: { role: input.role },
  }),
  ctx.logEvent({
    ownerId: input.userId,
    action: "Update",
    objectType: "User",
    objectId: input.userId,
    changes: diffObject({ role: currentRole }, { role: input.role }),
    description: `Changed global role from ${currentRole} to ${input.role}`,
  }),
]);

return { id: updated.id, role: updated.role };
```

Note the promotion path changes from a bare `await ctx.prisma.user.update(...)` to a
`$transaction([...])` so the update and its log entry commit together — the pairing this
codebase requires. Destructure `[updated]` accordingly.

Add `import { diffObject } from "@/lib/diff";` if the file does not already import it.

Replace the stale `NOTE:` comment above `setUserRole` (the one saying global role changes
are not yet audited and that `organizationLogEntry` requires an `organizationId`) with a
line saying the entry is user-scoped and owned by the subject, so it cascades away if the
user is later deleted.

- [ ] **Step 5: Give `deleteUser` an entry and remove the log `deleteMany`**

In `deleteUser`'s `$transaction([...])` array:

1. **Delete** the line `ctx.prisma.organizationLogEntry.deleteMany({ where: { userId: input.userId } }),` — Task 1 renamed it to `ctx.prisma.logEntry.deleteMany(...)`. It is now wrong as well as redundant: `userId` is `onDelete: SetNull`, so those entries are meant to survive, anonymised.
2. **Insert**, immediately before the final `ctx.prisma.user.delete(...)`:

```ts
                ctx.logEvent({
                    ownerId: input.userId,
                    action: "Delete",
                    objectType: "User",
                    objectId: input.userId,
                    changes: [],
                    description: "Account deleted by a system administrator",
                }),
```

Update the comment above `deleteUser` that explains the explicit dependent-row clears: note that the log entries are deliberately _not_ cleared, because `LogEntry.userId` is `SetNull` and `LogEntry.ownerId` is `Cascade`, so the FKs already implement the policy — the user's own log goes, their actions elsewhere stay and are anonymised.

Replace the stale comment on line 612 about `organizationLogEntry` requiring an `organizationId`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/trpc/routers/system-admin-router.test.ts`
Expected: PASS, including the three new tests.

- [ ] **Step 7: Type check and run the full suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/trpc/routers/system-admin-router.ts src/trpc/routers/system-admin-router.test.ts
git commit -m "feat(log): give system-admin actions a real audit home

The five hand-rolled log creates become ctx.logEvent, so they pick up scope,
actorLabel, impersonation and the primary ref from one place. Some of them were
borrowing an unrelated organization's id purely to satisfy a required FK.

deleteUser and setUserRole get real entries — user-scoped, owned by the subject,
actor the admin. These are the sites whose comments said global user-level
actions had no audit log home yet (#78).

Remove deleteUser's log deleteMany. LogEntry.userId is SetNull and ownerId is
Cascade, so the FKs already implement the erasure policy: the user's own log
goes with them, their actions elsewhere survive anonymised. The explicit delete
now destroys entries the policy intends to keep.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: better-auth mapping functions — `auth-log-hooks.ts`

Pure functions: a mutation row plus what the write touched → the entries to record. All the logic lives here so it can be tested; Task 7's shell in `auth.ts` stays a thin, untested wire.

**Files:**

- Create: `src/server/auth-log-hooks.ts`
- Test: `src/server/auth-log-hooks.test.ts`

**Interfaces:**

- Consumes: `RecordLogEntryInput`, `formatActorLabel` from `@/server/log-entry`; `UserId` from `@/lib/schemas/user`.
- Produces:
  ```ts
  export interface HookUserRow {
    id: string;
    name: string;
    email: string;
    banned?: boolean | null;
    banReason?: string | null;
    banExpires?: Date | null;
  }
  export interface HookAccountRow {
    id: string;
    userId: string;
    providerId: string;
  }
  export interface HookSessionRow {
    id: string;
    userId: string;
    impersonatedBy?: string | null;
  }
  export interface HookActor {
    userId: string;
    name: string;
    email: string;
  }
  export interface UserUpdateSnapshot {
    touched: string[];
    previousEmail?: string;
  }
  export function mapUserUpdate(
    user: HookUserRow,
    snapshot: UserUpdateSnapshot | undefined,
    actor: HookActor | null,
  ): RecordLogEntryInput[];
  export function mapPasswordChange(
    account: HookAccountRow,
    passwordTouched: boolean,
  ): RecordLogEntryInput | null;
  export function mapAccountLink(
    account: HookAccountRow,
    action: "Create" | "Delete",
    actor: HookActor | null,
  ): RecordLogEntryInput | null;
  export function mapImpersonation(
    session: HookSessionRow,
    phase: "start" | "end",
  ): RecordLogEntryInput | null;
  ```

**Notes for the implementer:**

- These functions never touch the database and never throw on unexpected input — they return `null` or `[]`. The hook shell in `auth.ts` swallows errors anyway, but a mapping function that returns nothing is far easier to reason about than one that throws into a swallowed catch.
- Every entry is `scope: "user"`. The `ownerId` is always the **affected** user; the `actor` is whoever did it, which for an admin ban is a different person.
- The credential provider's `providerId` is the literal string `"credential"`. Anything else is a social provider.

- [ ] **Step 1: Write the failing test**

Create `src/server/auth-log-hooks.test.ts`:

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { UserId } from "@/lib/schemas/user";

import {
  mapAccountLink,
  mapImpersonation,
  mapPasswordChange,
  mapUserUpdate,
  type HookActor,
  type HookUserRow,
} from "./auth-log-hooks";

const subjectId = UserId.create();
const adminId = UserId.create();

const subject: HookUserRow = {
  id: subjectId,
  name: "Kim Park",
  email: "kim@example.com",
};

const admin: HookActor = {
  userId: adminId,
  name: "Dana Okafor",
  email: "dana@example.com",
};

describe("mapUserUpdate — email", () => {
  it("records the old and new address when the payload touched email", () => {
    const [entry] = mapUserUpdate(
      { ...subject, email: "kim.park@example.com" },
      { touched: ["email"], previousEmail: "kim@example.com" },
      null,
    );

    expect(entry).toMatchObject({
      scope: "user",
      ownerId: subjectId,
      action: "Update",
      objectType: "User",
      objectId: subjectId,
      description: "Email address changed",
    });
    expect(entry.changes).toEqual([
      {
        type: "obj_mod",
        path: ["email"],
        prev: "kim@example.com",
        curr: "kim.park@example.com",
      },
    ]);
  });

  it("attributes a self-service email change to the user themselves", () => {
    const [entry] = mapUserUpdate(
      { ...subject, email: "kim.park@example.com" },
      { touched: ["email"], previousEmail: "kim@example.com" },
      null,
    );
    expect(entry.actor).toEqual({ userId: subjectId });
    expect(entry.actorLabel).toBe("Kim Park <kim@example.com>");
  });

  it("records nothing when the payload touched email but the address is unchanged", () => {
    expect(
      mapUserUpdate(subject, { touched: ["email"], previousEmail: "kim@example.com" }, null),
    ).toEqual([]);
  });

  it("records nothing when the payload never touched email", () => {
    expect(mapUserUpdate(subject, { touched: ["name"] }, null)).toEqual([]);
  });

  it("records nothing when there is no snapshot at all", () => {
    expect(mapUserUpdate(subject, undefined, null)).toEqual([]);
  });
});

describe("mapUserUpdate — ban", () => {
  it("records a Ban owned by the subject and acted by the admin", () => {
    const [entry] = mapUserUpdate(
      { ...subject, banned: true, banReason: "Spam", banExpires: null },
      { touched: ["banned", "banReason"] },
      admin,
    );

    expect(entry).toMatchObject({
      scope: "user",
      ownerId: subjectId,
      action: "Ban",
      objectType: "User",
      objectId: subjectId,
    });
    expect(entry.actor).toEqual({ userId: adminId });
    expect(entry.actorLabel).toBe("Dana Okafor <dana@example.com>");
    expect(entry.changes).toContainEqual({
      type: "obj_add",
      path: ["banReason"],
      curr: "Spam",
    });
  });

  it("records an Unban when the new value is false", () => {
    const [entry] = mapUserUpdate({ ...subject, banned: false }, { touched: ["banned"] }, admin);
    expect(entry.action).toBe("Unban");
  });

  it("falls back to the affected user when no actor could be resolved", () => {
    const [entry] = mapUserUpdate({ ...subject, banned: true }, { touched: ["banned"] }, null);
    expect(entry.actor).toEqual({ userId: subjectId });
  });

  it("records both an email change and a ban when one update touched both", () => {
    const entries = mapUserUpdate(
      { ...subject, email: "new@example.com", banned: true },
      { touched: ["email", "banned"], previousEmail: "kim@example.com" },
      admin,
    );
    expect(entries.map((e) => e.action)).toEqual(["Update", "Ban"]);
  });
});

describe("mapPasswordChange", () => {
  it("records a masked marker carrying no password value", () => {
    const entry = mapPasswordChange(
      { id: "acc_1", userId: subjectId, providerId: "credential" },
      true,
    );

    expect(entry).toMatchObject({
      scope: "user",
      ownerId: subjectId,
      action: "Update",
      objectType: "User",
      objectId: subjectId,
      description: "Password changed",
    });
    expect(entry!.changes).toEqual([{ type: "obj_mask", path: ["password"] }]);
    expect(JSON.stringify(entry)).not.toContain("hunter2");
  });

  it("records nothing when the payload did not touch the password", () => {
    expect(
      mapPasswordChange({ id: "acc_1", userId: subjectId, providerId: "credential" }, false),
    ).toBeNull();
  });

  it("records nothing for a non-credential provider", () => {
    expect(
      mapPasswordChange({ id: "acc_1", userId: subjectId, providerId: "github" }, true),
    ).toBeNull();
  });
});

describe("mapAccountLink", () => {
  it("records a social account link against the account, with the user as context", () => {
    const entry = mapAccountLink(
      { id: "acc_1", userId: subjectId, providerId: "github" },
      "Create",
      null,
    );

    expect(entry).toMatchObject({
      scope: "user",
      ownerId: subjectId,
      action: "Create",
      objectType: "Account",
      objectId: "acc_1",
    });
    expect(entry!.changes).toContainEqual({
      type: "obj_add",
      path: ["providerId"],
      curr: "github",
    });
    expect(entry!.refs).toEqual([{ objectType: "User", objectId: subjectId, role: "context" }]);
  });

  it("records an unlink as a Delete", () => {
    const entry = mapAccountLink(
      { id: "acc_1", userId: subjectId, providerId: "google" },
      "Delete",
      null,
    );
    expect(entry!.action).toBe("Delete");
  });

  it("ignores the credential provider — that is a password, not a linked account", () => {
    expect(
      mapAccountLink({ id: "acc_1", userId: subjectId, providerId: "credential" }, "Create", null),
    ).toBeNull();
  });
});

describe("mapImpersonation", () => {
  it("attributes the start to the impersonating admin, owned by the subject", () => {
    const entry = mapImpersonation(
      { id: "sess_1", userId: subjectId, impersonatedBy: adminId },
      "start",
    );

    expect(entry).toMatchObject({
      scope: "user",
      ownerId: subjectId,
      action: "Impersonate",
      objectType: "User",
      objectId: subjectId,
    });
    expect(entry!.actor).toEqual({ userId: adminId });
    expect(entry!.refs).toEqual([{ objectType: "Session", objectId: "sess_1", role: "context" }]);
    expect(entry!.description).toContain("Started");
  });

  it("records the end when the impersonated session is deleted", () => {
    const entry = mapImpersonation(
      { id: "sess_1", userId: subjectId, impersonatedBy: adminId },
      "end",
    );
    expect(entry!.action).toBe("Impersonate");
    expect(entry!.description).toContain("Stopped");
  });

  it("ignores an ordinary session with no impersonator", () => {
    expect(mapImpersonation({ id: "sess_1", userId: subjectId }, "start")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/server/auth-log-hooks.test.ts`
Expected: FAIL — cannot resolve `./auth-log-hooks`.

- [ ] **Step 3: Write `src/server/auth-log-hooks.ts`**

```ts
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Pure mapping functions for the better-auth `databaseHooks`.
 *
 * All the logic lives here, with no database access and no better-auth imports, so it is
 * unit-testable from jsdom. The shell in `auth.ts` — which cannot be tested there — stays
 * a thin wire: snapshot in `before`, map and record in `after`.
 *
 * Constraints these functions are shaped by, verified against better-auth 1.7.3:
 *
 * - `update.after` receives only the RESULTING row, and `update.before` only the update
 *   PAYLOAD. Neither carries the previous value. So "which fields did this write touch"
 *   comes from the payload's keys, passed in as `UserUpdateSnapshot.touched`, and the one
 *   previous value we need (the old email) is read in `before` and passed as
 *   `previousEmail`.
 * - Ban direction needs no previous value: it is a function of the new `banned` value.
 * - These functions never throw. The shell swallows errors regardless, and a function
 *   that returns nothing is easier to reason about than one throwing into a swallowed
 *   catch.
 */

import type { DiffChange } from "@/lib/diff";
import { UserId } from "@/lib/schemas/user";

import { formatActorLabel, type RecordLogEntryInput } from "./log-entry";

/** better-auth's credential provider id. Anything else is a social provider. */
const CREDENTIAL_PROVIDER = "credential";

export interface HookUserRow {
  id: string;
  name: string;
  email: string;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
}

export interface HookAccountRow {
  id: string;
  userId: string;
  providerId: string;
}

export interface HookSessionRow {
  id: string;
  userId: string;
  impersonatedBy?: string | null;
}

/** The user driving the request, resolved from better-auth's endpoint context. */
export interface HookActor {
  userId: string;
  name: string;
  email: string;
}

/**
 * What the `before` hook observed: which keys the update payload carried, plus the one
 * previous value the `after` hook cannot recover on its own.
 */
export interface UserUpdateSnapshot {
  touched: string[];
  previousEmail?: string;
}

/**
 * Entries for a `user.update`.
 *
 * Returns zero, one, or two entries — a single update can touch both the email and the
 * ban state, and those are two independently meaningful events.
 */
export function mapUserUpdate(
  user: HookUserRow,
  snapshot: UserUpdateSnapshot | undefined,
  actor: HookActor | null,
): RecordLogEntryInput[] {
  const touched = snapshot?.touched ?? [];
  const entries: RecordLogEntryInput[] = [];
  const ownerId = UserId.schema.parse(user.id);

  if (
    touched.includes("email") &&
    snapshot?.previousEmail !== undefined &&
    snapshot.previousEmail !== user.email
  ) {
    // A self-service change: the subject is the actor.
    entries.push({
      scope: "user",
      ownerId,
      actor: { userId: ownerId },
      // Labelled with the address they had when they acted, not the new one.
      actorLabel: formatActorLabel(user.name, snapshot.previousEmail),
      action: "Update",
      objectType: "User",
      objectId: user.id,
      changes: [
        {
          type: "obj_mod",
          path: ["email"],
          prev: snapshot.previousEmail,
          curr: user.email,
        },
      ],
      description: "Email address changed",
    });
  }

  if (touched.includes("banned")) {
    const banned = user.banned === true;
    // An admin ban has a resolvable actor; a self-service path may not. Falling back
    // to the affected user keeps the entry attributable — the shell warns separately,
    // because an unresolved actor is a diagnostic about our code, not a fact about
    // the event.
    const resolved = actor ?? { userId: user.id, name: user.name, email: user.email };

    const changes: DiffChange[] = [];
    if (banned && user.banReason != null) {
      changes.push({ type: "obj_add", path: ["banReason"], curr: user.banReason });
    }
    if (banned && user.banExpires != null) {
      changes.push({
        type: "obj_add",
        path: ["banExpires"],
        curr: user.banExpires.toISOString(),
      });
    }

    entries.push({
      scope: "user",
      ownerId,
      actor: { userId: UserId.schema.parse(resolved.userId) },
      actorLabel: formatActorLabel(resolved.name, resolved.email),
      action: banned ? "Ban" : "Unban",
      objectType: "User",
      objectId: user.id,
      changes,
    });
  }

  return entries;
}

/**
 * A password change.
 *
 * The values are never stored: the change is a bare `obj_mask` marker naming the field,
 * with no old or new value. `obj_mask` is the same variant the D4H access-token redaction
 * uses.
 */
export function mapPasswordChange(
  account: HookAccountRow,
  passwordTouched: boolean,
): RecordLogEntryInput | null {
  if (!passwordTouched) return null;
  if (account.providerId !== CREDENTIAL_PROVIDER) return null;

  const ownerId = UserId.schema.parse(account.userId);

  return {
    scope: "user",
    ownerId,
    actor: { userId: ownerId },
    action: "Update",
    objectType: "User",
    objectId: account.userId,
    changes: [{ type: "obj_mask", path: ["password"] }],
    description: "Password changed",
  };
}

/** A social account being linked or unlinked. The credential row is a password, not a link. */
export function mapAccountLink(
  account: HookAccountRow,
  action: "Create" | "Delete",
  actor: HookActor | null,
): RecordLogEntryInput | null {
  if (account.providerId === CREDENTIAL_PROVIDER) return null;

  const ownerId = UserId.schema.parse(account.userId);
  const resolved = actor?.userId ? UserId.schema.parse(actor.userId) : ownerId;

  return {
    scope: "user",
    ownerId,
    actor: { userId: resolved },
    actorLabel: actor ? formatActorLabel(actor.name, actor.email) : undefined,
    action,
    objectType: "Account",
    objectId: account.id,
    changes: [{ type: "obj_add", path: ["providerId"], curr: account.providerId }],
    description:
      action === "Create"
        ? `Linked ${account.providerId} account`
        : `Unlinked ${account.providerId} account`,
    refs: [{ objectType: "User", objectId: account.userId, role: "context" }],
  };
}

/**
 * The start or end of an impersonated session.
 *
 * Both ends are observable: better-auth's `stopImpersonating` deletes the session through
 * the hooked path, so `session.delete.after` carries `impersonatedBy`. Sign-out and
 * session revocation of an impersonated session fire the same hook, and those are genuine
 * ends too.
 *
 * The entry is owned by the impersonated user and acted by the admin — the inverse of the
 * usual arrangement, and the point of logging it.
 */
export function mapImpersonation(
  session: HookSessionRow,
  phase: "start" | "end",
): RecordLogEntryInput | null {
  if (!session.impersonatedBy) return null;

  return {
    scope: "user",
    ownerId: UserId.schema.parse(session.userId),
    actor: { userId: UserId.schema.parse(session.impersonatedBy) },
    action: "Impersonate",
    objectType: "User",
    objectId: session.userId,
    changes: [],
    description:
      phase === "start"
        ? `Started impersonating user ${session.userId}`
        : `Stopped impersonating user ${session.userId}`,
    refs: [{ objectType: "Session", objectId: session.id, role: "context" }],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/auth-log-hooks.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Type check and run the full suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/server/auth-log-hooks.ts src/server/auth-log-hooks.test.ts
git commit -m "feat(log): map better-auth mutations to log entries

Pure functions with no database access and no better-auth imports, so the
account-security logic is unit-testable — the databaseHooks shell cannot run
under jsdom, so everything worth testing lives here instead.

Shaped by two verified better-auth constraints: update.after carries only the
resulting row and update.before only the payload, so neither knows a previous
value. Which fields a write touched comes from the payload's keys; the one
previous value needed (the old email) is read in before and passed through. Ban
direction needs no previous value — it is a function of the new banned value.

Password changes record an obj_mask marker with no values, the same variant the
D4H access-token redaction uses.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Wire the `databaseHooks` shell in `auth.ts`

> **POSTPONED — DO NOT IMPLEMENT THIS TASK AS WRITTEN.** It was implemented (53fc88a),
> reviewed, and reverted (5dba042). The step text below is preserved for its reasoning, but it
> encodes three defects that a fresh run would faithfully reproduce, because all three
> typecheck and none is covered by any test:
>
> 1. **Step 1's pre-value lookup cannot work.** `update.before` receives the update PAYLOAD,
>    which carries no `id` — the id lives in the `where` clause, never passed to the hook. So
>    `String(user.id)` is `"undefined"`, the `findUnique` always misses, `previousEmail` is
>    never set, and email-change entries never fire. The old email is already captured
>    correctly elsewhere in `auth.ts`, via `emailVerification.beforeEmailVerification` into
>    `previousEmailByRequest`.
> 2. **Step 3's `account.update.after` assumes a row.** `updatePassword` routes through
>    `updateManyWithHooks`, and the Prisma adapter's `updateMany` returns `result.count` — a
>    number. `/change-password` and `/set-password` pass a real Account row; `/reset-password`,
>    admin set-user-password, and the emailOTP reset pass a count, so `mapPasswordChange`
>    returns `null` and every reset path goes unlogged.
> 3. **Step 1's one-slot-per-request WeakMap stash is unsound.** `after` hooks are deferred
>    until after commit, so two same-model writes in one request run
>    `before(A) → before(B) → commit → after(A) → after(B)`: B overwrites A's snapshot, A's
>    `after` consumes and deletes it, and B's `after` gets nothing. Both entries are lost. A
>    FIFO per context fixes it. Latent — no current flow triggers it.
>
> The deeper reason for the postponement is that every one of those facts is a better-auth
> _internal_ (`with-hooks.mjs`, `internal-adapter.mjs`, the Prisma adapter's return types), not
> public API, and this project is not committed to staying on 1.7.x. Re-verify all three
> against the version in use before re-wiring.
>
> Task 6's mapping layer (`src/server/auth-log-hooks.ts`) and its tests remain in the tree,
> dormant, carrying the same notes in their header. The rest of the capture layer does not
> depend on this task.

A thin, deliberately untested wire: snapshot in `before`, map and record in `after`, catch everything.

**Files:**

- Modify: `src/server/auth.ts`

**Interfaces:**

- Consumes: `mapUserUpdate`, `mapPasswordChange`, `mapAccountLink`, `mapImpersonation`, `HookActor`, `UserUpdateSnapshot` from `./auth-log-hooks`; `recordLogEntry` from `./log-entry`; the module `prisma` from `./prisma` (already imported by this file).

**Notes for the implementer:**

- `auth.ts` is genuinely server-only and is never imported by a test, so importing `prisma` here is correct — unlike in `log-entry.ts`.
- The `WeakMap` stash keyed by the endpoint context mirrors the `previousEmailByRequest` pattern already in this file, for the same reason: it is request-scoped and garbage-collected with the request, and nothing is bolted onto better-auth's own object.
- **Every hook body must be wrapped in `try/catch`.** `after` hooks run _after_ the write commits, and better-auth rethrows — so an uncaught error returns a 500 for an operation that already succeeded. This is the one place the fail-open decision is enforced.

- [ ] **Step 1: Add the imports and the stash**

At the top of `src/server/auth.ts`, alongside the existing imports:

```ts
import {
  mapAccountLink,
  mapImpersonation,
  mapPasswordChange,
  mapUserUpdate,
  type HookActor,
  type UserUpdateSnapshot,
} from "./auth-log-hooks";
import { recordLogEntry, type RecordLogEntryInput } from "./log-entry";
```

Immediately below the existing `previousEmailByRequest` declaration, add:

```ts
/**
 * Carries what a `*.before` database hook observed into its matching `*.after` hook.
 *
 * better-auth's hooks cannot supply a previous value: `update.before` receives only the
 * update payload and `update.after` only the resulting row. So `before` records which keys
 * the payload carried — and, for an email change, reads the address the row still holds —
 * and `after` maps that into an entry.
 *
 * Recording in `after` rather than `before` means a write that fails leaves no entry.
 * Keyed by the endpoint context object, so it is request-scoped and collected with the
 * request; nothing leaks if `after` never runs. Same pattern as
 * `previousEmailByRequest` above.
 */
const userUpdateSnapshotByContext = new WeakMap<object, UserUpdateSnapshot>();
const passwordTouchedByContext = new WeakMap<object, boolean>();
```

- [ ] **Step 2: Add the helper functions**

Below the two `WeakMap`s:

```ts
/**
 * The user driving the request, from better-auth's endpoint context.
 *
 * `GenericEndpointContext` is `EndpointContext & { context: AuthContext }`, and the admin
 * middleware populates `session` on the endpoints that matter (ban, unban, set-role).
 * Read structurally so a better-auth type change cannot break the build here.
 */
function resolveHookActor(context: unknown): HookActor | null {
  const session = (
    context as { context?: { session?: { user?: { id?: string; name?: string; email?: string } } } }
  )?.context?.session;

  const user = session?.user;
  if (!user?.id || !user.name || !user.email) return null;

  return { userId: user.id, name: user.name, email: user.email };
}

/**
 * Record entries produced by a hook, swallowing every failure.
 *
 * `databaseHooks.*.after` runs AFTER the underlying write commits, and better-auth
 * rethrows what the hook throws (it never passes its core's `onAfterCommitHookError`
 * handler). So a throwing hook does not roll back the password change — it returns a 500
 * for an operation that already succeeded. Fail-closed is not available on this path, so
 * we fail open and accept audit gaps, which are at least visible in the logs.
 */
async function recordFromHook(entries: (RecordLogEntryInput | null)[]): Promise<void> {
  for (const entry of entries) {
    if (!entry) continue;
    try {
      await recordLogEntry(entry, prisma);
    } catch (error) {
      console.error("[audit] failed to record log entry from an auth hook", error);
    }
  }
}
```

- [ ] **Step 3: Add the `databaseHooks` block**

Insert this as a top-level key of the `betterAuth({ … })` options object, immediately after the `database:` key so it reads near the adapter it hooks:

```ts
    /*
     * Account-security events reach us here rather than through tRPC, because they run
     * through better-auth's own endpoints. All the logic lives in `auth-log-hooks.ts` —
     * this is a thin wire, and is deliberately untested: it cannot run under jsdom.
     */
    databaseHooks: {
        user: {
            update: {
                async before(user, context) {
                    try {
                        if (!context) return;
                        const touched = Object.keys(user);
                        const snapshot: UserUpdateSnapshot = { touched };

                        if (touched.includes("email")) {
                            // The only previous value the `after` hook cannot recover.
                            // The row still holds the pre-update address at this point.
                            const existing = await prisma.user.findUnique({
                                where: { id: String(user.id) },
                                select: { email: true },
                            });
                            if (existing) snapshot.previousEmail = existing.email;
                        }

                        userUpdateSnapshotByContext.set(context, snapshot);
                    } catch (error) {
                        console.error("[audit] user.update.before snapshot failed", error);
                    }
                },
                async after(user, context) {
                    try {
                        const snapshot = context
                            ? userUpdateSnapshotByContext.get(context)
                            : undefined;
                        if (context) userUpdateSnapshotByContext.delete(context);

                        const actor = resolveHookActor(context);
                        if (!actor && snapshot?.touched.includes("banned")) {
                            console.warn(
                                "[audit] no actor resolvable for a ban change; attributing to the affected user",
                            );
                        }

                        await recordFromHook(mapUserUpdate(user, snapshot, actor));
                    } catch (error) {
                        console.error("[audit] user.update.after failed", error);
                    }
                },
            },
        },
        account: {
            create: {
                async after(account, context) {
                    try {
                        await recordFromHook([
                            mapAccountLink(account, "Create", resolveHookActor(context)),
                        ]);
                    } catch (error) {
                        console.error("[audit] account.create.after failed", error);
                    }
                },
            },
            update: {
                async before(account, context) {
                    try {
                        if (context) {
                            passwordTouchedByContext.set(
                                context,
                                Object.keys(account).includes("password"),
                            );
                        }
                    } catch (error) {
                        console.error("[audit] account.update.before snapshot failed", error);
                    }
                },
                async after(account, context) {
                    try {
                        const passwordTouched = context
                            ? (passwordTouchedByContext.get(context) ?? false)
                            : false;
                        if (context) passwordTouchedByContext.delete(context);

                        await recordFromHook([mapPasswordChange(account, passwordTouched)]);
                    } catch (error) {
                        console.error("[audit] account.update.after failed", error);
                    }
                },
            },
            delete: {
                async after(account, context) {
                    try {
                        await recordFromHook([
                            mapAccountLink(account, "Delete", resolveHookActor(context)),
                        ]);
                    } catch (error) {
                        console.error("[audit] account.delete.after failed", error);
                    }
                },
            },
        },
        session: {
            create: {
                async after(session) {
                    try {
                        await recordFromHook([mapImpersonation(session, "start")]);
                    } catch (error) {
                        console.error("[audit] session.create.after failed", error);
                    }
                },
            },
            delete: {
                async after(session) {
                    try {
                        await recordFromHook([mapImpersonation(session, "end")]);
                    } catch (error) {
                        console.error("[audit] session.delete.after failed", error);
                    }
                },
            },
        },
    },
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

If better-auth's hook parameter types do not structurally accept the `HookUserRow` / `HookAccountRow` / `HookSessionRow` shapes (they are supersets of what the mapping functions need, so they should), narrow at the call site — for example `mapUserUpdate({ id: String(user.id), name: user.name, email: user.email, banned: user.banned, banReason: user.banReason, banExpires: user.banExpires }, snapshot, actor)` — rather than widening the mapping function's parameter types. The mapping functions' narrow inputs are what make them testable.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: clean. No test imports `auth.ts`; this step confirms nothing else broke.

- [ ] **Step 6: Commit**

```bash
git add src/server/auth.ts
git commit -m "feat(log): capture account-security events via databaseHooks

Email changes, password changes, bans, social account links, and both ends of
an impersonation now produce log entries. These run through better-auth's own
endpoints rather than tRPC, so they were not logged at all before.

Every hook body swallows its errors. after hooks run once the underlying write
has committed and better-auth rethrows what they throw, so an uncaught error
would return a 500 for an operation that already succeeded. Fail-closed is not
reachable on this path; audit gaps are logged instead.

The before/after WeakMap stash carries what the payload touched, plus the old
email, into the after hook — better-auth's hooks carry no previous value. Keyed
by the endpoint context so it is request-scoped, mirroring the existing
previousEmailByRequest pattern in this file.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Batch wiring — `LogBatch` for the two D4H operations

Gives the `Operations` registry its callers. A registry with none would be exactly the speculative surface this design cut `moduleId` to avoid.

**Files:**

- Modify: `src/trpc/routers/teams-router.ts` — `importTeamFromD4H`, `syncronizeD4HTeam`
- Modify: `src/trpc/routers/personnel-router.ts:410-447` — `createPerson`
- Test: `src/trpc/routers/teams-router.test.ts`

**Interfaces:**

- Consumes: `createLogBatch` from `@/server/log-entry`; `ctx.logEvent(options)` with `batchId` from Task 4.
- Produces: `createPerson(ctx, personId, create, batchId?)` — a fourth optional parameter, threaded into its `logEvent`.

**Notes for the implementer:**

- Both operations are user-initiated, so both set `userId` and `actorLabel`. Neither has an unattended counterpart yet; `LogBatch.userId` is nullable for the cron that eventually will.
- `importTeamFromD4H` is marked `@deprecated` but is still live. Wire it.
- Both procedures do their writes across several separate awaits rather than one transaction, so the batch is created with a plain `await` first. The ordering rule still holds — the batch row must exist before any entry references it.

- [ ] **Step 1: Write the failing test**

Add to `src/trpc/routers/teams-router.test.ts`. The file exists and already imports
`nanoId16`, `OrganizationId`, `TeamId`, `createMockPrisma`, and `createAuthenticatedMockContext`,
and it stubs `server-only` at the top so `teams-router` can load under jsdom — keep that
stub. Add one import:

```ts
import { UserId } from "@/lib/schemas/user";
import { createLogBatch, recordLogEntry } from "@/server/log-entry";
```

```ts
describe("syncronizeD4HTeam — batching", () => {
  it("opens one batch and stamps every entry in the run with it", async () => {
    const db = createMockPrisma();
    const orgId = OrganizationId.create();
    const userId = UserId.create();
    const teamId = TeamId.create();

    const batch = await createLogBatch(
      {
        operationKey: "d4h-team-sync",
        userId,
        actorLabel: "Ada Lovelace <ada@example.com>",
        description: "Synchronized memberships from linked D4H team",
      },
      db,
    );

    await recordLogEntry(
      {
        scope: "organization",
        organizationId: orgId,
        actor: { userId },
        actorLabel: "Ada Lovelace <ada@example.com>",
        batchId: batch.id,
        action: "Create",
        objectType: "TeamMembership",
        objectId: "tm_1",
      },
      db,
    );
    await recordLogEntry(
      {
        scope: "organization",
        organizationId: orgId,
        actor: { userId },
        actorLabel: "Ada Lovelace <ada@example.com>",
        batchId: batch.id,
        action: "Update",
        objectType: "Team",
        objectId: teamId,
      },
      db,
    );

    const entries = await db.logEntry.findMany({ where: { batchId: batch.id } });
    expect(entries).toHaveLength(2);

    // Entries written in one run share a timestamp, so sequence is what orders them.
    const sequences = entries.map((e) => e.sequence).sort((a, b) => a - b);
    expect(new Set(sequences).size).toBe(2);

    const stored = await db.logBatch.findUnique({ where: { id: batch.id } });
    expect(stored).toMatchObject({
      operationKey: "d4h-team-sync",
      userId,
      description: "Synchronized memberships from linked D4H team",
    });
  });
});
```

This test exercises the batch plumbing directly rather than driving `syncronizeD4HTeam`,
which needs a live D4H fetch client. Steps 4 and 5 wire the procedures; this pins the
contract those wirings depend on — one batch row, every entry stamped with it, and distinct
sequences despite a shared timestamp.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/trpc/routers/teams-router.test.ts`
Expected: FAIL — the file or the batch plumbing does not exist yet.

- [ ] **Step 3: Thread `batchId` through `createPerson`**

In `src/trpc/routers/personnel-router.ts`, change the signature and the `logEvent` call:

```ts
export async function createPerson(
    ctx: AuthenticatedOrganizationContext,
    personId: PersonId,
    create: z.infer<typeof PersonData.modifiableSchema>,
    /** Set when this create is part of a multi-entry operation, so the entry joins its batch. */
    batchId?: string,
): Promise<{ created: PersonData }> {
```

and, in the `ctx.logEvent({ … })` call inside it, add `batchId,` after `changes`. Every existing caller passes three arguments and is unaffected.

- [ ] **Step 4: Wire `importTeamFromD4H`**

In `src/trpc/routers/teams-router.ts`, add the import:

```ts
import { createLogBatch, formatActorLabel } from "@/server/log-entry";
```

In `importTeamFromD4H`, immediately after the `getD4HTeam(...)` call and before `auth.api.createTeam(...)`, open the batch:

```ts
const batch = await createLogBatch(
  {
    operationKey: "d4h-team-import",
    userId: ctx.userId,
    actorLabel: formatActorLabel(ctx.auth.user.name, ctx.auth.user.email),
    description: `Imported team "${create.name}" and its members from D4H`,
  },
  ctx.prisma,
);
```

Then add `batchId: batch.id,` to:

- the `ctx.logEvent({ action: "Create", objectType: "Team", … })` call in the first `$transaction`,
- the `createPerson(ctx, PersonId.create(), { … })` call — as a fourth argument, `batch.id`,
- the `ctx.logEvent({ action: "Create", objectType: "TeamMembership", … })` call in the second `$transaction`.

On the `TeamMembership` entry, also add the refs that make the run legible on the person's and team's timelines:

```ts
                            refs: [
                                { objectType: "Person", objectId: person.id, role: "context" },
                                { objectType: "Team", objectId: createdTeam.id, role: "context" },
                            ],
```

- [ ] **Step 5: Wire `syncronizeD4HTeam`**

In `syncronizeD4HTeam`, immediately after the `getD4HTeam(...)` call and before the removal loop, open the batch:

```ts
const batch = await createLogBatch(
  {
    operationKey: "d4h-team-sync",
    userId: ctx.userId,
    actorLabel: formatActorLabel(ctx.auth.user.name, ctx.auth.user.email),
    description: "Synchronized memberships from linked D4H team",
  },
  ctx.prisma,
);
```

Then add `batchId: batch.id,` to all three `ctx.logEvent` calls in the procedure — the `Delete` of a departed `TeamMembership`, the `Create` of a new one, and the final `Update` of the `Team`'s `d4hLastSync`. Pass `batch.id` as `createPerson`'s fourth argument.

On the two `TeamMembership` entries, add the same context refs:

```ts
                        refs: [
                            { objectType: "Person", objectId: member.personId, role: "context" },
                            { objectType: "Team", objectId: teamId, role: "context" },
                        ],
```

on the `Delete` (which has `member.personId` in scope), and:

```ts
                        refs: [
                            { objectType: "Person", objectId: person.id, role: "context" },
                            { objectType: "Team", objectId: teamId, role: "context" },
                        ],
```

on the `Create` (which has `person.id` in scope).

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/trpc/routers/teams-router.test.ts`
Expected: PASS.

- [ ] **Step 7: Type check and run the full suite**

Run: `npx tsc --noEmit && npm run test:run`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/trpc/routers/teams-router.ts src/trpc/routers/personnel-router.ts src/trpc/routers/teams-router.test.ts
git commit -m "feat(log): correlate the two D4H operations with a LogBatch

importTeamFromD4H and syncronizeD4HTeam each write many entries in one
user-initiated run. Until now those were unrelated rows sharing an identical
timestamp, with no way to ask what a given sync did.

Both now open a LogBatch and thread its id through every entry, and the
TeamMembership entries carry Person and Team context refs so the run surfaces on
both timelines. createPerson takes an optional batchId so a create inside a run
joins it; its existing three-argument callers are unaffected.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verification

> **Scope note.** This section was written assuming all eight tasks landed. Task 7 was
> reverted (see its heading), so "the whole capture layer" below means Tasks 1-6 and 8:
> the `LogEntry` model, the `recordLogEntry`/`createLogBatch` service, the three tRPC
> `logEvent` helpers, the `system-admin-router` conversion, the dormant mapping layer, and
> the D4H batch wiring. Account-security events reaching the app through better-auth's own
> endpoints are NOT captured until Task 7 returns. Every check below still applies as
> written — none of them tests the reverted wire.

After Task 8, the whole capture layer is in place. Confirm:

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test:run` clean, with the new tests from Tasks 2, 3, 4, 5, 6 and 8
- [ ] `grep -rn "OrganizationLogEntry\|organizationLogEntry" src prisma --include="*.ts" --include="*.prisma" | grep -v "src/generated/"` returns nothing
- [ ] `grep -rn "processKey\|Processes" src` returns nothing — the registry is `Operations`/`operationKey`
- [ ] The migration SQL contains both the `SERIAL`/identity `sequence` column and the hand-added partial unique index on `log_entry_objects`

## Not in this plan (from the spec's follow-ups)

- Display surfaces — the user-settings "Security activity" card, per-entity history pages, a global log viewer. All unblocked by this work and independent of each other.
- A centralised redaction policy in `recordLogEntry` (password, tokens, `D4hAccessToken.token`, invitation tokens) rather than per-call-site discipline.
- `withOperationRun` ergonomics and the first unattended operation; `LogBatch` gains `finishedAt`/status/counts at that point.
- A stored `moduleId`, if module attribution should be frozen historically once module boundaries settle.
- Denormalizing `sequence` onto `LogEntryObject` if entity timelines get hot.
- The parked settings-store defect: `organization-settings-store.ts` records an `obj_del` for a cleared setting its upsert loop never performs. Pre-existing, and fixing it means adding a delete path.
