# Pattern: pairing a write with `ctx.logEvent`

Every state-changing mutation that logs an audit entry (`ctx.logEvent(...)` →
`LogEntry`) must commit its write and its log entry atomically, via
`ctx.prisma.$transaction([...])` — never `Promise.all([write, ctx.logEvent(...)])`, and never a
bare sequential `await write(); await logEvent();` either.

## Why not `Promise.all`

`Promise.all([prisma.write(...), ctx.logEvent(...)])` starts both operations concurrently with no
dependency between them. If the primary write rejects (stale record, constraint violation,
connection blip) while the log insert succeeds, the result is an audit-log entry asserting a
change happened when it didn't — worse than no log entry at all, since the log's entire purpose is
to be a reliable record.

## `ctx.logEvent`'s shape

`ctx.logEvent` (`src/trpc/init.ts`) returns the underlying `Prisma.PrismaPromise` rather than
awaiting it internally, so the same call composes two ways:

```ts
logEvent: (options: LogEventOptions, tx?: Prisma.TransactionClient) =>
  Prisma.PrismaPromise<LogEntry>;
```

Every `ctx.logEvent` delegates to `recordLogEntry` (`src/server/log-entry.ts`), which is the
only place an entry is written. It validates synchronously and _then_ returns the lazy
`PrismaPromise`, so a bad entry throws at the call site before the primary write is issued
rather than failing mid-transaction. Never hand-roll a `prisma.logEntry.create` — it would
bypass the write-time invariants and the closed vocabularies (`scope`, `action`,
`objectType`, ref `role`) that `recordLogEntry` enforces.

`logEvent` also accepts `refs` — extra entities the entry should surface on, beyond the
`objectType`/`objectId` primary. `recordLogEntry` writes the primary ref itself and drops
any `refs` entry that duplicates it, so passing the primary again is a no-op rather than a
duplicate row. Entries are ordered by `sequence`, not `timestamp`: in Postgres
`CURRENT_TIMESTAMP` is transaction _start_ time, so every entry written by one
`$transaction([...])` — which is exactly this pattern — shares a byte-identical timestamp.

- **Standalone**: `await ctx.logEvent(options)` — executes immediately, for a procedure that only
  logs and doesn't need to couple the write and the log into one commit.
- **Atomically**: pass it unawaited into `ctx.prisma.$transaction([...])` (array form, uses the
  default `tx`), or `await` it with an explicit `tx` inside `ctx.prisma.$transaction(async (tx) =>
...)` (interactive form).

## The array-form shape

The default and simplest shape — used for the large majority of sites:

```ts
await ctx.prisma.$transaction([
  ctx.prisma.skillCheckSession.delete({
    where: { id: skillCheckSessionId, organizationId },
  }),
  ctx.logEvent({
    action: "Delete",
    objectType: "SkillCheckSession",
    objectId: skillCheckSessionId,
  }),
]);
```

(`skills-router.ts`'s `deleteSession`.) Destructure the array's result positionally when a later
step needs a created/updated record's value — `const [created] = await ctx.prisma.$transaction([
... ])`.

## Gotcha: the array form only accepts same-client Prisma operations

`$transaction([...])`'s array elements must all be `PrismaPromise`s from the same client — nothing
else can go in the array, even if it "looks" awaitable. `prisma-mock` doesn't enforce this, so a
test suite passing is not proof the array is valid; this has to be checked by reading the code.
Two shapes that come up:

**A non-Prisma side effect that should run after the transaction commits** — pull it out to run
sequentially afterward, not inside the array:

```ts
await ctx.prisma.$transaction([
  ctx.prisma.d4hAccessToken.delete({ where: { id: input.tokenId } }),
  ctx.logEvent({ action: "Delete", objectType: "D4HAccessToken", objectId: existing.id }),
  ctx.prisma.organizationConfig.delete({
    where: {
      /* ... */
    },
  }),
]);

// Revalidate organization settings in case this token was being used.
// Not a Prisma operation, so it can't join the $transaction above.
await revalidateOrganizationSettings(ctx.organizationId);
```

(`d4h-access-tokens-router.ts`'s `deleteOrganizationAccessToken` — a Next.js cache revalidation
after a 3-way transaction.)

**A non-Prisma operation the write logically depends on** — run it first, sequentially, then log:

```ts
// auth.api.removeTeam isn't a Prisma operation, so it can't join a $transaction with
// the log entry — log only after the removal succeeds.
await auth.api.removeTeam({ body: { teamId, organizationId: ctx.organizationId } });
await ctx.logEvent({ action: "Delete", objectType: "Team", objectId: teamId });
```

(`teams-router.ts`'s `deleteTeam` — a better-auth API call, not a Prisma write at all.) This one
loses the atomicity guarantee this pattern otherwise gives (the removal could succeed and the log
call could still fail) — accepted here because there's no Prisma operation to couple it to in the
first place, not because sequential-without-a-transaction is a fallback to reach for generally.

## Three `logEvent`s, differing only in where the entry lands

Which helper `ctx.logEvent` is depends on the procedure factory, and the difference is only
which log the entry belongs to. All three return the same `PrismaPromise` and compose into
`$transaction([...])` identically.

**`organizationProcedure`** — `scope: "organization"`, against the organization from the
procedure's own `organizationId` input. Nothing to pass; this is the signature every example
above uses.

**`authenticatedProcedure`** — `scope: "user"`, owned by the **calling** user. Again nothing to
pass: the owner is the caller, not a parameter, so this arm cannot be pointed at somebody
else's log.

```ts
// A user changing something about their own account.
await ctx.prisma.$transaction([
  ctx.prisma.user.update({ where: { id: ctx.userId }, data: { name } }),
  ctx.logEvent({
    action: "Update",
    objectType: "User",
    objectId: ctx.userId,
    changes: diffObject({ name: before.name }, { name }),
  }),
]);
```

**`systemAdminProcedure`** — a system admin acts outside any one organization, so the target is
chosen per call, and the options union forces exactly one of three:

```ts
ctx.logEvent({ organizationId, action: "Create", objectType: "Organization", objectId });
ctx.logEvent({ ownerId, action: "Update", objectType: "User", objectId: ownerId });
ctx.logEvent({ scope: "system", action: "Delete", objectType: "User", objectId: userId });
```

- `organizationId` — the action changed something inside that organization.
- `ownerId` — the entry belongs on that user's own account timeline. `log_entries.ownerId` is
  `onDelete: Cascade`, so the entry dies with the user.
- `scope: "system"` — neither owner FK is set, so nothing can cascade the entry away.

That last distinction is load-bearing, and it is the reason the third arm exists at all. An
`ownerId` entry recording the **deletion** of the user it names is inserted and then cascaded
away inside the very `$transaction` that wrote it — a write with a zero-length lifetime that no
reader can ever see, and no test that only checks _other_ entries will catch it.
`system-admin-router.ts`'s `deleteUser` is that case, and uses `scope: "system"`, carrying the
subject in `objectId` and their denormalized name/email in `description` — because once the
`User` row is gone, that description is all that identifies them.

## Correlating several events: `LogBatch`

A run that produces several _independently meaningful_ events correlates them with a
`LogBatch`. Open it with `createLogBatch` (`src/server/log-entry.ts`) and pass the resulting
`batch.id` as `batchId` on each entry. `operationKey` must be a key of the `Operations`
registry (`src/lib/operations.ts`); `createLogBatch` rejects anything else.

The test for "does this warrant a batch" is in the registry's own doc comment: a batch
correlates events that would each belong, on their own, on their own entity's timeline. It does
not group the row-writes of a single event. A D4H team import creating several people earns an
entry per person and is a batch; a reorder writing a `sequence` integer across five rows is one
event whose five-ness is an implementation detail, and is one entry.

Entries reference the batch, so the batch row must exist first — `$transaction([...])` runs in
array order, so `[createBatch, ...writes, ...logEvents]` is correct and reordering it breaks the
FK. `teams-router.ts`'s two D4H operations go further and commit the batch _before_ their
non-Prisma `auth.api.*` call, which is the one shape here that can leave an orphan batch row (a
batch with no entries) if that call throws; the trade-off is noted at both call sites.

A batch also supplies provenance for an unattended run. `recordLogEntry` allows a null `actor`
only alongside a `batchId`, so an entry with no human behind it is still traceable to the
operation that produced it.

## When there's no `logEvent` at all

A mutation that doesn't call `ctx.logEvent` (a query, or a write on an object type not in
`LogEventOptions.objectType`) has nothing to couple — a plain `await` on the single write is fine,
and `$transaction` isn't needed for a mutation with only one write in the first place. This pattern
applies specifically to _pairing_ a write with its log entry (or multiple writes with a shared log
entry) — not to every mutation.
