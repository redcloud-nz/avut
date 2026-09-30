# Implementation plan: D4H token caching and data-exposure fixes

**Date:** 2026-09-30
**Branch:** `plan/d4h-token-cache-fixes` → `fix/d4h-token-cache-fixes` on pickup (worktree `.claude/worktrees/d4h-token-cache-fixes`)
**DB:** no schema change, no migration, no data change. No `db:branch`.
**Written against:** integration @ 89eb45a2
**Source:** the 2026-09-29 review of how D4H tokens and data are accessed, cached and passed to the client (conversation, no issue). Takes over Phase 2 of [`2026-09-29-provider-credential-security-fixes.md`](2026-09-29-provider-credential-security-fixes.md), whose Phase 1 has shipped.
**Depends on:** the generic owner-checked lookup (`ProviderCredentialRef`, `getProviderCredentialForOwner` in `src/server/provider-credential.ts`), built separately and **already merged into this branch** (8c904ef5). It ships in this branch's PR.
**Forward-compatible with:** D4H OAuth, which is expected later but not designed yet. See [OAuth readiness](#oauth-readiness).

The token itself never reaches the client, and that plan's Phase 1 fixed revocation, page permissions and ownership checks. What's left is in the D4H API cache layer and a few consumers:

1. The `"use cache"` functions in `src/server/d4h-api/client.ts` take the whole `D4HAccessToken_ServerOnly`, so the **plaintext token becomes part of each cache key**.
2. Their `d4h-api-*` tags are **never revalidated**, so with `cacheLife("hours")` a refresh or a token revoked in D4H doesn't show up for hours.
3. The i3 issue processor makes an **authorization decision from a whoami cached for hours**, never checks its D4H `POST` responses, and skips the "integration enabled" check.
4. D4H Views' `personnel` and `teams` pages read with the **org sync token**, so any member sees the org token's whole D4H scope. The personnel page also sends **member emails** it never renders to the client.
5. **Nothing stops two personal tokens** per user per org. `findFirst` then picks one arbitrarily.
6. Error handling: token creation saves tokens D4H rejected; some list calls ignore `response.ok`. `listEquipmentKinds` reads the stored metadata snapshot while every other procedure reads live metadata, and personal tokens have no way to refresh that snapshot.

---

## Decisions

| Question | Decision (2026-09-30) |
| --- | --- |
| How the cached functions are keyed | Adopt the earlier plan's Phase 2 design as it stands: a `D4HCredentialRef` (`credentialId`, `organizationId`, `userId`), re-resolved and ownership-checked **inside** each cached body (Tasks 1–2). No caller passes plaintext into a cache key. |
| Unsaved tokens (create mutations, refresh) | Uncached `computeD4HTokenMetadata(token, whoami)`. Validating a token the user just entered must hit D4H, and there's no row to reference yet. |
| Cache invalidation | Every cached D4H function also gets an umbrella tag `d4h-api-${credentialId}`. `revalidateD4HApiCache(credentialId)` clears it on refresh and delete. Inner tags do propagate to outer entries (checked against Next 16.3.4), so the inner `provider-credential-${id}` tag already covers part of this. The umbrella tag says it explicitly instead of relying on that. |
| Lifetimes | Keep the explicit `cacheLife("hours")` on each outer function. Per `cacheLife.md` → "Nested caching behavior", an explicit outer lifetime wins over the inner credential cache's default. |
| i3 permission check | Uses a new **uncached** `fetchD4HWhoami`. Checks every `POST`, continues past failures, and reports `savedToD4H: { reason }` naming how many items D4H rejected and the first status. |
| i3 token lookup | `getConfiguredD4HAccessToken`, so a disabled integration stops the form like every other D4H read. |
| D4H Views token model | The **viewer's personal token** (`getConfiguredD4HAccessToken`), like the module's members/equipment pages and every `d4hApi` procedure. Each viewer sees exactly what D4H lets them see. |
| D4H Views props | Only the displayed columns cross to the client. No `email`, no duplicate `teams` prop. |
| One personal token per user per org | A guard in `createPersonalAccessToken` (`CONFLICT` if one exists). **No unique index / migration.** A race or a direct DB write can still create a duplicate; accepted. |
| Refresh on a failed whoami | Record the new `status`, **keep the existing metadata**. Today it overwrites metadata with empty lists. |
| Personal-token refresh UI | A "Refresh" button on the personal token's detail page, not a menu item. `ActionVerb` in `src/lib/hotkeys.ts` has no refresh verb, and adding one just for this isn't worth it. |
| How a request gets its bearer value | Through one async accessor, `getD4HAccessToken(credential)`, called from an async `onRequest` middleware in `getD4HFetchClient` (openapi-fetch supports async `onRequest`). For API keys it returns the stored key. For OAuth it will return a current access token and refresh it when needed. Nothing else reads the secret. |
| What identifies a credential | Always `credentialId`, in cache keys, tags, refs and `Team_D4H.linkTokenId`. Never anything derived from the secret, which an OAuth refresh would rotate. |
| Credential kind discriminator (`api-key` / `oauth`) | **Not added now.** It belongs in the OAuth work, and it costs nothing then: a `.default("api-key")` on the metadata schema covers every existing row without a migration. |
| Validating a credential against D4H | One uncached `validateD4HCredential(credential)` returns `{ ok, status, whoami }`. It's shared by the create mutations, the refresh helper and, later, the OAuth callback. |

---

## Tasks

### - [ ] 1. Owner-checked credential resolution

**Files:** `src/server/d4h-access-token.ts`, new `src/server/d4h-access-token.test.ts`, `docs/plans/2026-09-29-provider-credential-security-fixes.md`.

**Do:** the D4H side of the earlier plan's Phase 2 design, on top of the generic `getProviderCredentialForOwner` (see **Depends on**). No callers change yet.

- **Before starting,** confirm `ProviderCredentialRef` and `getProviderCredentialForOwner` exist in `src/server/provider-credential.ts`. They're merged in (8c904ef5); if they're somehow missing, stop and report. Don't rebuild them here.
- **`d4h-access-token.ts`:** add `D4HCredentialRef = Omit<ProviderCredentialRef, "provider">`, `toD4HCredentialRef(token)` and `resolveD4HCredential(ref)`. The last one calls `getProviderCredentialForOwner({ provider: "D4H", ...ref })` + `toD4HAccessToken_ServerOnly`, and throws `NotConfiguredError` when that returns `null`.
- **Earlier plan:** under its `## Phase 2` heading, add one line saying it's taken over by this plan, with a link.

**Done when:**
- `d4h-access-token.test.ts` covers `resolveD4HCredential`: it resolves a matching org ref and a matching personal ref, and throws for another user's personal credential, for a personal credential referenced as an org one, for the reverse, and for a wrong organization.
  - Use `provider-credential.test.ts` as the template: `vi.hoisted` + `vi.mock("./prisma")` with `createMockPrisma()`, plus mocks for `next/cache` and `@/server/encrypt`.
  - `d4h-access-token.ts` imports `./cache/organization-settings`, so mock that too.
- `npm run check` passes.

**Note for this and the next task:** `"use cache"` is a no-op under Vitest, and in production an error thrown inside a cached body crosses the cache boundary through Flight. It arrives as a plain `Error`, and its message is redacted. The unit tests can't show that. No code or test may rely on the class or message of an error thrown inside a cached body. Callers already resolve the token through a scoped lookup before they reach a cached function, so `resolveD4HCredential` throwing in there is defence in depth, not the user-facing error path.

### - [ ] 2. Cached D4H functions take a credential reference

**Files:** `src/server/d4h-api/client.ts`, `src/trpc/routers/d4h-api-router.ts`, `src/trpc/routers/d4h-access-tokens-router.ts`, `src/server/services/d4h-team-sync.ts`, `src/forms/i3-issue-items/processor.ts`, pages under `src/app/(wrapper)/(authenticated)/orgs/[slug]/` (`i3/members`, `i3/equipment-kinds`, `d4h-views/teams`, `d4h-views/personnel`, `admin/d4h-access-tokens/[token_id]/{organisation,equipment-categories,equipment-items,equipment-kinds,equipment-locations,members}`); tests: `src/trpc/routers/teams-router.test.ts`, `src/trpc/routers/d4h-access-tokens-router.test.ts`. `src/trpc/routers/teams-router.ts` is likely unchanged: it passes the resolved token to `D4HTeamSync`, which converts.

**Do:**
- **`client.ts`:**
  - `fetchD4HWhoamiCached`, `getD4HTokenMetadata`, `getD4HTeamMembers`, `fetchD4HTeamDetailCached` and `fetchD4HOrganisationCached` take `ref: D4HCredentialRef` in place of `token`. Each calls `resolveD4HCredential(ref)` inside the cache scope, then `getD4HFetchClient(resolved)`. Tags stay `d4h-api-${ref.credentialId}-…`, and each keeps its explicit `cacheLife("hours")`.
  - Extract the uncached bodies: `fetchD4HWhoami(token)` and `computeD4HTokenMetadata(token, whoami)`. The cached versions call them. `getD4HTokenMetadata(ref)` loses its `options.whoami` parameter.
  - `getD4HTeamsAccessibleWithToken` and `getD4HTeamsWithMembers` (not cached themselves) take a ref too.
  - `fetchD4HTeamMembersForSync`, `fetchD4HMemberAttendance` and `getD4HFetchClient` stay on the resolved token. They aren't `"use cache"`.
  - **Auth seam (OAuth readiness):** add `getD4HAccessToken(credential): Promise<string>` in `d4h-access-token.ts`. For now it returns `credential.token`. `getD4HFetchClient` sets `Authorization` in an **async** `onRequest` that awaits it, instead of reading `token.token` directly. Add a doc comment on the accessor saying it's the one place the secret is read, and that an OAuth credential will refresh there.
  - **`validateD4HCredential(credential)`** (uncached): calls `fetchD4HWhoami`'s request, and returns `{ ok: response.ok, status: response.status, statusText: response.statusText, whoami?: D4HWhoami }` without throwing on a D4H rejection. On success it also returns `metadata` from `computeD4HTokenMetadata`.
- **Callers:** convert with `toD4HCredentialRef(token)` where they get the token, and keep the resolved `token` for `getD4HFetchClient` and the uncached fetches.
  - The three token mutations (`createOrganizationAccessToken`, `createPersonalAccessToken`, `refreshToken`) replace their inline `fetchClient.GET("/v3/whoami")` + `getD4HTokenMetadata(token, { whoami })` with `validateD4HCredential(token)`, keeping today's behaviour for a rejected token (Task 5 changes that). They validate a token that may not be saved yet.
  - `admin/d4h-access-tokens/[token_id]/organisation/page.tsx` calls `fetchD4HWhoamiCached` only to pass `{ whoami }`. Drop that call along with the option, and use `getD4HTokenMetadata(ref)`.
- **Test mocks:** `teams-router.test.ts` mocks `@/server/d4h-access-token` wholesale, so add `toD4HCredentialRef` to it, or the sync service's import is undefined. Update the `@/server/d4h-api/client` mocks to the new names and signatures.
- Behaviour doesn't change in this task. It's a refactor of what the cache key contains.

**Done when:**
- `grep -n 'D4HAccessToken_ServerOnly' src/server/d4h-api/client.ts` lists only the import, `getD4HFetchClient`, `fetchD4HWhoami`, `computeD4HTokenMetadata`, `validateD4HCredential`, `fetchD4HTeamMembersForSync` and `fetchD4HMemberAttendance`.
- The secret is read only inside `getD4HAccessToken` and `toD4HAccessToken_ServerOnly`: `grep -rnE '\b(token|accessToken|credential)\.token\b' src --include='*.ts' --include='*.tsx' | grep -v test` shows only those two.
- A test on `getD4HFetchClient` (mocking `fetch`) asserts the request carries `Authorization: Bearer <key>` via the accessor.
- Existing router and sync tests pass.
- `npm run check` passes.

### - [ ] 3. Invalidate D4H API caches on refresh and delete

**Files:** `src/server/d4h-api/client.ts`, `src/server/d4h-access-token.ts`, `src/trpc/routers/d4h-access-tokens-router.ts`, `src/trpc/routers/d4h-access-tokens-router.test.ts`.

**Do:**
- Every cached function in `client.ts` also calls `cacheTag(d4hApiCacheTag(ref.credentialId))`, where `d4hApiCacheTag = (id) => \`d4h-api-${id}\``. Keep the specific tags.
  - Inner tags already propagate to outer entries, so `provider-credential-${id}` covers part of this. The umbrella tag makes it explicit.
- Add `revalidateD4HApiCache(credentialId)` next to `revalidateD4HAccessToken` in `d4h-access-token.ts`. It calls `revalidateTag(d4hApiCacheTag(id), { expire: 0 })`, matching `provider-credential.ts`.
- Call it after the `$transaction` in `refreshToken`, `deleteOrganizationAccessToken` and `deletePersonalAccessToken`.
- `deletePersonalAccessToken` must also call `revalidateD4HAccessToken(existing.id)`. Personal refs now resolve through `fetchProviderCredential`, which is tagged by ID, and today only the personal-lookup tag is cleared.

**Done when:** the router tests assert `revalidateD4HApiCache` is called with the token ID after refresh and after both deletes, and `revalidateD4HAccessToken` after the personal delete. `npm run check` passes.

### - [ ] 4. Personal tokens: one per org, and a refresh mutation

**Files:** `src/trpc/routers/d4h-access-tokens-router.ts`, `src/trpc/routers/d4h-access-tokens-router.test.ts`, `src/trpc/messages.ts`, `src/client/d4h-access-tokens-effects.ts`.

**Do:**
- **`createPersonalAccessToken`:** before calling D4H, `findFirst({ where: { provider: "D4H", organizationId, userId } })`. If one exists, throw `TRPCError({ code: "CONFLICT" })` with a new `Messages` entry telling the user to remove the existing token first. (Under OAuth, reconnecting will update the existing row in place rather than conflict. That's the OAuth work's concern, not this guard's.)
- **Shared refresh helper:** extract the body of `refreshToken`, from the `validateD4HCredential` call through the `$transaction` with `ctx.logEvent`, into a module-level helper that takes `ctx` and the credential record. `refreshToken` calls it. Behaviour doesn't change here; Task 5 changes the helper once.
- **New `refreshPersonalAccessToken`:** `organizationProcedure({ organization: ["view"] })`, placed just before `refreshToken` (procedures are alphabetical, per `docs/conventions-checklist.md`).
  - Look up the caller's own personal token with `findFirst({ where: { provider: "D4H", organizationId, userId }, orderBy: { createdAt: "desc" } })`. The dev DB may already hold duplicates. `NOT_FOUND` if there's none.
  - Call the helper.
  - Then call `revalidatePersonalD4HAccessTokenForUser`, `revalidateD4HAccessToken` and `revalidateD4HApiCache`.
- **Effects:** add `refreshPersonalAccessToken` → invalidate `listPersonalAccessTokens` (unfiltered `queryFilter()`, since it's an `authenticatedProcedure` with no org input) and `getPersonalAccessToken({ organizationId })`.

**Done when:** tests cover a second create → `CONFLICT` (no D4H call, no insert), refresh with no token → `NOT_FOUND`, and refresh updating metadata and status and calling all three revalidators. `npm run check` passes.

### - [ ] 5. Reject bad tokens, check D4H responses, read live metadata

**Files:** `src/trpc/routers/d4h-access-tokens-router.ts`, `src/trpc/routers/d4h-api-router.ts`, `src/server/d4h-api/client.ts`, `src/trpc/routers/d4h-access-tokens-router.test.ts`.

**Do:**
- **Create mutations (org and personal):** if `validateD4HCredential` returns `ok: false`, throw `TRPCError({ code: "BAD_REQUEST" })` saying D4H rejected the token, including `response.status` (the number; `statusText` is often empty under undici/HTTP/2). Save nothing and log nothing.
- **Shared refresh helper (from Task 4):** on a failed whoami, write the new `status` and leave `metadata` as it is. On success, behave as today. The log entry's `diffObject` stays status-only.
- **`listEquipmentItems`:** check `error` and throw like its siblings do.
- **`getD4HTeamMembers`** (client.ts): check `response.ok` and throw like `fetchD4HTeamMembersForSync`.
- **`listEquipmentKinds`:** read `d4HTeams` from `getD4HTokenMetadata(toD4HCredentialRef(accessToken))`, not `accessToken.metadata`.

**Done when:**
- Tests cover create with a rejected token → `BAD_REQUEST` and no `providerCredential.create`, and a rejected token on **both** `refreshToken` and `refreshPersonalAccessToken` → status updated, metadata unchanged.
- `grep -n "accessToken.metadata" src/trpc/routers/d4h-api-router.ts` finds nothing.
- `npm run check` passes.

### - [ ] 6. i3 issue processor: fresh permission check, checked writes

**Files:** `src/forms/i3-issue-items/processor.ts`, new `src/forms/i3-issue-items/processor.test.ts`, `src/emails/i3-issue-items-notification.tsx`.

**Do:**
- **`CheckD4HAccessToken`:** use `getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId)`, which throws when the integration is disabled or the user has no token.
- **`CheckPermissions`:** use the uncached `fetchD4HWhoami(accessToken)` from Task 2.
- **`CreateEquipmentInD4H`:** check each `POST` response. Keep going past failures, since the items already created can't be rolled back.
  - Return `{ savedToD4H: true }` only if every item succeeded.
  - Otherwise return `{ savedToD4H: { reason } }`, with a reason that reads correctly after the email's existing "…has not been recorded in D4H due to ${reason}." For example: "D4H rejecting 1 of 3 items (first error: 422)".
  - If partial success makes that sentence untrue ("not been recorded" when some were), adjust the email's wording for that case.

**Done when:** `processor.test.ts` runs `I3IssueItemsFormProcessor.execute(...)` directly, with `createMockPrisma()` for `i3Template.findMany` and mocks for `@/server/d4h-access-token`, `@/server/d4h-api/client` and `@/server/email`. It covers:
- all creates succeeding → `true`
- one `POST` failing → a reason naming 1 of M
- no `Equipment.CREATE` permission → no `POST`
- integration disabled → the pipeline stops at `CheckD4HAccessToken`, with no `POST` and no email
- whoami read through `fetchD4HWhoami`, not the cached variant

`npm run check` passes.

### - [ ] 7. D4H Views reads with the viewer's personal token `visual`

**Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h-views/personnel/page.tsx`, `…/personnel/personnel-list.tsx`, `…/d4h-views/teams/page.tsx`, `…/teams/d4h-teams-list.tsx`.

**Do:**
- **Both pages:** replace the `settings.integrations.d4h.syncToken` + `getOrganizationD4HAccessToken` block with `getConfiguredD4HAccessToken(organization.id, UserId.schema.parse(session.user.id))`.
  - That handles a disabled integration or a missing personal token the same way the i3 pages do.
  - The `parse` is deliberate; `i3/members` casts instead.
  - Keep `requireOrganization` and the module-enabled check.
- **Personnel:** map to `{ id, name, status, team: { id, title } }` on the server, and drop the unused `teams` prop. Type the list's rows from `Pick<D4HMember, …>` plus `D4HTeamRef`, not a hand-rolled type.
- **Teams:** pass `{ id, title }` only.

**Done when:** `npm run check` passes. Then in the browser:
- As a user with a personal token, both pages list what that token can see.
- As a user without one, they show the same not-configured error the i3 pages show.
- In the personnel page's RSC payload (DevTools → Network, the document or `?_rsc=` response), search for a specific listed member's email address, or their email domain: it doesn't appear.

### - [ ] 8. Refresh button for personal tokens `visual`

**Files:** `src/components/user/user-settings/d4h-access-token-content.tsx`.

**Do:** add a "Refresh" `Button` in the header next to `UserSettings_D4HAccessToken_Menu`, calling `refreshPersonalAccessToken` with `organizationId: token.organization.id` and `meta: { effects: d4hAccessTokensEffects.refreshPersonalAccessToken }`. Use the same `toast.promise` messages as the org token page's `handleRefresh` (`admin/d4h-access-tokens/[token_id]/access-token-content.tsx`). No dialog is needed.

**Done when:** `npm run check` passes. On `/user/settings/d4h/access-tokens/<id>`, pressing Refresh shows the toast, and the page's status and teams update without a reload.

---

## OAuth readiness

D4H supports OAuth as well as API keys. AVUT will move to it once D4H has set us up, but nothing here builds it. The aim is that this plan leaves nothing to undo when that work starts.

**What this plan guarantees:**
- **Nothing is keyed on the secret.** Cache keys, tags, refs and `Team_D4H.linkTokenId` all use `credentialId`. An OAuth access token rotates every hour or so, so anything keyed on it would miss the cache or break links.
- **The secret is read in one place.** Every request's bearer value comes from `getD4HAccessToken(credential)` (Task 2). OAuth changes that function, not its callers.
- **Validation is one function.** `validateD4HCredential` (Task 2) serves the paste-a-key flow today and the OAuth callback later, which also needs whoami and metadata after the code exchange.
- **Cached D4H data is per credential.** Refreshing an access token doesn't change who the credential is, so the whoami and roster caches stay valid across refreshes. Reconnecting or replacing a credential is cleared with `revalidateD4HApiCache` (Task 3).

**What the OAuth work will have to do** (for its own spec, not this plan):
- **Token material.** Store the access token, refresh token and access-token expiry encrypted. Either keep them as an encrypted JSON blob in the `token` column, or add columns (a migration). Add a kind discriminator to the metadata with `.default("api-key")`.
- **Refresh inside the accessor.** When the access token is near expiry, `getD4HAccessToken` refreshes it and writes the new material back.
  - That write can happen inside a `"use cache"` body on a miss. That's allowed, but it has to be safe under concurrency: if D4H rotates refresh tokens, two parallel refreshes would invalidate each other. Use a row lock, or compare-and-swap on `updatedAt`.
  - A failed refresh sets `status` (e.g. "Reconnect required") the way a rejected key does now.
- **Connect flow.** The paste-a-key dialogs (`add-d4h-access-token-dialog.tsx`, the org `--create` page) become a "Connect D4H" redirect plus a callback route, per server code (`ap`/`eu`/`us`). Reconnecting updates the existing personal row rather than hitting Task 4's `CONFLICT`.
- **Revoke on delete.** Call D4H's revoke endpoint when a credential is deleted, if there is one.
- **`expiresAt`.** Today it's set 10 years out. Under OAuth it should mean the refresh token's expiry.
- **The org sync credential.** OAuth grants usually belong to a user, so work out whose grant the org credential is: a designated admin's, a service account's, or a client-credentials grant.

**Questions for D4H:**
- Which grant types are supported: authorization code with PKCE, client credentials?
- How long do access tokens and refresh tokens live? Are refresh tokens rotated on use?
- Is there a way to act for an organisation or team, rather than as one user?
- What scopes are there, and do they map to the existing per-team permissions that whoami reports?
- Are the authorize, token and revoke endpoints per region (`ap`/`eu`/`us`), like the API?
- Do `/v3/whoami` and the other endpoints behave the same with an OAuth token as with an API key?
- Can existing API-key users be migrated without re-consenting?

## Out of scope

- **D4H OAuth itself.** Only the seams above are in scope.
- **A unique index on personal tokens.** Decided against (no migration). The guard in Task 4 covers the UI path.
- **Masking the token input fields** and making `refreshToken` also invalidate `listOrganizationAccessTokens`. Not chosen this round.
- **Binding the ciphertext to the credential ID with GCM AAD.** Not chosen. It would need a re-encryption of existing rows, and it fits better with the key-rotation spec (`docs/specs/2026-09-29-db-encryption-key-rotation.md`).
- **React taint.** Still skipped, per the earlier plan's Phase 3.
- **Deleting personal tokens when a member leaves the org.** Still deferred, per the earlier plan.
- **The `DEVELOPMENT ONLY` token pages** get only Task 2's mechanical signature change. Their raw `fetchClient` calls are left as they are.
