# Pattern: pairing a write with `ctx.logEvent`

Every state-changing mutation that logs an audit entry (`ctx.logEvent(...)` →
`OrganizationLogEntry`) must commit its write and its log entry atomically, via
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
logEvent: (
    options: LogEventOptions,
    tx?: Prisma.TransactionClient,
) => Prisma.PrismaPromise<OrganizationLogEntry>;
```

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
    ctx.logEvent({ action: "Delete", objectType: "D4hAccessToken", objectId: existing.id }),
    ctx.prisma.organizationConfig.delete({ where: { /* ... */ } }),
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

## When there's no `logEvent` at all

A mutation that doesn't call `ctx.logEvent` (a query, or a write on an object type not in
`LogEventOptions.objectType`) has nothing to couple — a plain `await` on the single write is fine,
and `$transaction` isn't needed for a mutation with only one write in the first place. This pattern
applies specifically to *pairing* a write with its log entry (or multiple writes with a shared log
entry) — not to every mutation.
