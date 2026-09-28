# Implementation plan: Provider credential security fixes

**Date:** 2026-09-29
**Branch:** `feat/provider-credential` (worktree `.claude/worktrees/provider-credential`)
**DB:** no schema change and no data change. No `db:branch` needed beyond whatever the
branch's existing migrations already require.

Fixes from the 2026-09-29 security review of `feat/provider-credential`. The review
looked at how credentials are encrypted and how the plaintext is kept from reaching
the client. Encryption key versioning and rotation are **out of scope here**: they have
their own spec,
[`docs/specs/2026-09-29-db-encryption-key-rotation.md`](../specs/2026-09-29-db-encryption-key-rotation.md),
and this plan's Phase 1 is that spec's prerequisite (its §8 step 1).

Most of these problems predate the branch. The branch is the right place to fix them
because it moves D4H onto the generic `ProviderCredential` layer, and every future
provider will copy whatever that layer does.

---

## Phases

| Phase | PR  | Contents                                                                                            |
| ----- | --- | --------------------------------------------------------------------------------------------------- |
| 1     | 1   | Revocation, page permission checks, caching, ownership checks, explicit token stripping, tag length |
| 2     | 2   | Cached D4H API functions keyed by a credential reference instead of the credential object           |
| 3     | —   | React taint. **Skipped for now** (§3)                                                               |

Phase 1 can land alone. Phase 2 is independent of Phase 1 in code, but it's larger, so
it's a separate PR.

---

## Interaction with other work

- **`feat/organization-roles-reorg`**
  ([plan](2026-09-28-organization-roles-reorg.md)) removes the `d4hAccessToken`
  permission resource and re-gates token management onto `organization: ["update"]`.
  §1.2 below adds page checks using `d4hAccessToken`.
  - **If roles-reorg lands first,** use `organization: ["update"]` in §1.2.
  - **Otherwise,** use `d4hAccessToken`, and roles-reorg's step 4 must also pick up
    these pages.
  - Either way, a page must require **exactly** the permission its router procedure
    requires (see [`protect-permission-gating.md`](../patterns/protect-permission-gating.md)).
- **Key rotation spec:** §1.3 is its stated prerequisite. §1.6 implements the spec's
  tag-length rule early, for the legacy path only.

---

## Phase 1

### 1.1 Revoke cached credentials on delete and refresh

**Problem.** `fetchProviderCredential` (`src/server/provider-credential.ts`) is cached
with `"use cache"` and tagged `provider-credential-${id}`, but nothing ever calls
`revalidateProviderCredential` or `revalidateD4HAccessToken`. After
`deleteOrganizationAccessToken`, `getOrganizationD4HAccessToken` keeps returning the
deleted credential until each instance's cache entry refreshes, which is about 15
minutes with the default profile. So a deleted token stays usable.

**Changes** in `src/trpc/routers/d4h-access-tokens-router.ts`:

- `deleteOrganizationAccessToken`: call `revalidateD4HAccessToken(input.tokenId)`
  after the `$transaction`, next to the existing `revalidateOrganizationSettings`.
- `refreshToken`: call `revalidateD4HAccessToken(input.tokenId)` after the
  `$transaction`, so the next read sees the new `metadata` and `status`. After §1.4,
  `refreshToken` only ever touches org credentials, so the personal tag isn't needed.
- `deletePersonalAccessToken` already revalidates the personal tag. No change.

**Check first.** The delete transaction includes
`ctx.prisma.organizationConfig.delete({ where: { …, value: { equals: tokenId } } })`.
Prisma's `delete` throws `P2025` when nothing matches. If that holds here, deleting any
token that _isn't_ the configured sync token fails the whole transaction.

- Confirm with a test.
- If it fails, switch that operation to `deleteMany` with the same filter.
- This is a correctness fix, but it sits in the same transaction, so fix it in the
  same change.

**Tests** in `d4h-access-tokens-router.test.ts`:

- Add `revalidateD4HAccessToken: vi.fn()` to the existing
  `vi.mock("@/server/d4h-access-token")`.
- Assert it is called with the token ID after delete and after refresh.
- Assert that deleting a non-sync token succeeds.

### 1.2 Permission checks on token-using pages

**Problem.** These pages call `getOrganizationBySlug`, which has no access check, and
then load the org credential:

| Page (under `src/app/(wrapper)/(authenticated)/orgs/[slug]/`)      | Loads               |
| ------------------------------------------------------------------ | ------------------- |
| `admin/d4h-access-tokens/page.tsx`                                 | (list; no token)    |
| `admin/d4h-access-tokens/--create/page.tsx`                        | (form; no token)    |
| `admin/d4h-access-tokens/[token_id]/page.tsx`                      | record (via tRPC)   |
| `admin/d4h-access-tokens/[token_id]/whoami/page.tsx`               | org credential      |
| `admin/d4h-access-tokens/[token_id]/members/page.tsx`              | org credential      |
| `admin/d4h-access-tokens/[token_id]/organisation/page.tsx`         | org credential      |
| `admin/d4h-access-tokens/[token_id]/equipment-categories/page.tsx` | org credential      |
| `admin/d4h-access-tokens/[token_id]/equipment-items/page.tsx`      | org credential      |
| `admin/d4h-access-tokens/[token_id]/equipment-kinds/page.tsx`      | org credential      |
| `admin/d4h-access-tokens/[token_id]/equipment-locations/page.tsx`  | org credential      |
| `d4h-views/teams/page.tsx`                                         | org sync credential |
| `d4h-views/personnel/page.tsx`                                     | org sync credential |

- **Who can reach them.** The `admin/layout.tsx` is a client component that only
  checks the module is enabled. A `member`, whose role has no `d4hAccessToken`
  permission, can load `…/[token_id]/whoami` or `…/members` and see D4H data fetched
  with the organization's credential.
- **The token ID isn't secret.** `settings.integrations.d4h.syncToken` is hydrated to
  every member by the `[slug]` layout.
- **The layout can't be the check anyway.** Next can render a page segment without
  re-running its layouts, so every page must check for itself.

**Changes:**

- **`admin/d4h-access-tokens/**`:** replace `getOrganizationBySlug(slug)`with`requireOrganizationWith(slug, <permission>)`, taking `organization` from the result.
  Use the permission of the matching router procedure (see "Interaction with other
  work" above):
  - list, detail and every `[token_id]/*` page: `view`
  - `--create`: `create`
- **`d4h-views/teams` and `d4h-views/personnel`:** these are meant for members, so they
  shouldn't need token permissions. Replace `getOrganizationBySlug` with
  `requireOrganization(slug)` so membership is at least checked. Also check whether the
  rest of `d4h-views/**` has the same gap. They load data through `d4h-api-router`,
  which is already an `organizationProcedure`, so they're probably fine; confirm.
- **`[token_id]/*` pages marked `DEVELOPMENT ONLY`** (whoami, members,
  organisation, and the four equipment pages): as the first line of each page, call
  `if (!env.isDevelopment()) notFound();`, using `env` from `@/lib/env`.
  - Gating on `NODE_ENV === "development"` hides them on preview deployments as well
    as production. Vercel builds every deployment with `NODE_ENV=production`, so they
    only exist under `next dev`.
  - Keep the permission check too, because members of the shared dev database
    shouldn't be able to use the organization's credential locally either.
  - Nothing links to these subpages except their own breadcrumbs, so no navigation
    needs hiding.
  - The token list, detail and create pages aren't development-only and stay
    available everywhere, with permission checks.

**Lower risk, still fix:** `i3/members` and `i3/equipment-kinds` use the _session
user's own_ personal token via `getConfiguredD4HAccessToken`, so they don't hand out
anyone else's credential. They don't check membership either, though (`getOrganizationBySlug`

- `requireSession`). A user removed from an organization whose personal token
  lingers (see Deferred) can still load them. Move both to `requireOrganization(slug)`.

**Verify** in the browser with `avut-test-in-browser`: impersonate a plain `member`,
load `…/admin/d4h-access-tokens/<sync token id>/whoami`, and expect the forbidden page.

### 1.3 Cache the record, not the plaintext

**Problem.** `getPersonalProviderCredential` decrypts _inside_ its `"use cache"`
function, so the decrypted token sits in the cache. The org path already caches the
encrypted record and decrypts outside.

**Change** in `src/server/provider-credential.ts`: split the function in two.

```ts
async function fetchPersonalProviderCredentialRecord(provider, organizationId, userId) {
  "use cache";
  cacheTag(`provider-credential-personal-${provider}-${organizationId}-${userId}`);
  return prisma.providerCredential.findFirst({ where: { provider, organizationId, userId } });
}

export async function getPersonalProviderCredential(provider, organizationId, userId) {
  const record = await fetchPersonalProviderCredentialRecord(provider, organizationId, userId);
  return record ? toServerOnlyProviderCredential(record) : null;
}
```

- The tag is unchanged, so `revalidatePersonalProviderCredential` keeps working.
- Decryption now runs on every call instead of once per cache entry. It takes
  microseconds, so that doesn't matter.

### 1.4 Ownership checks

- **`refreshToken`:** add `userId: null` to the `findUnique` filter. Today anyone with
  `d4hAccessToken: ["update"]` can refresh a member's _personal_ token by ID. That
  calls D4H with it and rewrites its metadata. It doesn't leak the token, but it
  shouldn't be possible.
- **`deleteOrganizationAccessToken`:** add `userId: null` to the lookup. Today
  `d4hAccessToken: ["delete"]` can delete a member's personal token.
  - **This changes behaviour:** admins lose that ability.
  - Personal tokens are still removed by the owner themselves, by account purge, and
    by organization deletion (cascade).
  - Agreed 2026-09-29. If admins later need to remove a departing member's token,
    that belongs in the remove-member flow (see Deferred), not here.
- **`getOrganizationProviderCredential`** (`src/server/provider-credential.ts`):
  - Return `null` when `record.groupId !== null`. Group-owned credentials (#198) must
    never come back from an organization lookup.
  - Drop the `organizationId &&` truthiness guard, so the ownership check always runs.
    The type already requires an ID; an empty string must not bypass it.
- **Tests:**
  - `refreshToken` and `deleteOrganizationAccessToken` with a personal token's ID →
    `NOT_FOUND`.
  - `getOrganizationProviderCredential` with a group credential → `null`.

### 1.5 Remove `token` explicitly before returning data

**Problem.** `D4HAccessToken.fromRecord` and `ProviderCredential.fromRecord` spread
`...record`, including the encrypted `token`. Only `z.object`'s default of dropping
unknown keys removes it. Switching to `z.looseObject`, or adding a procedure without
`.output()`, would send the encrypted token to the browser.

**Changes** in `src/lib/schemas/d4h-access-token.ts` and
`src/lib/schemas/provider-credential.ts`:

```ts
fromRecord: ({ token: _token, ...record }: ProviderCredentialRecord) => …
```

**Tests** in `d4h-access-tokens-router.test.ts`: for every procedure that returns
credential data, assert `expect(result).not.toHaveProperty("token")`, and for lists
check each item. The procedures:

- `createOrganizationAccessToken`
- `createPersonalAccessToken`
- `getOrganizationAccessToken`
- `getPersonalAccessToken`
- `listOrganizationAccessTokens`
- `listPersonalAccessTokens`

These tests are what actually guards the tRPC path. Taint (Phase 3) wouldn't cover it.

### 1.6 Pin the GCM tag length

In `src/server/encrypt.ts`:

- `decryptValue` passes `{ authTagLength: 16 }` to `createDecipheriv`.
- It rejects payloads shorter than 28 bytes (12-byte IV plus 16-byte tag) before
  touching the cipher.

Every existing value was written with a 16-byte tag, so nothing that decrypts today
stops decrypting. The key-rotation spec requires this on both formats; this does the
legacy path now.

**Tests** in `encrypt.test.ts`:

- truncated input (under 28 bytes) is rejected
- a value with its last byte removed (a short tag) is rejected
- existing round-trip tests still pass

### Phase 1 checklist

- [x] 1.1 revalidate on delete/refresh; `organizationConfig` delete checked or fixed; tests
- [ ] 1.2 page checks (permission object per roles-reorg status); dev-only pages 404 outside `next dev`; browser check as `member`
- [x] 1.3 personal credential cache holds the record
- [ ] 1.4 `userId: null` on refresh/delete; `groupId` and organization checks; tests
- [ ] 1.5 explicit `token` removal; no-`token` output tests
- [ ] 1.6 tag length and minimum payload; tests
- [ ] `npm run check`

---

## Phase 2: Cached D4H functions take a credential reference

**Problem.** Five `"use cache"` functions in `src/server/d4h-api/client.ts` take the
whole `D4HAccessToken_ServerOnly` object, **plaintext `token` included**, as an
argument:

- `fetchD4HWhoamiCached`
- `getD4HTokenMetadata`
- `getD4HTeamMembers`
- `fetchD4HTeamDetailCached`
- `fetchD4HOrganisationCached`

`"use cache"` serializes its arguments to build the cache key, so the plaintext token
ends up in the key held by the cache handler. It's the same class of leak as §1.3, and
it would get worse if a remote cache handler were ever configured.

### Design

A reference type in `src/server/d4h-access-token.ts`:

```ts
export type D4HCredentialRef = {
  credentialId: string;
  organizationId: OrganizationId;
  userId: UserId | null; // null → organization credential
};

export function toD4HCredentialRef(token: D4HAccessToken_ServerOnly): D4HCredentialRef;

/** Loads the credential through fetchProviderCredential, and throws NotConfiguredError
 * unless its organizationId/userId/provider match the reference exactly. */
export async function resolveD4HCredential(
  ref: D4HCredentialRef,
): Promise<D4HAccessToken_ServerOnly>;
```

- **What the reference contains.** It carries `credentialId` as well as the owner. If a
  user replaces their personal token, the new ID gives a new cache key, so results from
  the old token aren't served for up to `cacheLife("hours")`.
- **Ownership is checked on resolve.** `resolveD4HCredential` checks it again rather
  than trusting the caller, so a reference can't be used to borrow someone else's
  credential by ID.
- **Inside the cached functions.** Each takes `ref: D4HCredentialRef` instead of
  `token`, calls `resolveD4HCredential(ref)` inside the cache scope, and keeps its
  existing `d4h-api-${ref.credentialId}-…` tags. That leaves the tag names unchanged.
- **Unchanged:** `getD4HFetchClient` still takes the resolved object. It's a React
  `cache()` keyed on object identity within one request, not `"use cache"`, so nothing
  is serialized.

### Special case: metadata for a token that isn't saved yet

`createOrganizationAccessToken` and `createPersonalAccessToken` call
`getD4HTokenMetadata` with a token built from the mutation input, before any row
exists, so there's nothing to reference. `refreshToken` passes a freshly fetched
`whoami`. So:

- Extract the body into an uncached `computeD4HTokenMetadata(token, whoami)`.
- The three mutations call it directly. They shouldn't be cached anyway: validating a
  newly entered token must hit D4H.
- `getD4HTokenMetadata(ref)` stays as the cached wrapper for the read paths.

### Callers to update

Each converts with `toD4HCredentialRef(token)` at the point it gets the token:

- `src/trpc/routers/d4h-api-router.ts` (8 call sites)
- `src/server/services/d4h-team-sync.ts`
- `src/forms/i3-issue-items/processor.ts`
- `src/trpc/routers/teams-router.ts`
- pages: `i3/members`, `i3/equipment-kinds`, `d4h-views/teams`, `d4h-views/personnel`,
  and the `admin/d4h-access-tokens/[token_id]/*` pages (unless removed in §1.2)

### Tests

- `resolveD4HCredential` rejects a reference whose owner doesn't match the stored
  record (wrong organization, a personal credential referenced as an organization one,
  and the reverse).
- A reference built from a replaced personal token (new `credentialId`) produces a
  different cache key. Assert on the arguments; don't try to inspect the cache itself.
- The existing `d4h-api-router`, `d4h-team-sync` and `teams-router` tests pass once
  their mocks are updated to the new signatures.

---

## Phase 3: React taint (skipped)

**Decided 2026-09-29: not doing this for now.** The reasoning is kept below for when it
comes up again.

`experimental_taintUniqueValue` on the decrypted token in
`toServerOnlyProviderCredential` would make React refuse to serialize it into a Client
Component's props.

**Against doing it now:**

- `experimental.taint` also switches the whole `app` directory onto **React's
  experimental release channel** (see
  `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/taint.md`).
  That's a stability cost to the whole app for a second line of defence.
- It doesn't cover tRPC JSON responses, which is where credential data actually leaves
  the server. §1.5's explicit removal and tests cover that.
- It depends on Phase 2. A tainted value passed as a `"use cache"` argument is likely
  to throw during key serialization (unverified).
- Copies and derived values lose the taint, e.g. the `Authorization` header string.

**Recommendation:** don't enable it. Reconsider if the app moves to the experimental
channel for another reason, or if Server Components start receiving credential objects
directly (they don't today: every page uses the token server-side and passes only D4H
data down). If it is adopted, it's a single call in `toServerOnlyProviderCredential`
plus the config flag, after Phase 2 has landed.

---

## Deferred / out of scope

- **Encryption key versioning and rotation:** see the spec. It starts after Phase 1.
- **Personal tokens of members who leave or are removed from an organization** survive
  in `provider_credentials` until account purge. Once §1.2 adds membership checks to
  the `i3` pages, the read paths in the app all require membership (tRPC through
  `organizationProcedure`), but they're still stored secrets. Consider
  deleting them in the leave and remove-member flows. That needs its own look at those
  services.
- **`fromRecord` for `ProviderCredential`:** once a second provider exists, check that
  the generic client schema is actually used, and consider removing it until then.

## Decisions

| Question                                        | Decision (2026-09-29)                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `DEVELOPMENT ONLY` token pages (§1.2)           | Keep them, but `notFound()` unless `NODE_ENV === "development"`, plus the permission check. |
| Admins deleting members' personal tokens (§1.4) | Removed. `deleteOrganizationAccessToken` only deletes organization credentials.             |
| React taint (Phase 3)                           | Skipped for now.                                                                            |
