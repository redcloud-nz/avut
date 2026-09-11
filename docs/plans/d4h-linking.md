# Implementation plan: D4H linking & team synchronisation

Implements [`docs/specs/d4h-linking.md`](../specs/d4h-linking.md) — Phase 1 (manual,
preview-then-apply sync). Phase 2 (scheduled sync, §9 of the spec) is out of scope.

**Branch / DB:** worktree `d4h-linking` (branch `worktree-d4h-linking`). This work
adds Prisma migrations, so before the first `migrate dev`:
`npm run db:branch d4h-linking` (stop dev server + Prisma Studio first), and
`npm run db:unbranch` on merge. Every `migrate dev` needs explicit permission.

## Decisions folded in (from review)

- **No `properties.d4h*` backfill** — prod/dev count is 0. Migrations only add the
  new models and drop `enum TeamType` / `teams.type`. No data migration.
- **Member fetch stays `OPERATIONAL` + `NON_OPERATIONAL`.** A member that leaves
  that set is **archived, not deleted**; if it reappears it is **un-archived**.
- **New `TeamMembership.status`** (`RecordStatus`, default `Active` — enum already
  has `Active | Archived | Deleted`). Sync toggles `Active` ⇄ `Archived`.
- **Diff + log only when the diff is non-empty** — for membership snapshot updates
  and for the `Team_D4H` / `Organization_D4H` cache refresh.
- **Stale preview forces a re-confirm** — `applyD4HTeamSync` rejects a `planToken`
  that no longer matches the freshly-computed plan (`CONFLICT` /
  `stale-plan`); the dialog re-fetches the plan and the user re-approves. The
  server never applies a plan the user has not seen.
- **`createTeamFromD4H` is a clean single `$transaction`** — team management is
  already off better-auth (`ctx.prisma.team.create` inside `$transaction` with
  `logEvent`, commits `475b87b` / `e53bd55`). Appendix A is effectively done; the
  spec's orphan-batch caveat on `createTeamFromD4H` no longer applies. Only the
  `createLogBatch` row itself precedes the transaction (harmless orphan if the txn
  throws — same as every other batch call site).

The spec's §7.2 / §7.3 (which say "hard delete" / `removals`) and §6.2 / Appendix A
notes are now stale against these decisions — update `docs/specs/d4h-linking.md`
alongside the implementation.

---

## Current state (verified)

- `src/trpc/routers/teams-router.ts` (894 lines): `importTeamFromD4H` (`@deprecated`,
  writes `properties.d4h*`, never creates `Team_D4H`), `syncronizeD4HTeam`
  (unreachable — `team.d4h == null` always true), helper `getD4HTeam(accessToken, id)`.
- `prisma/schema.prisma`: `model Team_D4H` (fields `teamId`, `d4hTeamId`,
  `d4hTeamName`, `d4hServer`, `d4hLastSyncedAt`); `enum TeamType { General D4HDefined }`
  — orphaned, `Team` has no `type` field; `Team`/`Person`/`TeamMembership` carry
  free-form `properties Json`.
- `src/lib/schemas/team.ts`: `TeamData.d4h` sub-object mirrors the old `Team_D4H`
  shape (`d4hServer`, no org/timezone).
- `src/lib/schemas/d4h/`: `organisation.ts` (`D4HOrganisation`), `team.ts`
  (`D4HTeam` with optional `owner`, `D4HTeamRef`, `D4HTeamDetail` w/ `timezone`),
  `member.ts` (`D4HMember` — `status` enum `OPERATIONAL|NON_OPERATIONAL|OBSERVER|RETIRED`,
  commented-out `toTeamMembershipStatus` mapping to `Operational|NonOperational|…`).
- `src/server/d4h-api/client.ts`: `getD4HTokenMetadata(token)` returns
  `{ d4HTeams: (D4HTeamRef & { owner: D4HOrganisation | undefined; permissions })[],
d4HOrganisations }` — already resolves each team's owning org.
- `src/server/d4h-access-token.ts`: `getPersonalD4HAccessTokenForUser(orgId, userId)`,
  `getOrganizationD4HAccessToken(...)`; tokens carry `serverCode`, `userId` (null = org token).
- `src/lib/operations.ts`: `Operations = { "d4h-team-import", "d4h-team-sync" }`.
- `src/lib/schemas/organization-settings.ts`: `integrations.d4h` has `enabled`,
  `defaultServer`, `syncToken`, `teamSync`, `teamMemberSync`.
- `src/components/admin/teams/import-team-from-d4h.tsx` — current import dialog.
- Team detail: `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/`.

---

## Work breakdown

### 1. Prisma schema + generated client

`prisma/schema.prisma`:

1. **`Team_D4H` — extend/rename:**
   - `d4hServer` → `d4hServerCode`
   - `d4hLastSyncedAt` → **`lastSyncedAt DateTime?`** (bookkeeping, not a D4H
     field — see "Sync timestamps" below). Now actually written.
   - add `d4hOrganisationId Int?`, `d4hTimezone String?`, `linkTokenId String?`
   - `linkTokenId` FK → `D4HAccessToken` (`onDelete: SetNull`); add the back-relation
     field on `D4HAccessToken`.
2. **`Organization_D4H` — new** (0..1 per org). Fields per spec §3.1:
   `organizationId` (`@unique`, FK → `Organization`, `onDelete: Cascade`),
   `serverCode String`, `d4hOrganisationId Int?`, cache columns
   (`d4hOrganisationName`, `d4hTimezone`, `d4hCurrency`, `d4hReportingStartDay`,
   `d4hReportingStartMonth` — all nullable), `syncTokenId String?`
   (FK → `D4HAccessToken`, `onDelete: SetNull`, Phase 2 — declare now),
   **`lastSyncedAt DateTime?`** (was `orgSyncedAt` in the spec — renamed for
   consistency). Add `d4h Organization_D4H?` back-relation on `Organization`.
   `@@map("organization_d4h")`.
3. **`TeamMembership_D4H` — new** (spec §3.3): `teamMembershipId` (`@unique`, FK →
   `TeamMembership`, `onDelete: Cascade`), `d4hMemberId Int` (`@index`),
   `d4hStatus String`, `d4hPosition String?`, `d4hRef String?`, `d4hRoleId Int?`.
   **No `lastSyncedAt`** (dropped from the spec — `Team_D4H.lastSyncedAt` covers
   it; every member is synced with the team). Add `d4h TeamMembership_D4H?`
   back-relation on `TeamMembership`. `@@map("team_membership_d4h")`.
4. **Drop `enum TeamType`** (no `teams.type` field on the model; the column is
   dropped in the migration).
5. **`TeamMembership` — add `status RecordStatus @default(Active)`** (mirrors
   `Person.status`). Add `@@index([teamId, status])` — sync and most membership
   lists want active-only.

Then `npm run prisma generate` (client only — no DB contact, allowed).

**One migration** — `add_d4h_link_models` — created together, applied to the
branch DB with permission. Contents:

- new tables `organization_d4h`, `team_membership_d4h`;
- `ALTER TABLE team_d4h RENAME COLUMN d4h_server TO d4h_server_code` + new nullable
  columns (hand-check the generated SQL: a rename can come out as drop+add — fix
  to `RENAME COLUMN`, though with count 0 it doesn't matter for data, only for
  cleanliness);
- `ALTER TABLE team_memberships ADD COLUMN status ... DEFAULT 'Active'`;
- `DROP TABLE`/`DROP TYPE` for `team_type` + `TeamType`.
- `ALTER TABLE team_d4h RENAME COLUMN d4h_last_synced_at TO last_synced_at`.
- No data migration. Sidecars are keyed by their parent FK (`@unique`), no `id`
  column — no `nanoId16`.

**Sync timestamps.** Exactly two, both named `lastSyncedAt`, both nullable, both
pure sync bookkeeping (not D4H values, so no `d4h` prefix), neither logged:

- `Team_D4H.lastSyncedAt` — set on every `applyD4HTeamSync` and on the first pull
  at link time. Drives the "last synced …" UI. Written with a bare
  `team_d4h.update` (no `logEvent`) even when nothing else changed.
- `Organization_D4H.lastSyncedAt` — set whenever an org-bearing team in that org
  is synced (the cache columns are refreshed in the same write; `logEvent` only
  if the cache diff is non-empty, per decision 2).
  Per-membership sync time is deliberately not stored.

### 2. Zod schemas

- **`src/lib/schemas/d4h/member.ts`** — un-comment / add `D4HMemberStatus`
  export (`z.enum([...])`, matching the `status` field). Decide the stored
  `d4hStatus` string form: **store the raw D4H value** (`OPERATIONAL` etc.) per
  spec §3.3 / §7.2 wording — drop the `toTeamMembershipStatus` remap idea.
- **`src/lib/schemas/d4h/organisation.ts`** — already has all cached fields; add a
  helper `toOrganizationD4HCache(org: D4HOrganisation)` returning the cache column
  subset, or inline in the router.
- **`src/lib/schemas/d4h/team.ts`** — `D4HTeamDetail` already carries `timezone`;
  confirm the detail fetch path is wired (`fetchD4HTeamDetailCached` exists in
  `client.ts`) and use it in sync to get `d4hTimezone`.
- **`src/lib/schemas/team.ts`** — `TeamData.d4h`: rename `d4hServer` →
  `d4hServerCode` and `d4hLastSyncedAt` → `lastSyncedAt`, add
  `d4hOrganisationId: z.number().nullable()`, `d4hTimezone: z.string().nullable()`.
  Update `fromRecord` mapping + the `include: { d4h: true }` consumers still
  compile. Consumer `src/components/admin/teams/team-content.tsx` reads
  `team.d4h.d4hLastSyncedAt` → update to `lastSyncedAt`.
- **`src/lib/schemas/team-membership.ts`** — add `status: z.enum(RecordStatus)`
  to `teamMembershipSchema` (+ `fromRecord` passes it through). Add a `d4h`
  sub-object (`TeamMembershipData.d4h`, nullable) with `d4hMemberId`, `d4hStatus`,
  `d4hPosition`, `d4hRef`, `d4hRoleId`. Update `fromRecord` to
  take `{ d4h: TeamMembership_D4H | null }` and every `include`/`findMany` that
  feeds `fromRecord` (`listTeamMemberships`, sync, personnel router — grep
  `TeamMembershipData.fromRecord`). Decide default list behaviour: most callers
  should filter `status: "Active"` — audit each call site rather than assuming.
- **New `src/lib/schemas/d4h-sync-plan.ts`** — `SyncPlan` type + zod schema.
  **Deviates from spec §7.3** (no `removals`): groups are
  `additions`, `updates`, `archivals`, `reactivations`, `teamMetadataChanges`,
  plus `counts` for each and `planToken` / `generatedAt`. `Change` type from
  `src/lib/diff.ts` — reuse its exported type. See §4 below for each group's rows.

### 3. `src/lib/operations.ts`

Add `"d4h-team-link": { label: "D4H team link" }`. Keep `"d4h-team-import"` (old
batches reference it) and `"d4h-team-sync"`. (`"d4h-team-sync-scheduled"` is
Phase 2 — not added now.)

### 4. Pure sync-plan builder

**New `src/server/d4h-sync.ts`** (server util, no `server-only` DB imports so it
stays unit-testable — actually keep it Prisma-free entirely):

```ts
export function buildSyncPlan(input: {
  teamId: string;
  d4hMembers: D4HMember[];               // OPERATIONAL + NON_OPERATIONAL only
  avutMemberships: {                     // ALL D4H-managed ones (have a _D4H row),
    teamMembershipId: string;            //   including status: "Archived"
    personName: string;
    membershipStatus: "Active" | "Archived" | "Deleted";
    d4h: { d4hMemberId; d4hStatus; d4hPosition; d4hRef; d4hRoleId };
  }[];
  existingPersonEmails: Set<string>;     // (orgId, lowercased email) that already resolve
  teamMetadata: { current: {...}; incoming: {...} };
}): SyncPlan
```

Key by `d4hMemberId`. Reconciliation:

| D4H     | `_D4H` row               | membership status | → plan group / action                                                                                                                                                                              |
| ------- | ------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| present | none                     | —                 | **addition** — `personMatch` = `existing` if `existingPersonEmails` has the email else `new`. Apply: resolve/create `Person`, create `TeamMembership` (`status: Active`) + `_D4H` row.             |
| present | exists                   | `Active`          | **update** iff `diffObject` over `{d4hStatus,d4hPosition,d4hRef,d4hRoleId}` is non-empty. Apply: update `_D4H` snapshot + `logEvent Update`.                                                       |
| present | exists                   | `Archived`        | **reactivation** — always (person is back in D4H). Apply: set membership `status: Active`, update `_D4H` snapshot, `logEvent Update` (single entry, changes include `status` + any snapshot diff). |
| absent  | exists                   | `Active`          | **archival**. Apply: set membership `status: Archived`, `logEvent Update`. `_D4H` row **kept** (needed to detect reappearance).                                                                    |
| absent  | exists                   | `Archived`        | no-op.                                                                                                                                                                                             |
| —       | none (manual membership) | —                 | never touched.                                                                                                                                                                                     |

- `existingPerson` email match already covers the "person on the team manually,
  no `_D4H` row" case: that's a manual membership → left alone; a _new_ `_D4H`
  membership is created for the same person only if D4H says so and there's no
  `_D4H` row yet. **Edge:** a manual `TeamMembership` already exists for
  `(team, person)` → `TeamMembership` `@@unique([teamId, personId])` blocks a
  second row. Apply must detect this and **adopt** the existing membership
  (attach a `_D4H` row, flip `status` to `Active`) rather than insert. Note in
  the plan row as `personMatch: "existing"` + an `adoptsMembership` flag.
- `teamMetadataChanges`: `diffObject` over `{ d4hTeamName, d4hOrganisationId,
d4hTimezone }` (+ the `Organization_D4H` cache fields for an org-bearing team).
- `planToken`: `sha256(JSON.stringify({ d4hMembers-normalised & sorted,
teamMetadata.incoming }))`. `generatedAt` ISO is separate (not in the hash).
  Hash helper lives here (`node:crypto`).
- Deterministic ordering — sort every group by `personName` then id.

### 5. Router procedures (`teams-router.ts`)

Delete `importTeamFromD4H`, `syncronizeD4HTeam`, and the `getD4HTeam` helper
(replace with metadata-based resolution). Add, **in alphabetical order**:

Shared internal helper `resolveD4HTeamForLink(ctx, d4hTeamId)`:

- `getPersonalD4HAccessTokenForUser` → 400 if none.
- `getD4HTokenMetadata(token)` → find `d4HTeams` entry by id → 404 if not visible.
- Returns `{ token, d4hTeamRef, owningOrg: D4HOrganisation | undefined }`.

Two internal helpers, both in `teams-router.ts` (or a `teams-router.d4h.ts` sibling
if the file gets unwieldy):

`fetchD4HSyncInputs(ctx, { teamD4H, token })` → `{ d4hMembers, avutMemberships,
existingPersonEmails, teamMetadata }`:

- fetch D4H members: `fetchClient.GET('/v3/{context}/{contextId}/members', { path:
{ context: 'team', contextId }, query: { status: ['OPERATIONAL',
'NON_OPERATIONAL'] } })` — **unchanged filter** (per decision). Members outside
  that set simply don't appear → archival.
- fetch team detail (`fetchD4HTeamDetailCached`) for `timezone`.
- load **all** D4H-managed memberships (`teamMembership.findMany({ where: { teamId,
d4h: { isNot: null } }, include: { d4h: true, person: true } })`) — includes
  `Archived` ones.
- `existingPersonEmails`: `person.findMany({ where: { organizationId }, select: {
email: true } })` → lowercased `Set`.

`applyD4HSyncPlan(ctx, { plan, teamD4H, batchId, owningOrg })` — one
`$transaction` **per plan row** (each is an independently-meaningful event;
loop bounded by team size — matches `operations.ts` guidance and spec §7.4):

- **addition**: resolve `Person` by `(orgId, lowercased email)` — reuse via
  `getPersonByEmail` else `createPerson(ctx, PersonId.create(), { name, email,
tags: [], properties: {} }, batchId)` (**no `properties.d4hId`**). Then:
  - if a `TeamMembership` already exists for `(team, person)` (the `adoptsMembership`
    case) → `$transaction([teamMembership.update({ status: 'Active' }),
teamMembership_d4h.create({ teamMembershipId, ...snapshot }), logEvent
Update refs=[Person,Team]])`.
  - else → `$transaction([teamMembership.create({ id, organizationId, teamId,
personId, status: 'Active', d4h: { create: { ...snapshot } } }), logEvent
Create refs=[Person,Team]])`.
- **update**: `$transaction([teamMembership_d4h.update({ where: { teamMembershipId },
data: snapshot }), logEvent Update refs=[Person,Team], changes])`.
- **reactivation**: `$transaction([teamMembership.update({ where: { id }, data: {
status: 'Active' } }), teamMembership_d4h.update({ ...snapshot }), logEvent
Update refs=[Person,Team], changes: status + snapshot diff])`.
- **archival**: `$transaction([teamMembership.update({ where: { id }, data: {
status: 'Archived' } }), logEvent Update refs=[Person,Team], changes: { status }])`.
  `_D4H` row untouched.
- **metadata refresh**: always `team_d4h.update({ lastSyncedAt: now, ...changed })`
  — if `teamMetadataChanges` is non-empty, include `d4hTeamName` /
  `d4hOrganisationId` / `d4hTimezone` and pair it with `logEvent Update objectType
Team` inside a `$transaction`; if empty, a bare `team_d4h.update({ lastSyncedAt })`
  with no `logEvent`.
- **org cache refresh** — for an org-bearing team: always
  `organization_d4h.update({ lastSyncedAt: now, ...changed })`; if the cache diff
  is non-empty, include the cache columns + pair with `logEvent Update objectType
Organization` in a `$transaction`; if empty, bare update, no `logEvent`.

`runTeamSync(ctx, { teamD4H, token, batchId, requireFreshMatch?: string })` — the
composition used by `linkTeamToD4H` / `createTeamFromD4H` (first pull, no token to
match) and `applyD4HTeamSync` (must match):

1. `fetchD4HSyncInputs` → `buildSyncPlan` → fresh plan + `planToken`.
2. if `requireFreshMatch` and it `!== plan.planToken` → **throw** `TRPCError`
   `CONFLICT` code `stale-plan`, `message: "The D4H data changed since you
previewed. Review the updated changes and confirm again."` — **no writes**.
3. else `applyD4HSyncPlan(...)`; return `{ plan }`.

**5.1 `linkTeamToD4H({ teamId, d4hTeamId })`** — `{ team: ["update"] }`

1. Load team (`getTeam`); 404 if missing; 409 if already linked (`team.d4h`).
2. `resolveD4HTeamForLink`.
3. Load `organization_d4h` for the org. Run **spec §4 invariants** (see §6 below)
   → `TRPCError` `CONFLICT`/`PRECONDITION_FAILED` with the exact spec messages.
4. `createLogBatch({ operationKey: "d4h-team-link", userId, actorLabel, description })`.
5. `upsert` `organization_d4h`: create (with `d4hOrganisationId` = owning org id or
   null; if org present, fetch + cache its attrs via the org-detail already in
   metadata `d4HOrganisations`) or leave existing intact.
6. `$transaction([team_d4h.create({ d4hTeamId, d4hTeamName, d4hServerCode,
d4hOrganisationId, linkTokenId: token.id }), logEvent Update on Team])`.
7. `runTeamSync(...)` in the same batch (first membership pull).

**5.2 `createTeamFromD4H({ d4hTeamId, name? })`** — `{ team: ["create"] }`

- `resolveD4HTeamForLink`; run §4 invariants (state (a) or (b)).
- `name ??= d4hTeamRef.title`.
- `createLogBatch` `d4h-team-link`.
- `upsert` `organization_d4h` (as 5.1 step 5).
- **Single `$transaction`** — `team.create` + nested `d4h: { create: {...} }` +
  `logEvent Create objectType Team` — team mgmt is already pure Prisma
  (`ctx.prisma.team.create`, commit `475b87b`), so no orphan-row caveat beyond the
  `createLogBatch` row itself.
- `runTeamSync(...)` for the first membership pull, same batch.
- Repoint `import-team-from-d4h.tsx` at this (input `{ d4hTeamId, name }`).

**5.3 `unlinkOrganizationFromD4H({})`** — `{ organization: ["update"] }`

- `PRECONDITION_FAILED` if any `team_d4h` exists in the org.
- `$transaction([organization_d4h.delete, logEvent Update objectType Organization])`.

**5.4 `unlinkTeamFromD4H({ teamId })`** — `{ team: ["update"] }`

- 404 if missing; 400 if not linked.
- Load `organization_d4h`.
  - org-less mode (`d4hOrganisationId == null`): `$transaction([team_d4h.delete,
organization_d4h.delete, logEvent Update on Team])`.
  - org-linked mode: `$transaction([team_d4h.delete, logEvent Update on Team])` —
    `organization_d4h` left intact (sticky).
- `TeamMembership_D4H` rows cascade; `TeamMembership` rows stay (become manual).

**5.5 `planD4HTeamSync({ teamId }) → SyncPlan`** — `{ team: ["view"] or ["update"] }`
(spec says preview; use `["update"]` since it precedes an apply). Pure read:
`resolveD4HTeamForLink` via the team's own `d4hTeamId`, fetch both sides,
`buildSyncPlan`, return plan + `planToken`. No writes, no batch.

**5.6 `applyD4HTeamSync({ teamId, planToken })`** — `{ team: ["update"] }`

- Load team + `team_d4h`; 400 if unlinked.
- `createLogBatch({ operationKey: "d4h-team-sync", userId, ... })`.
- `runTeamSync(ctx, { ..., requireFreshMatch: planToken })` — re-fetches and
  re-plans; if the fresh `planToken` differs, throws `CONFLICT` `stale-plan`
  **before any write**. Otherwise applies and returns `{ plan }`.
- If the batch was created but the plan turned out stale, that's one orphan
  `log_batches` row — acceptable (same as every batch call site). Optional
  refinement: compute the fresh plan first, then only `createLogBatch` once it
  matches.

### 6. §4 invariant helper

`assertD4HLinkAllowed({ orgD4H, tokenServerCode, owningOrgId })` in
`src/server/d4h-sync.ts` (or a new `d4h-link-invariants.ts`), pure over the loaded
`organization_d4h` row + inputs. Returns the resolved action:
`{ kind: "create-org-linked", d4hOrganisationId } | { kind: "create-org-less" } |
{ kind: "reuse" }` or throws `TRPCError` with the spec's exact messages
(§4.1 server consistency, §4.3 a/b/c, §4.4 a/b/c). Unit-tested (§9).

### 7. UI

- **Team detail content** (`admin/teams/[team_id]/…-content.tsx`) — add a **"D4H"
  card**, gated by `integrations.d4h.enabled` (from `useOrganization()` settings)
  and `<Protect permissions={{ team: ["update"] }}>`.
  - unlinked → "Link to D4H…" button → dialog (`?action=link`, per
    `mutation-dialog.md`) listing token-visible teams
    (`d4hApi.listTeamsAccessibleToUser` — check exact procedure name in
    `d4h-api-router` / add one wrapping `getD4HTokenMetadata`), each row calls
    `linkTeamToD4H`; surface §4 rejection messages inline.
  - linked → show `d4hTeamName`, D4H org name, `lastSyncedAt`; "Sync…" button
    (`?action=sync`) and "Unlink" menu item (`unlinkTeamFromD4H`).
- **Sync dialog** (`?action=sync`) — calls `planD4HTeamSync` on open (`useQuery`),
  renders `additions` / `updates` / `archivals` / `reactivations` +
  `teamMetadataChanges` as grouped lists (empty plan → "already in sync",
  disable Apply). "Apply" → `applyD4HTeamSync({ teamId, planToken })`.
  - On `CONFLICT` `stale-plan`: the mutation `onError` invalidates / refetches
    `planD4HTeamSync`, shows a prominent inline banner ("The D4H data changed —
    review the updated changes below"), and the user must click Apply again with
    the new `planToken`. No auto-apply.
  - On success: toast with counts, close dialog (`history: replace`).
- **Mutation cache effects**: declare `meta: { effects }` on the new mutations
  (invalidate `listTeams`, `getTeam`, `listTeamMemberships` for the team) per
  `mutation-effector.tsx` — no manual `queryClient` calls.
- **`import-team-from-d4h.tsx`** — swap `importTeamFromD4H` call →
  `createTeamFromD4H`; input becomes `{ d4hTeamId, name }`.
- Run `npx next typegen` if any `page.tsx` added (none planned — dialogs are
  search-param driven).

### 8. Settings schema (light touch, Phase 1)

Leave `integrations.d4h.teamSync` / `teamMemberSync` as-is for now (Phase 2
collapses them). Do **not** wire `Organization_D4H.syncTokenId` yet. No change
required unless a consumer of the old `d4hServer` name exists — grep.

### 9. Tests

- **`src/server/d4h-sync.test.ts`** — `buildSyncPlan` pure unit tests, one per
  reconciliation table row: addition (new vs existing person; `adoptsMembership`),
  update (empty diff skipped, non-empty included), **archival**, **reactivation**,
  archived-and-still-absent → no-op, manual membership untouched, metadata diff,
  `planToken` determinism (member order independent) + change sensitivity, empty
  plan.
- **`src/server/d4h-link-invariants.test.ts`** — every §4 branch (a/b/c ×
  org/org-less), server-code mismatch, exact messages.
- **`teams-router` router tests** (`createMockPrisma`, `createAuthenticatedMockContext`):
  - factor the D4H reads (`fetchD4HSyncInputs` + `resolveD4HTeamForLink`) behind a
    small injectable interface so tests pass a fake; default wires the real
    `getD4HTokenMetadata` / fetch client.
  - `linkTeamToD4H`: happy path creates `Organization_D4H` + `Team_D4H` + runs
    first sync; rejects cross-org; rejects when org-less link present.
  - `applyD4HTeamSync`: each reconciliation outcome writes the right rows +
    `logEvent`; `stale-plan` `CONFLICT` when the injected fake changes between
    plan and apply, **with no writes**.
  - `unlinkTeamFromD4H`: org-less deletes `Organization_D4H`; org-linked keeps it.
  - `unlinkOrganizationFromD4H`: refuses while a `Team_D4H` remains.
- Run `npm run test:run` + `npx tsc --noEmit` + `npm run lint`.

### 10. Cleanup checklist (spec §10)

- [ ] `enum TeamType` + `teams.type` column dropped
- [ ] `getD4HTeam` helper removed
- [ ] `TeamData.d4h.d4hServer` → `d4hServerCode`, `d4hLastSyncedAt` → `lastSyncedAt`
      everywhere (grep `d4hServer`, `d4hLastSync`; incl. `team-content.tsx`,
      `teams-router.test.ts` fixtures, `validation.test.ts`)
- [ ] `import-team-from-d4h.tsx` repointed
- [ ] no remaining refs to `syncronizeD4HTeam` / `importTeamFromD4H` (grep app + tests)
- [ ] `TeamMembership.status` filtered where appropriate in existing list queries
- [ ] spec §3.1 / §3.2 / §3.3 updated (drop `TeamMembership_D4H.d4hLastSyncedAt`;
      `d4hLastSyncedAt`/`orgSyncedAt` → `lastSyncedAt`)
- [ ] spec §7.2 / §7.3 / §6.2 / Appendix A updated to match (archive-not-delete;
      no `removals`; `createTeamFromD4H` is a clean txn)
- [ ] `docs/specs/d4h-linking.md` Status line updated

---

## Resolved (was: open questions)

1. **Departed members** → archive, not delete. New `TeamMembership.status`; fetch
   filter stays `OPERATIONAL` + `NON_OPERATIONAL`; reappearance un-archives.
2. **Cache-refresh logging** → log only when the diff is non-empty (both
   `Team_D4H` and `Organization_D4H`).
3. **`createTeamFromD4H`** → clean single `$transaction` (team mgmt already off
   better-auth per `475b87b`/`e53bd55`); only the `createLogBatch` row precedes
   it, same harmless orphan as every batch call site.
4. **Stale preview** → `applyD4HTeamSync` rejects a non-matching `planToken` with
   `CONFLICT` `stale-plan` and writes nothing; the user re-previews and re-confirms.
5. **`properties.d4h*` backfill** → not needed (count 0). One schema-only migration.
6. **Sync timestamps** → drop `TeamMembership_D4H.lastSyncedAt`; keep one
   `lastSyncedAt DateTime?` on `Team_D4H` (renamed from `d4hLastSyncedAt`) and on
   `Organization_D4H` (renamed from spec's `orgSyncedAt`). No `d4h` prefix — it's
   our bookkeeping. Neither logged; both written every sync.

## Remaining review flags

- **`adoptsMembership` edge** — a person already on the team via a _manual_
  `TeamMembership` who then appears in D4H: the plan adopts the existing row
  (attaches `_D4H`, sets `status: Active`) rather than erroring on the
  `@@unique([teamId, personId])`. Confirm that's the desired behaviour vs.
  surfacing it as a conflict for the user to resolve.
- **`d4hStatus` stored form** — plan stores the raw D4H value
  (`OPERATIONAL` / `NON_OPERATIONAL`). The commented-out `toTeamMembershipStatus`
  in `member.ts` suggests an earlier intent to remap to
  `Operational` / `NonOperational`. Raw is simpler and matches spec §3.3 wording;
  confirm.
- **`planD4HTeamSync` permission** — using `{ team: ["update"] }` (it always
  precedes an apply). Switch to `["view"]` only if a read-only preview for
  non-editors is wanted.
