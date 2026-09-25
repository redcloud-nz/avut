# tRPC routers and audit logging

Loaded when working under `src/trpc/`. The repo-wide rules (always call `ctx.logEvent`, use `$transaction`, never write `logEntry.create` by hand) stay in the root `AGENTS.md`.

## Router conventions

- One file per domain in `src/trpc/routers/`
- Register new routers in `src/trpc/routers/_app.ts`
- Procedures within each router must be kept in alphabetical order
- Use `organizationProcedure()` for org-scoped mutations/queries — it injects `organizationId` into input and checks permissions automatically
- Use `authenticatedProcedure` for user-scoped procedures
- Use `publicProcedure` only for truly unauthenticated endpoints

## Domain services

Logic reused across procedures, or across routers, belongs in a domain service under
`src/server/services/<domain>.ts` (issue #248) rather than as a router-file helper — a router
importing another router's helper is the symptom that led here. Piloted on
`src/server/services/personnel.ts`.

- One module per domain, imported as a namespace and called `Namespace.verb(ctx, …)` — e.g.
  `import * as Personnel from "@/server/services/personnel"`, `Personnel.create(ctx, …)`. No
  classes, no `services/index.ts` barrel (a barrel loads every service to import one, and breaks
  per-service `vi.mock`).
- A service takes `OrgServiceContext` (`src/server/services/service-context.ts`) — `{ prisma,
organizationId, userId, logEvent }` — not `AuthenticatedOrganizationContext`. The tRPC type
  structurally satisfies it, so no adapter is needed at call sites; the point is that a service
  stays callable from a Server Component or a test with no tRPC context to build.
- A multi-entry operation binds its `LogBatch` once with `withBatch(ctx, batchId)`
  (`service-context.ts`) rather than threading a `batchId` parameter through every helper it
  calls — every `ctx.logEvent` made through the returned context joins that batch automatically.
- Services throw plain `Error` subclasses (`NotFoundError`, `ConflictError` in `src/lib/errors.ts`)
  instead of `TRPCError`, so they carry no tRPC dependency. A `publicProcedure` middleware in
  `src/trpc/init.ts` catches these and rethrows the matching `TRPCError`, preserving the domain
  error as `cause` — the same shape `formatTrpcError` already reads for `FieldConflictError`. A
  conflict the client needs to attribute to one input field still throws `FieldConflictError`
  (`src/trpc/errors.ts`) directly from the router, since only that one carries `fieldName` through
  to the client; `ConflictError` is for a conflict with no single field to blame.
- Services import each other by specific module path, never through a barrel.

## Audit logging — which `logEvent` am I holding?

All three procedure factories put a `logEvent` on `ctx`, and they differ only in which log the entry lands in. Each returns the un-awaited `PrismaPromise`, so all three compose into `$transaction([...])`.

| Procedure                | `ctx.logEvent` writes                                           | Extra options                                                    |
| ------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `organizationProcedure`  | `scope: "organization"`, the org from the procedure's own input | none — the org is not a parameter                                |
| `authenticatedProcedure` | `scope: "user"`, owned by the **calling** user                  | none — the owner is not a parameter                              |
| `systemAdminProcedure`   | whichever of the three the call chooses                         | exactly one of `organizationId`, `ownerId`, or `scope: "system"` |

A system admin acts outside any one organization, so its `logEvent` takes the target:

```ts
ctx.logEvent({ organizationId, action: "Create", objectType: "Organization", objectId });
ctx.logEvent({
  ownerId: input.userId,
  action: "Update",
  objectType: "User",
  objectId: input.userId,
});
ctx.logEvent({ scope: "system", action: "Delete", objectType: "User", objectId: input.userId });
```

The union forces exactly one. Which one to pick:

- **`organizationId`** — the action changed something inside that organization.
- **`ownerId`** — the action belongs on that user's own account timeline. `log_entries.ownerId` is `onDelete: Cascade`, so the entry dies with the user. Never use this arm for an action that deletes the user it names: the entry would be cascaded away inside the very transaction that wrote it.
- **`scope: "system"`** — no organization, no owner, so no FK for anything to cascade through. This is the arm for an action that must outlive its subject (`deleteUser`). The subject survives only as `objectId` plus whatever the `description` denormalizes, so put the name/email in the description.

**`LogBatch` and the `Operations` registry.** A multi-entry operation opens a `LogBatch` with `createLogBatch` (`src/server/log-entry.ts`) and passes the resulting `batch.id` as `batchId` on each of its entries, correlating them. `operationKey` must be a key of the `Operations` registry (`src/lib/operations.ts`) — that registry is the closed vocabulary, and `createLogBatch` rejects anything off it.

A batch correlates **independently meaningful events** — ones that would each belong, on their own, on their own entity's timeline. It is not for grouping the row-writes of a single event. A D4H team import creating people and memberships earns an entry per person, so it is a batch; a reorder writing a `sequence` integer across five rows is one event whose five-ness is an implementation detail, so it is one entry.

A batch also supplies provenance for an unattended run: `recordLogEntry` allows a null `actor` only alongside a `batchId`, so an entry with no human behind it is still traceable to the operation that produced it.
