# Open Issues

Known code-level follow-ups not yet filed as GitHub issues — the holding pen for
recognised debt that's too small or too internal for a real issue. Delete an
entry in the PR that resolves it. For anything user-facing or cross-cutting,
file a GitHub issue (`redcloud-nz/avut`) or an entry under `docs/ideas/` instead.

## Teams

- [ ] The team actions menu (`src/components/admin/teams/team-menu.tsx`) only
      has **Delete** and the D4H group — it should also offer **Edit** and
      **Archive** actions.

- [ ] `AdminModule_Teams_ImportTeamFromD4H_Dialog`
      (`src/components/admin/teams/import-team-from-d4h.tsx`) — the one-step
      "create an AVUT team from a D4H team" flow behind `createTeamFromD4H` — is
      defined but mounted nowhere, on this branch and on `integration` alike. So
      `createTeamFromD4H` has no UI: the only reachable path is to create a team
      first, then use the team menu's **Link to D4H**. Either mount it (the teams
      list is the natural home, beside **New Team**) or delete both it and the
      procedure. Found while browser-testing the D4H import, 2026-09-15.

- [ ] **Link to D4H gives no feedback when the user has no personal D4H token.**
      The dialog (`src/components/admin/teams/d4h-link-card.tsx`) opens
      unconditionally and swallows the query error —
      `const { data: availableTeams = [] } = useQuery(...)` never reads `isError`
      or `error`, and there is no `QueryCache.onError` in `makeQueryClient`. So
      `listTeamsAccessibleToUser` throwing `NOT_FOUND "No personal D4H Access
      Token found for user"` surfaces as a disabled, empty "Select a D4H team"
      dropdown and a disabled **Link & sync** button, after ~3 default retries of
      dead air — indistinguishable from "your token works but sees no teams".
      `AdminModule_Teams_ImportTeamFromD4H_Dialog` has the identical swallow. The
      **Sync** dialog on the same card does this right: it renders
      `planQuery.error.message`. While fixing, note the token lives at
      `/orgs/[slug]/admin/d4h-access-tokens`, so `getConfiguredD4HAccessToken`'s
      "Please create one in your account settings" misdirects, and the
      team-path messages give no location at all. Also worth saying in the UI
      that the token is always the **acting user's** — a second admin cannot sync
      a team the first admin linked until they add their own.

- [ ] **The D4H team link/sync procedures don't check
      `integrations.d4h.enabled` server-side.** `linkTeamToD4H`,
      `planD4HTeamSync`, `applyD4HTeamSync` and `unlinkTeamFromD4H`
      (`src/trpc/routers/teams-router.ts`) gate only on `team: ["update"]`, and
      `d4hApi.listTeamsAccessibleToUser` reaches for
      `getPersonalD4HAccessTokenForUser` directly. Every other procedure in
      `d4h-api-router.ts` takes its token from `getConfiguredD4HAccessToken`,
      which throws `NotConfiguredError` when the integration is off. So turning
      D4H off hides the menu group and the card but leaves the whole team-link
      path callable. Either route these through a settings check too, or decide
      deliberately that the org setting is presentation-only and write that down.

## Skill Track

- [ ] Skill package **unsubscribe** should be treated as a destructive action —
      appropriately styled/placed button, ideally a confirm dialog. It will later
      delete package customisation, which is unrecoverable.
- [ ] The skill package catalogue page shows `Skills` in the breadcrumbs; it
      should be `Skill Track` (the module label).

## Personnel / people

- [ ] Person↔user linking should be reachable from **both** the person detail
      page and the user detail page (currently only one direction).
- [ ] The person picker in "link person" (`src/components/admin/users/link-person.tsx`)
      appears not to work — investigate.
- [ ] Allow adding a person to a team directly from the personnel page.
- [ ] Person archive and restore should go through confirm dialogs rather than
      firing direct mutations.
- [ ] Person **delete** should be available for an already-archived person.

- [ ] A **soft-deleted person is silently adopted by a D4H team import**. Neither
      `getPersonByEmail` nor the `allPeople` read in `fetchD4HSyncInputs`
      (`src/trpc/routers/teams-router.d4h.ts`) filters on `status`, and
      `deletePerson` soft-deletes anyone referenced by a skill check. So importing
      a D4H team containing that email finds the `Deleted` row, skips creating a
      person (and therefore never auto-links them), and gives them an **Active**
      team membership while the person record stays `Deleted`. Deleting a person
      through the UI also does not free their email for re-import. *Found by
      reading the code while testing the import on 2026-09-15 — not reproduced in
      a run, so confirm before fixing.*

## Organizations

- [ ] `writeOrganizationSettings` (`src/server/organization-settings-store.ts`) never deletes an
      `OrganizationConfig` row, so a leaf set back to its default keeps a row holding that default.
      It upserts every leaf whose value differs from the _resolved_ existing settings, which is
      right on the way out from a default but not on the way back — the module's own doc comment
      ("a config-less organization only materialises the leaves that differ from the defaults")
      holds for the first write and is not maintained afterwards. The cost is not the extra row:
      an explicitly stored default silently **pins** that org if the default ever changes, so orgs
      that once toggled a setting and reverted it diverge from orgs that never touched it. Deleting
      a leaf whose new value equals the default would restore the stated invariant.

- [ ] `OrganizationUser` (`src/lib/schemas/organization-user.ts`) conflates two different
      records — the org membership row (`organization_users`) and its joined `User` row —
      into one schema. That's why `requireOrganization`/`getMyRoles` fetch roles via a
      separate, narrower `getOrganizationUserRoles` (`select: { role: true }`, no join)
      instead of reusing `OrganizationUser`: fetching the full shape for a roles-only read
      meant joining both tables just to discard everything but one field. Consider splitting
      the schema along that seam instead of growing more of these narrow one-off queries.

## System admin

- [ ] Add hotkey support to the system-admin users and organisations pages
      (extends the personnel keyboard-shortcuts pilot).
- [ ] System-admin role assignment doesn't support assigning multiple roles.

## Skill package builder

- [ ] The **Skill Package Author** secondary role is gated on the _Skill Track_ module rather than
      _Skill Package Builder_ (`src/components/admin/invitations/invitation-role-fields.tsx` —
      `{ role: "skill-package-author", enabled: …modules["skill-track"].enabled }`). An org running
      Skill Track with the builder switched off is still offered the role when inviting, and an org
      running the builder without Skill Track is not offered it at all. Pre-existing — the same
      gating is on `integration`, in `create-invitation.tsx` before the fields were extracted — so
      it survived the extraction unchanged rather than being introduced by it. Noticed while
      browser-testing person↔user linking, where the `demo` org has the builder off and the
      checkbox appeared anyway.

- [ ] The packages list should **show unpublished packages by default**. It
      currently seeds `columnFilters` with `published: [true]`, so a freshly
      created or freshly imported (always `published: false`) package is hidden
      until the user clears the filter.
