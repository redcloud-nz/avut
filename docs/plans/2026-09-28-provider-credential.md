# Implementation plan: `ProviderCredential` (generalize `D4HAccessToken`)

**Date:** 2026-09-28
**Tracks:** [#286](https://github.com/redcloud-nz/avut/issues/286)
**Branch:** `feat/provider-credential`, worktree `.claude/worktrees/provider-credential`, based
on `origin/integration`.
**DB:** This is a rename/reshape migration on a table with production data (`d4h_access_tokens`),
not an additive one. Give the branch its own copy with `db:branch` before running
`prisma migrate dev` — never draft this migration against shared `avut`.

Two phases, each its own PR:

| Phase | PR scope                                                      | Migration |
| ----- | -------------------------------------------------------------- | --------- |
| 1     | Add `ProviderCredential`, generic access/cache functions       | additive  |
| 2     | Migrate D4H onto it; delete `D4HAccessToken` and its callers   | **yes, destructive rename** |

Phase 1 ships the new model and generic plumbing without touching any existing D4H code path —
`D4HAccessToken` and `ProviderCredential` coexist. Phase 2 is the actual cutover: every D4H
consumer moves onto the generic table in one PR, then the old table is dropped. Splitting it this
way means Phase 1 is low-risk and reviewable on its own, and Phase 2 — the risky part — is a
single, bounded diff instead of tangled up with new schema design.

No provider besides D4H is wired up in this plan. Vercel/Cloudflare/ForwardEmail (#284, #285) each
get their own follow-up PR once this lands, adding a `Provider` enum value, a metadata union
member, and their own thin wrapper functions — none of that is scoped here.

---

## Current state (checked on `4311087c`, `integration`)

- `D4HAccessToken` (`prisma/schema.prisma:392`) has `organizationId`/`userId` (both nullable —
  exactly one is set per row, enforced only by convention, not a DB constraint), `label`,
  `token` (AES-256-GCM ciphertext via `encryptDBValue`), `serverCode`, `status` (free-text —
  today it stores the D4H API's HTTP status text like `"OK"`, not a lifecycle enum; nothing here
  is `RecordStatus`), `expiresAt`, `metadata: Json`, timestamps. Two back-relations
  (`Team_D4H.linkTokenId`, `Organization_D4H.syncTokenId`) point at it by id.
- `encryptDBValue`/`decryptDBValue` (`src/server/encrypt.ts`) are already fully provider-agnostic
  — AES-256-GCM against `serverEnv.DB_ENCRYPTION_SECRET`, no D4H awareness at all. Nothing to
  change here.
- `src/server/d4h-access-token.ts` has three consumer-facing functions, each cached with a
  hand-written tag:
  - `getOrganizationD4HAccessToken({ organizationId, tokenId })` — no cache itself, delegates to
    `fetchD4HAccessToken` which tags `d4h-access-token-${tokenId}`.
  - `getPersonalD4HAccessTokenForUser(organizationId, userId)` — tags
    `d4h-personal-access-token-${organizationId}-${userId}`.
  - `getConfiguredD4HAccessToken(organizationId, userId)` — throws `NotConfiguredError` if
    `integrations.d4h.enabled` is off or no personal token exists; wraps the function above.
  - Plus `toServerOnlyD4HAccessToken` (decrypts `token`) and two `revalidate*` functions.
- `src/lib/schemas/d4h-access-token.ts` defines three schemas over the same shape:
  `D4HAccessToken` (client-safe, no `token` field, ISO date strings), `D4HAccessToken_ServerOnly`
  (has `token`, no `status`/timestamps), and `D4HAccessTokenMetadata` (the one genuinely
  D4H-specific piece — `d4HTeams`/`d4HOrganisations` arrays with D4H resource shapes).
- `src/trpc/routers/d4h-access-tokens-router.ts` has 9 procedures: create org / create personal /
  delete org / delete personal / get org / get personal / list org / list personal / refresh.
  All gated on the `d4hAccessToken` permission resource (`view`/`create`/`update`/`delete`,
  `src/lib/permissions.ts:11`). Every write pairs a `ctx.prisma.d4HAccessToken.*` call with
  `ctx.logEvent({ objectType: "D4HAccessToken", ... })` inside `$transaction`, matching
  `docs/patterns/transactional-writes.md`. `deleteOrganizationAccessToken` also deletes an
  `OrganizationConfig` row keyed `integrations.d4h.syncToken` that references the token id, and
  calls `revalidateOrganizationSettings` outside the transaction (non-Prisma op).
  `LogEntry.objectType` (`src/lib/schemas/log-entry.ts:116`) has a fixed `"D4HAccessToken"`
  literal in its enum, and a `D4HAccessToken: "org-admin"` module mapping at line 201.
- `src/server/d4h-api/client.ts`'s `getD4HFetchClient(token: D4HAccessToken_ServerOnly)` reads
  `token.serverCode` (via `getD4HServer`) and `token.token` — the only two fields it touches.
  `fetchD4HWhoamiCached` tags its own cache separately (`d4h-api-${token.id}-whoami`) — unrelated
  to the token-storage cache tags above and out of scope for this rename.
- Consumers of the token-storage layer beyond the router: 8 D4H-views/i3/admin pages under
  `src/app/.../d4h-access-tokens/...` (list + one page per D4H resource type), `d4h-views`,
  `i3/equipment-kinds`, `i3/members`, `src/forms/i3-issue-items/processor.ts`, and
  `d4h-api-router.ts`. All of these go through the router or the `src/server/d4h-access-token.ts`
  functions — none reach into `prisma.d4HAccessToken` directly outside those two files and the
  router.
- No `OrganizationGroup`/`groupId` concept exists yet (#198 is unbuilt) — the plan adds a nullable
  `groupId: String?` column with no FK target yet, matching the issue's "add now, unused until
  #198" decision. It stays a plain nullable string column (no relation) since there's no `Group`
  model to reference.
- `docs/plans/README.md` and `docs/specs/README.md` both require a `**Date:**` line matching the
  filename's date prefix — followed above.

---

## Design decisions carried over from #286 (not reopened here)

These were already settled in the issue; this plan implements them rather than re-litigating:

- One generic table, not one bespoke table per provider.
- `Provider` is a fixed Prisma enum (costs a migration per new provider — accepted).
- Provider-specific fields live in a **discriminated Zod union on `provider`**, not loose `Json`
  cast by hand at each call site — same DB column (`Json`), stronger typing above it.
- Ownership stays `organizationId`/`userId` (nullable, exactly-one-set-by-convention, same as
  today); `groupId` added now as an inert nullable column ahead of #198.
- Name: `ProviderCredential`.

## Decisions this plan makes (the issue's open questions)

| Open question                                   | Decision                                                                                                                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrate D4H in the same change or as a follow-up? | Same initiative, but **its own PR (Phase 2)** after the generic table lands additively (Phase 1). Not deferred indefinitely — an unmigrated `ProviderCredential` sitting unused next to `D4HAccessToken` is exactly the near-duplicate #286 exists to avoid. |
| Cache-tag naming                                  | `provider-credential-${credentialId}` and `provider-credential-personal-${provider}-${organizationId}-${userId}`, replacing the two D4H-specific tag formats.                                          |
| Generic accessor vs. per-provider wrappers        | Generic `getProviderCredential`/`getPersonalProviderCredential` functions are the real API (below); D4H keeps its existing three function names as thin wrappers over them so no call site outside `src/server/d4h-access-token.ts` changes. |
| `D4HAccessToken_ServerOnly` shape                 | Becomes `ProviderCredential_ServerOnly` typed as a discriminated union on `provider`; a `ForD4H` helper type/narrowing function gives D4H call sites (`getD4HFetchClient`, etc.) the same flat shape they have today. |
| Migration mechanics                               | Detailed in Phase 2 below — table rename, enum column backfilled to `D4H`, metadata reshaped, FK columns on `Team_D4H`/`Organization_D4H` repointed. Run only with explicit permission per AGENTS.md, on the branch DB first. |

---

## Phase 1: Add `ProviderCredential`, additive (no D4H changes)

### 1. Schema

```prisma
enum Provider {
  D4H
}

model ProviderCredential {
  id             String        @id
  provider       Provider
  organizationId String?
  organization   Organization? @relation("provider_credential_to_organization", fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String?
  user           User?         @relation("provider_credential_to_user", fields: [userId], references: [id], onDelete: Cascade)
  groupId        String?       // Nullable, unused until #198 (OrganizationGroup) exists. No FK yet.
  label          String
  token          String
  status         String
  expiresAt      DateTime
  metadata       Json          @default("{}")
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([organizationId])
  @@index([groupId])
  @@map("provider_credentials")
}
```

Notably absent: `serverCode` — that moves into `metadata` as D4H's discriminated-union member
(Phase 2), since it's D4H-specific, not shared. No `linkedTeams`/`syncingOrganizations` back-relations
yet either — those get repointed in Phase 2 alongside `Team_D4H`/`Organization_D4H`.

Run `npx prisma generate` after this (client-only, no DB contact, fine unprompted per AGENTS.md).
Do **not** run `prisma migrate dev` for this yet — batch it with Phase 1's other schema-adjacent
work into one migration at the end of the phase.

### 2. Schemas — `src/lib/schemas/provider-credential.ts`

```ts
export const ProviderCredentialId = {
  schema: zodNanoId16("ProviderCredentialId expected").brand<"ProviderCredentialId">(),
  create: () => ProviderCredentialId.schema.parse(nanoId16()),
} as const;

export const ProviderCredentialMetadata = {
  schema: z.discriminatedUnion("provider", [
    z.object({ provider: z.literal("D4H"), ...D4H-specific fields incl. serverCode, d4HTeams, d4HOrganisations }),
    // future: z.object({ provider: z.literal("VERCEL"), ... }), etc. — not added until a provider needs it
  ]),
};

export const ProviderCredential = { schema: ..., fromRecord: ... }; // client-safe, no `token`
export const ProviderCredential_ServerOnly = { schema: ... }; // has `token`, discriminated by `provider`
```

Keep `D4HAccessTokenMetadata`'s existing shape verbatim as the `D4H` union member's payload (minus
`serverCode`, which was already a sibling column — it becomes a metadata field here since the
generic table has no per-provider typed columns). This is file-for-file new; the old
`src/lib/schemas/d4h-access-token.ts` isn't touched until Phase 2.

### 3. Generic access functions — `src/server/provider-credential.ts`

Mirrors `src/server/d4h-access-token.ts`'s shape, parameterized by `provider`:

```ts
export function toServerOnlyProviderCredential(record): ProviderCredential_ServerOnly
export async function getOrganizationProviderCredential({ organizationId, credentialId })
export async function getPersonalProviderCredential(provider, organizationId, userId)
export function revalidateProviderCredential(credentialId)
export function revalidatePersonalProviderCredential(provider, organizationId, userId)
```

`getConfiguredD4HAccessToken`'s pattern (check `integrations.<provider>.enabled`, throw
`NotConfiguredError`) stays D4H-specific for now — it reads an org-settings path
(`integrations.d4h.enabled`) that only D4H has today (`organization-settings.ts:140`). Generalize
it only when a second provider actually needs the same "enabled toggle + personal token" gate;
don't build it speculatively here.

### 4. Migration

One migration for the phase: `add_provider_credential`. Purely additive (`CREATE TABLE`,
`CREATE TYPE`) — safe to run against shared `avut` per AGENTS.md's rule ("Never run a command that
mutates the shared database without explicit permission each time" — still ask, but the blast
radius is a new empty table). Ask before running `prisma migrate dev`.

### 5. Tests

`src/server/provider-credential.test.ts` and `src/lib/schemas/provider-credential.test.ts`
mirroring the coverage the D4H equivalents have today (check `src/server/d4h-access-token.ts` has
no test file currently — confirm during implementation; if it doesn't, match whatever the router
test does for encryption round-trips instead of inventing new conventions).

**Phase 1 does not touch:** `d4h-access-tokens-router.ts`, `d4h-access-token.ts`,
`d4h-access-token.ts` (schema), `d4h-api/client.ts`, `Team_D4H`/`Organization_D4H`, any page under
`.../d4h-access-tokens/...`, `permissions.ts`, `log-entry.ts`. Everything D4H keeps working exactly
as today, against the old table, for the whole phase.

---

## Phase 2: Migrate D4H onto `ProviderCredential`

This is the destructive part — do it as its own PR, reviewed on its own, after Phase 1 has merged
and had time to sit.

### 1. Migration (data-preserving reshape)

Written as raw SQL inside a Prisma migration (`prisma migrate dev --create-only`, then hand-edit),
since Prisma's declarative diffing can't express "move rows from table A into table B, reshaping
columns" — same category of exception `docs/patterns/` calls out for non-additive changes:

1. For each row in `d4h_access_tokens`, insert into `provider_credentials`:
   `provider = 'D4H'`, `id`/`organizationId`/`userId`/`label`/`token`/`status`/`expiresAt`/
   `createdAt`/`updatedAt` copied as-is, `groupId = NULL`,
   `metadata = jsonb_set(metadata, '{provider}', '"D4H"') || jsonb_build_object('serverCode', "serverCode")`
   (fold the sibling `serverCode` column into the metadata JSON so it matches the new
   discriminated-union shape).
2. Add `linkTokenId`/`syncTokenId` FK columns on `Team_D4H`/`Organization_D4H` pointing at
   `provider_credentials.id` (same ids carry over, so this is just repointing the FK target, not
   a data migration on those two tables).
3. Drop the old FK columns/constraints on `Team_D4H`/`Organization_D4H` that pointed at
   `d4h_access_tokens`.
4. Drop `d4h_access_tokens`.

Run this only on the branch DB (`db:branch`) first, verify row counts match
(`SELECT count(*) FROM d4h_access_tokens` vs. the post-migration `provider_credentials WHERE
provider = 'D4H'`), then it needs explicit permission again before touching shared `avut` at
merge/deploy time — flag this loudly in the PR description per AGENTS.md's migration rule.

### 2. Code changes, one PR

- `src/lib/schemas/d4h-access-token.ts`: delete. Replace every import with the `ProviderCredential`
  equivalents; add a narrow `type D4HProviderCredential_ServerOnly = Extract<ProviderCredential_ServerOnly, { provider: "D4H" }>`
  (or a small `assertD4HCredential`/narrowing helper) so `d4h-api/client.ts`'s
  `getD4HFetchClient(token: D4HAccessToken_ServerOnly)` becomes
  `getD4HFetchClient(token: D4HProviderCredential_ServerOnly)` reading `token.metadata.serverCode`
  instead of a top-level `token.serverCode` column, and `token.token` unchanged.
- `src/server/d4h-access-token.ts`: delete the three duplicated cache/fetch functions; keep the
  file (or fold into `provider-credential.ts` — decide during implementation based on how much
  D4H-only logic remains, e.g. `getConfiguredD4HAccessToken`'s settings check) as thin wrappers:
  `getOrganizationD4HAccessToken = (args) => getOrganizationProviderCredential({ provider: "D4H", ...args })`,
  same for the other two. External call sites (8 pages, `d4h-api-router.ts`,
  `forms/i3-issue-items/processor.ts`) keep importing these same function names — this is the
  point of keeping thin wrappers, so Phase 2's diff doesn't ripple into every D4H page.
- `src/trpc/routers/d4h-access-tokens-router.ts`: every `ctx.prisma.d4HAccessToken.*` call becomes
  `ctx.prisma.providerCredential.*` with `provider: "D4H"` added to every `where`/`data`. Router
  method names, input/output shapes, and permission gates (`d4hAccessToken: [...]`) stay
  unchanged — this is a storage-layer swap, not an API change, so `_app.ts`'s router registration
  and every client-side caller are untouched.
- `permissions.ts`: `d4hAccessToken` permission key stays as-is — it's a UI-facing permission for
  "manage D4H tokens," not a table name; no change needed unless a later provider PR wants its own
  key (out of scope here).
- `log-entry.ts`: `objectType` keeps the `"D4HAccessToken"` literal (existing log rows already use
  it — renaming would break historical log readability) rather than introducing a generic
  `"ProviderCredential"` type. `ctx.logEvent({ objectType: "D4HAccessToken", ... })` calls in the
  router are unchanged.
- `Team_D4H.linkToken` / `Organization_D4H.syncToken` Prisma relations: update the `@relation`
  field type from `D4HAccessToken?` to `ProviderCredential?`; any code narrowing on the returned
  record (if it reads `.serverCode` off the joined record) needs to read `.metadata` instead —
  audit both call sites during implementation.
- Delete `d4h-access-token.test.ts` if one exists (confirm during Phase 1); router test
  (`d4h-access-tokens-router.test.ts`) keeps its existing test cases, updated to the new Prisma
  model name in its mock setup (per `.claude/rules/testing.md`'s prisma-mock conventions).

### 3. Verification

- `npm run check -- --all` — full typecheck/lint/test pass, since this phase touches a Prisma
  model name referenced across ~20 files.
- Manually exercise (or have the test suite cover) all 9 router procedures against the branch DB:
  create org token, create personal token, refresh (hits real D4H API — use a real/sandbox token
  if available, otherwise confirm the existing test's mocking approach covers this), delete both
  kinds, list both kinds, get both kinds.
- Confirm the D4H-views pages, i3 pages, and `d4h-api-router.ts` still render/behave identically —
  they should need zero code changes if the wrapper-function approach above holds.

---

## Explicitly out of scope for this plan

- Adding Vercel, Cloudflare, or ForwardEmail as actual `Provider` enum values or metadata union
  members — #284/#285 each add their own provider when they're built, following the pattern this
  plan establishes.
- `groupId` ever being populated or having an FK — inert until #198 (`OrganizationGroup`) exists.
- Generalizing `getConfiguredD4HAccessToken`'s "integration enabled + personal token" gate into a
  provider-generic helper — revisit when a second provider needs the identical shape.
- Any change to `#285`'s own plan — that issue's text currently sketches a bespoke
  `ForwardEmailAccessToken` table mirroring `D4HAccessToken` directly; once this plan lands,
  #285's implementation should be revisited to use `ProviderCredential` instead, but that's a
  decision for #285's own plan, not this one.
