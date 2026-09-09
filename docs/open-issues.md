# Open Issues

Known code-level follow-ups not yet filed as GitHub issues — the holding pen for
recognised debt that's too small or too internal for a real issue. Delete an
entry in the PR that resolves it. For anything user-facing or cross-cutting,
file a GitHub issue (`redcloud-nz/avut`) or an entry under `.ideas/` instead.

## Audit logging

- [ ] `syncronizeD4HTeam` (`src/trpc/routers/teams-router.ts` ~L585, ~L640) —
      the removal and addition loops still do sequential `await write` then
      `await logEvent` per member, which the transactional-writes pattern
      forbids. Make each iteration a per-member `$transaction([write,
    logEvent])`. Whole-sync atomicity isn't achievable and isn't the goal:
      `createPerson` runs its own transaction, and each membership change is an
      independently meaningful event correlated under the run's `LogBatch`. The
      orphan-batch trade-off (batch row committed before the loops) is already
      noted at the call site.
