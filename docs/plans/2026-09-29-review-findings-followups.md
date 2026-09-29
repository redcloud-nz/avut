# Implementation plan: Outstanding review findings, 2026-09-22 → 2026-09-28

**Date:** 2026-09-29
**Branch:** `fix/review-followups` (worktree `.claude/worktrees/review-followups`). It merges in
`chore/ship-workflow` and `fix/d4h-token-permissions`, which already held Phase 0. Phase 3 is
issues and checks, with no branch.
**DB:** no schema change. §3.1 _might_ need a data migration. If it does, `db:branch` first and
ask before running it.

## Status

- **Phase 0:** done on `fix/d4h-token-permissions` (828199e9), merged into this branch.
- **Phase 1:** done. §1.6's lookup is named `UserAccounts.getDeleted`.
- **Phase 2:** done, except:
  - §2.1's ID-brand decision is still open.
  - §2.7 is skipped. No component test mocks the tRPC client yet, so restoring the dialog test would introduce a new test pattern.
- **Deviation in §2.3:** `AsAdmin` goes only on a system-admin procedure that sits beside an org-scoped one doing the same job. Suffixing every system-admin procedure would add churn without clearing up any ambiguity. So only `importSkillPackage` → `importPackageAsAdmin` changed, and the rule is in `src/trpc/CLAUDE.md`.
- **Phase 3:** not started.

Every PR merged to `integration` between 2026-09-22 and 2026-09-28 (32 PRs, #249–#327). I
checked each `claude-avut` review finding against `origin/integration` at `cef534bd`. There
were no inline review comments; every finding is in a review body. A finding is left out of
this plan when a follow-up commit fixed it, a later PR fixed or replaced it, or the author
declined it with a reason on the PR. [Resolved and declined](#resolved-and-declined) lists
those.

This plan covers review findings only. Follow-ups that PR descriptions planned themselves
(provider-credential Phase 2, key rotation, the `skill-builder` rename, and so on) have
their own plans and issues.

---

## Phases

| Phase | PR  | Contents                                                                                |
| ----- | --- | --------------------------------------------------------------------------------------- |
| 0     | 1   | `integration` fails typecheck, and the D4H token pages 403 for everyone. **Ship first** |
| 1     | 2   | Behaviour fixes: permission/UI mismatch, owner race, error mapping, 500 → 404, guards   |
| 2     | 2   | Docs, comments, naming, and small cleanups (same PR as Phase 1, separate commits)       |
| 3     | —   | One data check and one issue to file                                                    |

---

## Phase 0: `integration` is red (from #326 × #327)

**Problem.** #327 added page checks on `requireOrganizationWith(slug, { d4hAccessToken: [...] })`
because #326 hadn't merged yet. Its PR body said: "Whichever PR merges second must move
these pages to `organization: ["update"]`." #326 merged second, four minutes later, and it
removed the `d4hAccessToken` resource. It moved the router to `organization: ["update"]` but
not these pages. So:

- The CI run on `integration` for the #326 merge **failed**, with 14 `TS2353` errors ("'d4hAccessToken' does not exist in type 'Permissions'").
- At runtime, `Roles[role].authorize()` fails an unknown resource, so every user gets the forbidden page on every `admin/d4h-access-tokens/**` page. Owners and admins included.
- Production is not affected yet: no release has been cut since.

**Fix.** Replace `{ d4hAccessToken: [...] }` with `{ organization: ["update"] }`. That's what
the matching `d4hAccessTokens` router procedures require (`d4h-access-tokens-router.ts`:
`create/delete/get/listOrganizationAccessTokens`, `refreshToken`).

- `orgs/[slug]/admin/d4h-access-tokens/page.tsx:23`
- `…/--create/page.tsx:23`
- `…/[token_id]/page.tsx:20, :35`
- `…/[token_id]/{equipment-categories,equipment-items,equipment-kinds,equipment-locations,members,organisation,whoami}/page.tsx`
- `src/trpc/routers/d4h-access-tokens-router.test.ts:225, :310, :355`: the test contexts' permission objects

Also grep for any `<Protect permissions={{ d4hAccessToken: … }}>` left over. tsc will catch
them.

**Check.** `npm run check -- --all` is green. As an admin, the token list and a token's
`whoami` page load. As a plain `member`, both are forbidden.

---

## Phase 1: Behaviour fixes

### 1.1 Recording UI doesn't match the new `skillCheck: ["create"]` gate (#326, re-review)

`upsertSessionSkillChecks` now requires `{ skillCheckSession: ["update"], skillCheck: ["create"] }`.
The recording grids still render on `isAssignedAssessor` alone. A `skills-admin` can add
itself as an assessor through session `update`, and then it gets a grid where every
debounced save fails with FORBIDDEN.

- `src/components/skill-track/session-by-person-content.tsx:159, :336`
- `src/components/skill-track/session-by-skill-content.tsx:168, :376`

**Fix.** `const canRecord = useHasPermission({ skillCheck: ["create"] })`, then
`when={isAssignedAssessor && canRecord}`. Add a fallback alert for an assigned assessor who
can't record: "You're an assessor on this session but your role can't record checks." Don't
filter the assessor pickers. The reviewer rated that as harder, and it isn't needed.

### 1.2 `removeOrganizationMember` can still orphan an org (#326, re-review)

`removeOwner` runs `assertNotLastOwner` inside a `Serializable` interactive transaction.
`removeOrganizationMember` (`organizations-router.ts:483`) still checks outside any
transaction and then deletes in an array `$transaction`. SSI only protects serializable
transactions from each other. So "A removes B's membership" racing "B removes A's
ownership" can still leave the org with no owners.

**Fix.** Add a helper beside `assertNotLastOwner`:

```ts
/** Run `fn` in a Serializable transaction, after checking `userId` isn't the org's last owner. */
async function withOwnerGuard<T>(ctx, userId, fn: (tx) => Promise<T>): Promise<T>;
```

Both `removeOwner` and `removeOrganizationMember` use it. `removeOrganizationMember`
switches to the interactive form: `tx.organizationUser.delete` plus `ctx.logEvent(…, tx)`.
It keeps the "only guard when the membership holds `owner`" short-circuit. Check whether any
other path removes or demotes an owner (`setOrganizationMemberRole` preserves `owner`, so it
shouldn't need to).

### 1.3 Map `P2034` (serialization failure) to `CONFLICT` (#326, re-review nitpick)

When Postgres aborts the transaction that lost the race, Prisma throws `P2034` and the
dialog shows a generic 500. Retry the transaction once inside `withOwnerGuard` (1.2). On the
retry, the last-owner check fails and gives its proper message. If the retry also hits
`P2034`, throw `CONFLICT`: "Another ownership change happened at the same time — try again."
Keep this inside the helper rather than in `mapDomainErrors`. It's the only serializable
path, and a global mapping would hide unrelated `P2034`s.

**Tests.** The helper retries once on `P2034` and then throws `CONFLICT` (mock the
transaction to reject with a `PrismaClientKnownRequestError` whose `code` is `P2034`).
`removeOrganizationMember` still refuses the last owner.

### 1.4 A personal credential ID returns 500, not 404 (#327)

`getOrganizationProviderCredential` (`src/server/provider-credential.ts:65`) returns `null`
for every mismatch except `userId`, where it throws `Error("Not an organization credential")`.
Personal tokens carry the organization's ID too. So an admin who opens
`/admin/d4h-access-tokens/<personal-id>/whoami` passes every earlier check and gets a 500.
The router already treats personal IDs as `NOT_FOUND`.

**Fix.** `if (record.userId) return null;`. Add a test beside the group-owned and other-org
cases in `provider-credential.test.ts`.

### 1.5 An archived team can be linked to D4H (#270)

`linkTeamToD4H` (`teams-router.ts:456`) doesn't check `team.status`. `applyD4HTeamSync`,
`planD4HTeamSync` and `createTeamMembership` all refuse an archived team. The team menu offers
"Link to D4H" on `!linked` alone (`team-menu.tsx:118`). An admin can therefore put an
archived team into an archived-and-linked state that sync then refuses to touch.

**Fix.** Do both. The router refuses an archived team with the same error shape as the other
guards (`ValidationError` from the service if the check lives in `D4HTeamSync`). The menu
item requires `!linked && isActive`. Add a router test.

### 1.6 `getAccountClosure` loads every deleted user (#315)

`user-router.ts:245` calls `UserAccounts.listDeleted(ctx.prisma)` and filters the result
for the caller. That's every deleted user, with a `logEntry` lookup for each, on every load
of `/auth/account-closed`.

**Fix.** Add `UserAccounts.getDeletionInfo(prisma, userId)` in
`src/server/services/user-accounts.ts`. It returns `{ purgeAt } | null` and reuses the same
`purgeAt` derivation `listDeleted` uses (factor that out, don't copy it). Existing
`getAccountClosure` tests cover the behaviour. Add one service test.

### 1.7 D4H link toast hides rubbish-bin skips (#312)

`d4h-link-card.tsx:207` reports "N skipped" with no reason. The sync dialog separates
`missing-email` skips from `person-in-rubbish-bin` skips, and a rubbish-bin skip needs the
admin to act. **Fix.** When any skip has `reason === "person-in-rubbish-bin"`, name it:
"…, 2 skipped (1 in the Rubbish bin — recover or delete them forever, then sync)". Keep the
plain suffix otherwise.

---

## Phase 2: Docs, comments, naming

Each is small. Group them into a few commits by area.

### 2.1 Provider-credential schema tidy (#327)

- **Duplicate metadata shape.** `providerCredentialMetadataSchema`'s D4H member (`src/lib/schemas/provider-credential.ts:36-63`) repeats `D4HProviderMetadata.schema` (`d4h-access-token.ts:69`) field for field. Use `z.discriminatedUnion("provider", [D4HProviderMetadata.schema])`. There's no runtime cycle: `d4h-access-token.ts` only imports a type from `provider-credential.ts`. Confirm `D4HProviderMetadata.schema` carries `provider: z.literal("D4H")`. If it doesn't, `.extend` it here.
- **Unused public shape.** `ProviderCredential.schema`/`.fromRecord` and `ProviderCredentialMetadata` have no callers outside their own file. Keep them, and add a one-line comment: "the generic shape the next provider uses; D4H reads through `D4HAccessToken.fromRecord`".
- **Two ID brands.** Rows are created with `D4HAccessTokenId` and read back through `ProviderCredentialId` helpers. **Decision needed:** make `ProviderCredentialId` canonical, with `D4HAccessTokenId` as an alias of it (recommended), or keep both. Record the choice in the comment above `ProviderCredentialId`.

### 2.2 Stale references after the router split (#321)

- `docs/patterns/transactional-writes.md:63`: `skills-router.ts`'s `deleteSession` → `skill-check-sessions-router.ts`'s `deleteSession`.
- `docs/patterns/transactional-writes.md:155`: `system-admin-router.ts`'s `deleteUser`. That router is gone, and #315 turned `deleteUser` into a soft delete. The hard delete with a `scope: "system"` entry is now `UserAccounts.purge` (`src/server/services/user-accounts.ts:218`). Point at that, and check that the surrounding sentence still describes it accurately.
- `src/trpc/routers/skill-checks-router.ts:110`: `skills.listAssessableSkills` → `skillPackageSubscriptions.listAssessableSkills`.
- `src/components/admin/organization-settings/organization-settings-form.tsx`: restore the JSDoc the move dropped. It explained that the form is a stack of independently saved cards, each with its own save button, and documented the `moduleFlags` prop.

### 2.3 System-only procedures in shared routers (#321)

`skillPackageBuilder.importPackage` (org-scoped) and `.importSkillPackage` (system admin, any
target org) sit side by side, and nothing in their names tells them apart. `organizations`
already uses `getOrganizationAsAdmin`.

**Decision (recommended):** every `systemAdminProcedure` that lives in a domain router takes
an `AsAdmin` suffix. Rename `importSkillPackage` → `importPackageAsAdmin`. Its callers are
`skill-package-import-content.tsx` (×2), `import-plan-table.tsx`'s comment and the router
test. Then apply the same rule to `organizations.listOrganizations`, `users.listUsers`,
`users.getUser` and the rest of the former `systemAdmin` procedures, or state the exception
if one is really system-only by nature. Add the rule to `src/trpc/CLAUDE.md`.

If that rename is more churn than you want now, just do `importPackageAsAdmin` and file the
rest.

### 2.4 `system-router.ts` exists only for `health` (#321)

`health` is used only by `system-router.test.ts`, to test the `systemAdminProcedure` gate.
**Recommended:** run that gate test against `users.listUsers` and remove `systemRouter` from
`_app.ts`. Keep it only if you want it as a home for future domain-less system procedures.

### 2.5 Small doc comments

- `teams-router.ts:26`: `teamMembershipRowSchema`'s JSDoc should also list `getTeamMembershipById` (#310).
- `src/server/services/skill-packages.ts:80`: `requirePackageById` needs the same "local literal, not `Messages.skillPackageNotFound`" note that `requireSkillById`/`requireGroupById` have (#288).
- `src/server/auth-hooks/deleted-user-plugin.ts:79`: add a comment that `total` is adjusted only for deleted members on _this page_, so it drifts if `list-members` is ever paginated (#315). No code change until pagination exists.

### 2.6 Workflow docs

- **`.claude/skills/avut-release/SKILL.md:82`** (#252): `git commit -am` doesn't stage the new `docs/releases/v$NEW.md`, so the workflow's "Require release notes" step fails. Add `git add docs/releases/v$NEW.md` (and `docs/version-names.md` when the codename changes) before the commit.
- **Conventions checklist** (#249): the non-entry-file case of "a Server Component must import `trpc` from `@/trpc/server`" was dropped as "enforced by ESLint". The lint rule only covers Next entry files, and AGENTS.md says "any other Server Component is on you". On `chore/ship-workflow` the checklist is now `docs/conventions-checklist.md` (line 16 lists only the entry-file case). Add a residual item there: "a non-entry Server Component that imports `@/trpc/client`". Make this edit on `chore/ship-workflow`, or after it merges, not on the Phase 1 branch.

### 2.7 Optional: ban dialog component test (#314)

`ban-user-dialog.test.tsx` was deleted without a replacement. Router tests cover the
mutation. What's untested is the dialog shell: the trimmed reason, and unban having no
reason field. It's cheap to restore against `src/components/system/admin/users/ban-user-dialog.tsx`.
Skip it if time is short.

---

## Phase 3: Checks and tracking (no code)

### 3.1 Misspelled D4H metadata key in existing rows (#327)

Before #327, `createPersonalAccessToken`'s fallback wrote `d4HOrganizations` (misspelled)
when `/v3/whoami` returned no data. Such rows fail `D4HProviderMetadata.schema.parse`. They
were already unreadable before #327, and there may be none.

- Run a read-only query against the dev DB and, before the next release, against production:
  `SELECT id FROM provider_credentials WHERE metadata ? 'd4HOrganizations';`
- If it finds rows, add a **new** data migration (don't edit `20260928040000_…`, which is already applied to shared `avut`):
  `UPDATE provider_credentials SET metadata = (metadata - 'd4HOrganizations') || jsonb_build_object('d4HOrganisations', coalesce(metadata->'d4HOrganizations', metadata->'d4HOrganisations', '[]'::jsonb)) WHERE metadata ? 'd4HOrganizations';`
  `db:branch` first, and ask before `migrate dev`.
- If it finds none, record that here and close the item.

### 3.2 File an issue: no recovery path for an ownerless org (#326)

`makeOwner` is owner-only, and system admins can no longer assign `owner` through the role
picker. If an org loses its last owner (for example, the account is purged), only a manual
DB edit fixes it. The author deferred this on the PR, but it isn't tracked yet. The only
related issue is #5, which is about leave-org error feedback. Proposed fix: give `makeOwner`
`{ allowSystemAdmin: true }`, plus a "Make owner" action on the system-admin org screen.

---

## Resolved and declined

These review findings need no work.

| PR                                      | Finding                                                                                     | Status                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| #326                                    | `skills-admin` lacks `person`/`team` view (blocking)                                        | Fixed in 98b35a57                                                                                                                |
| #326                                    | `owner` hidden or shown raw in role displays                                                | Fixed in 98b35a57                                                                                                                |
| #326                                    | `skills-admin` can record checks (server)                                                   | Fixed in 98b35a57. UI side is §1.1                                                                                               |
| #326                                    | `removeOwner` race                                                                          | Fixed in 98b35a57. `removeOrganizationMember` side is §1.2                                                                       |
| #326                                    | Deploy impact on existing admins/owners                                                     | Declined: `member` only adds `d4hEquipment:view`, which has no production users                                                  |
| #326                                    | `hasOwnerRole` ×3, self "Remove owner", sidebar comment, module helper, JSDoc               | Fixed in 98b35a57                                                                                                                |
| #321                                    | PR description misdescribes the settings-form change                                        | Moot once merged                                                                                                                 |
| #315                                    | `setUserRole` doc comment, `Promise.all` in the purge cron                                  | Fixed in b4a7c230                                                                                                                |
| #314                                    | Resend-OTP unhandled rejection                                                              | Fixed in 9d3b11a3                                                                                                                |
| #314                                    | Invitation `status` enum can fail `listInvitations`                                         | Flagged only. Better Auth writes just these four values. No action                                                               |
| #313                                    | `PurgeDialog` stuck on "Deleted"; non-constant-time bearer check                            | Fixed in 6c2a60aa, f19dc31d                                                                                                      |
| #306                                    | Double fetch after delete/restore; router-local `getI3TemplateOrThrow`                      | Fixed in 4c464312                                                                                                                |
| #305                                    | Archive resurrects Deleted rows (blocking); router order; `entityIdByType`                  | Fixed in 951bea71                                                                                                                |
| #305                                    | `restoreSkill` docstring still mentions Deleted                                             | Fixed in #311                                                                                                                    |
| #304                                    | Re-add after soft delete conflicts; skill-check scope includes Deleted                      | Fixed in cbeff67a                                                                                                                |
| #304                                    | `getTeamMembership`/`updateTeamMembership` show Deleted rows                                | Fixed in #312                                                                                                                    |
| #304                                    | Non-null assertions in `trash-list.tsx`; "no Archived state" note                           | Superseded: #313 rewrote the list over the registry; PR note moot                                                                |
| #302                                    | Self-triggered dialog unmounts; reset deps; "Reject" label                                  | Fixed in ddafada6                                                                                                                |
| #301                                    | Dead `TeamMembershipLink`/`UserRef`; `Pick<>` instead of `Ref`                              | Fixed in cab321a2                                                                                                                |
| #300                                    | Sessions stat card under the wrong `<Protect>` (blocking)                                   | Fixed in 728d9c2a                                                                                                                |
| #290                                    | `listTrash` not invalidated; no prefetch; team menu Delete; nav gate                        | Fixed in 6fb81c53, 9e7b8ebe                                                                                                      |
| #290                                    | Follow-up issue for a partial unique index on `Person.email`                                | Superseded: #312 decided email stays unique across the bin                                                                       |
| #280, #277, #276, #275, #274, #271      | Stale doc refs, `Teams.find` naming, missing service tests, dead re-export, `Messages` note | Fixed in #288 (except the one `requirePackageById` note, §2.5)                                                                   |
| #273                                    | `Forms.saveInstance` writes no audit entry                                                  | Declined in #288: it's the draft autosave path. Needs a product decision, not a cleanup                                          |
| #270                                    | (Everything except `linkTeamToD4H`)                                                         | n/a. `linkTeamToD4H` is §1.5                                                                                                     |
| #269                                    | Sidebar-state cookie removed (blocking)                                                     | Declined: intentional                                                                                                            |
| #269                                    | Sequential `fetchQuery`; `userConfig` cleanup; timezone double-fire                         | Fixed in d98efcfa                                                                                                                |
| #255                                    | Unprotected stat cards (blocking); `cn()`; duplicate query; `w-14`                          | Fixed in 27af90c6, a482e993; `listSessions` inconsistency filed as #256, fixed by #300                                           |
| #252                                    | `sync-integration` race note in `releasing.md`                                              | Superseded: auto sync-back can't bypass the `integration` ruleset at all, so it's done by hand each release (tracked separately) |
| #251, #267, #303, #310 (bar §2.5), #311 | No findings                                                                                 | —                                                                                                                                |
