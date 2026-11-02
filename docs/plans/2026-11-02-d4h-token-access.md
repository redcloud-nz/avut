# D4H access tokens: org token management and read-only access

**Date:** 2026-11-02
**Issue:** [#446](https://github.com/redcloud-nz/avut/issues/446) (v0.13 - nucula)
**Branch:** `feat/d4h-token-access`, worktree `.claude/worktrees/d4h-token-access`
**DB:** adds a migration. Run `npm run db:branch d4h_token_access` before Task 1's `migrate dev`.
**Written against:** integration @ b57edcdf

Org D4H access tokens get the same management as personal tokens (add in a dialog, edit, replace the value, delete), and every token gets an **Access** level that the D4H fetch client enforces: a read-only token can't send anything but `GET`/`HEAD` to D4H.

## Decisions

1. **A plain enum column, not a `restrictions` JSON column.** `ProviderCredential.access` of type `ProviderCredentialAccess { ReadOnly, ReadWrite }`, default `ReadOnly`, so a future writer that forgets it (group-owned credentials, avut-ideas#18) lands on the safe side. It sits outside `metadata`, which `refreshD4HCredential` rebuilds from D4H. The later "allowed uses" and "allowed teams" ideas (issue §3) can add their own columns when they come.
2. **Existing org tokens become read-only in the migration.** Nothing writes to D4H with an org token today: the only writes (I3 issue's `POST` in `src/forms/i3-issue-items/processor.ts`, and the equipment `PATCH` in `src/server/d4h-api/equipment.ts`) use the member's personal token through `getConfiguredD4HAccessToken`. So the column default puts every org token on the safe side with no change in behaviour, and the migration sets `access = 'ReadWrite' WHERE "userId" IS NOT NULL` so personal tokens keep writing. An admin can switch an org token to read and write in Edit.
3. **Access is an org-token setting only.** Personal tokens stay `ReadWrite` and have no Access control in the UI: I3 needs them to write, and they're the member's own. The detail page shows their access as read-only text. The router rejects `access` on personal-token procedures by not accepting it.
4. **Enforced once, in `getD4HFetchClient`'s `onRequest`, failing closed.** Unless `access === "ReadWrite"`, any method other than `GET` or `HEAD` throws a `ForbiddenError` ("<label> is read only in AVUT; it can't make changes in D4H.") before the request leaves AVUT. `D4HAccessToken_ServerOnly` carries `access`, so every path that builds one (`toD4HAccessToken_ServerOnly`, the create procedures' pre-save validation) sets it.
5. **Replace token value keeps the credential id,** so the `modules.d4h-nag.d4hTokenId` setting (and the informational `Team_D4H.linkTokenId` / `Organization_D4H.syncTokenId` pointers) keep pointing at it. It validates the new value with `validateD4HCredential` (a token D4H rejects is never saved, as on create), then writes the encrypted value, status and fresh metadata. It never decrypts the stored value, so it works on a token whose stored value no longer decrypts ("Decrypt Error"). The server code doesn't change; a token for another D4H server is a new token. The new value may belong to a different D4H member; no check that it still reaches the D4H teams the old one did (Out of scope).
6. **Edit changes the label (and, for org tokens, Access).** Personal tokens can edit their label too, as the issue asks, though it's generated on create; the personal detail page gains a Label row so the edit is visible.
7. **Delete of an org token** uses the existing `deleteOrganizationAccessToken`. The confirm dialog says what happens: the token is removed from AVUT but not revoked in D4H, and D4H Attendance Reminders stops until another token is chosen. (Team links don't depend on org tokens: `Team_D4H.linkTokenId` is informational and only ever set from a personal token.)
8. **The `--create` page goes.** Its route folder and `create-d4h-access-token.tsx` are deleted; the list page gets an **Add Access Token** dialog, with **Access** defaulting to _Read only_.
9. **Audit.** Every new mutation pairs its write with `ctx.logEvent` in a `$transaction`. A token value change is logged as `{ type: "obj_mask", path: ["token"] }`, never the value.
10. **No-token case:** this feature manages the tokens themselves; the lists already have empty states, and nothing here depends on a token being configured.

## Tasks

### Review group A: data layer

- [x] **Task 1: `access` column and its plumbing.** _feat(d4h): add access level to provider credentials_
  - **Files:** `prisma/schema.prisma`, new migration, `src/lib/schemas/provider-credential.ts`, `src/lib/schemas/d4h-access-token.ts`, `src/server/d4h-access-token.ts`, `src/server/provider-credential.ts`, `src/trpc/routers/d4h-access-tokens-router.ts` (the two `satisfies D4HAccessToken_ServerOnly` objects only), test fixtures that build these shapes.
  - **Do:** Add `enum ProviderCredentialAccess { ReadOnly ReadWrite }` and `access ProviderCredentialAccess @default(ReadOnly)` on `ProviderCredential`, with a `///` comment pointing at `getD4HFetchClient`. `npm run db:branch d4h_token_access` first if not done; `npm run prisma migrate dev --create-only --name provider_credential_access` (permission needed), then append Decision 2's `UPDATE` to the generated SQL and apply it. Add a `ProviderCredentialAccess` zod schema (`z.enum(["ReadOnly", "ReadWrite"])`) in `provider-credential.ts` and an `access` field to `ProviderCredential`, `ProviderCredential_ServerOnly`, `D4HAccessToken` and `D4HAccessToken_ServerOnly`, **required, with no `.default()` or `.optional()`**, so a missed thread-through fails to typecheck rather than quietly picking a value. Thread it through `toD4HAccessToken_ServerOnly` and `fromRecord`, and update every test fixture that builds these shapes (`git grep -l 'serverCode:' -- '*.test.ts'`, about 20 files). The create procedures' pre-save token objects and stored rows set `access` explicitly (org: `ReadOnly` for now, until Task 3 takes it as input; personal: `ReadWrite`).
  - **Done when:** `npm run check` passes; `prisma migrate status` on the branch DB is clean; existing org tokens on the branch DB read `ReadOnly` and personal ones `ReadWrite`.

- [x] **Task 2: enforce read-only in the fetch client.** _feat(d4h): enforce read-only access in the D4H fetch client_
  - **Files:** `src/server/d4h-api/client.ts`, `src/server/d4h-api/client.test.ts`, `src/trpc/messages.ts`.
  - **Do:** In `onRequest`, before setting `Authorization`, throw `ForbiddenError` (from `@/lib/errors`) when `token.access !== "ReadWrite"` and `request.method` isn't `GET` or `HEAD` (fail closed). The message goes in `Messages` in `src/trpc/messages.ts`, next to `d4HAccessTokenRejected` (`src/server` already imports `src/trpc`, e.g. `trpc-context.ts`). Update the JSDoc on `getD4HFetchClient` to say it's the one enforcement point.
  - **Done when:** tests show a read-only token's `GET` goes out, its `POST`/`PATCH`/`DELETE` throw `ForbiddenError` without `fetch` being called, and a read-write token's `POST` goes out.

- [x] **Task 3: org token procedures.** _feat(d4h): add org token update and replace procedures_
  - **Files:** `src/trpc/routers/d4h-access-tokens-router.ts`, its test, `src/client/d4h-access-tokens-effects.ts`, `src/trpc/messages.ts` if new messages are needed.
  - **Do:**
    - `createOrganizationAccessToken` takes `create.access` (`ProviderCredentialAccess.schema`), stores it, and includes it in the audit diff.
    - New `updateOrganizationAccessToken` (`organization: ["update"]`): input `{ tokenId, patch: { label?, access? } }`; scoped like `refreshToken` (`userId: null`); `$transaction` of the update and `logEvent` `Update` with `diffObject`. Revalidate `revalidateD4HAccessToken` (the credential cache carries `access`).
    - New `replaceOrganizationAccessToken` (`organization: ["update"]`): input `{ tokenId, token }`. Extract a shared `replaceD4HCredentialValue(ctx, record, newValue)` beside `refreshD4HCredential`. It must **not** decrypt the stored value (so not `toServerOnlyD4HAccessToken(record)`, which calls `decryptDBValue`): build the `D4HAccessToken_ServerOnly` from the record's plain fields, `D4HProviderMetadata.schema.parse(record.metadata)` and the new value. Then `validateD4HCredential`, `credentialRejectedError` if not ok, then `$transaction` of update (`token: encryptDBValue`, `status`, `metadata`) and `logEvent` `Update` with the masked token change plus the status diff, description "Replaced the D4H access token value." Revalidate the credential and API caches.
    - Keep procedures alphabetical. Effects: `create…` (exists), `update…` and `replace…` invalidate `listOrganizationAccessTokens` and that token's `getOrganizationAccessToken`; add `deleteOrganizationAccessToken` (the list, plus the organization-settings query the d4h-nag settings card reads, since delete removes the `modules.d4h-nag.d4hTokenId` and `integrations.d4h.syncToken` settings).
  - **Done when:** router tests cover each new procedure: permission, other-org/personal token is `NOT_FOUND`, audit entry written in the transaction, token never in the log, rejected value saves nothing, and Replace succeeds when the stored value can't be decrypted; `npm run check` passes.

- [x] **Task 4: personal token procedures.** _feat(d4h): add personal token update and replace procedures_
  - **Files:** as Task 3.
  - **Do:** New `updatePersonalAccessToken` (label only) and `replacePersonalAccessToken` (`organization: ["view"]`, scoped to the caller like `refreshPersonalAccessToken`), reusing `replaceD4HCredentialValue`. Revalidate as `refreshPersonalAccessToken` does. Effects mirror `refreshPersonalAccessToken`'s.
  - **Done when:** router tests: another user's token is `NOT_FOUND`, audit written, value masked; `npm run check` passes.

### Review group B: UI (visual checkpoint after Task 7)

- [x] **Task 5: Admin index entry and the Add dialog.** `visual` `mechanical`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/page.tsx`, `src/modules/org-admin/components/d4h-access-tokens/d4h-access-tokens-list.tsx`, new `add-d4h-access-token-dialog.tsx` there, delete `d4h-access-tokens/--create/` and `create-d4h-access-token.tsx`, anything linking to `--create` (`git grep -- --create`).
  - **Do:** Uncomment the Admin index entry. Build the org Add dialog following `docs/patterns/mutation-dialog.md`, modelled on `src/modules/user-settings/components/add-d4h-access-token-dialog.tsx`, with Label, Server, Token and **Access** (_Read only_ default, _Read and write_; a description under it: "Read only stops AVUT from making any change in D4H with this token."). On success, navigate to the new token's page. Add an **Access** column to the list (labels "Read only" / "Read and write"), placed after Label.
  - **Done when:** `npm run check` passes; the index entry, list column and dialog render (self-check).

- [x] **Task 6: org token action menu.** `visual` `mechanical`
  - **Files:** `src/modules/org-admin/components/d4h-access-tokens/access-token-content.tsx`, new `d4h-access-token-menu.tsx`, `edit-d4h-access-token-dialog.tsx`, `replace-d4h-access-token-dialog.tsx`, `delete-d4h-access-token-dialog.tsx` there.
  - **Do:** Add an `EntityActionMenu` to the detail header, as `src/modules/user-settings/components/d4h-access-token-menu.tsx` does, with Edit, Replace token value, Delete, driven by `?action=` per `mutation-dialog.md` and gated per `docs/patterns/protect-permission-gating.md` (`organization: ["update"]`). Edit: Label and Access. Replace: one Token field, explaining the id and links are kept. Delete: `AlertDialog` with Decision 7's wording; on success go to the list. Show **Access** in the detail card's `DataList`, after Label.
  - **Done when:** `npm run check` passes; each dialog opens, submits and closes (self-check).

- [ ] **Task 7: personal token Edit and Replace.** `visual` `mechanical`
  - **Files:** `src/modules/user-settings/components/d4h-access-token-menu.tsx`, `d4h-access-token-content.tsx`, new `edit-d4h-access-token-dialog.tsx` and `replace-d4h-access-token-dialog.tsx` in `src/modules/user-settings/components/`.
  - **Do:** Add Edit (label) and Replace token value to the personal menu, before Remove, with dialogs like Task 6's. Add Label and Access ("Read and write") rows to the personal detail page's `DataList`; today it shows neither, so a label edit would be invisible.
  - **Done when:** `npm run check` passes; both dialogs work on `/user/settings/d4h/…` (self-check).

## Docs impact

Org D4H access tokens are added in a dialog, can be edited, have their value replaced and be deleted, and have a Read only / Read and write Access setting; personal tokens gain Edit and Replace token value. Pages: `content/docs/d4h/index.mdx`, `content/docs/admin/organization.mdx`, `content/docs/account/index.mdx`. Screenshots: any of the token list or create page, if those pages use them.

## Out of scope

- Allowed uses and allowed teams (issue §3).
- Warning when a feature that needs write access is given a read-only token. No feature needs one yet; d4h-nag stage 2 will be first.
- Checking that a replacement value still reaches the D4H teams the old value reached.
- An Access setting on personal tokens.

## Parked

## Review notes

- Group A: `src/server/d4h-api/client.ts` imports `Messages` from `@/trpc/messages`, which points the layering the wrong way (`src/server/services/skill-checks.ts:173` keeps a local literal for this reason). Inline the read-only message in `client.ts` as `skill-checks.ts` does, and drop `Messages.d4HAccessTokenReadOnly` if nothing else uses it.
- Group A: `updateOrganizationAccessToken` / `updatePersonalAccessToken` accept an empty `patch` (a no-op write plus an empty log entry) and a blank label. Use `label: z.string().min(1).optional()` and reject an empty patch (`.refine` on `patch`).
