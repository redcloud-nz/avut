# Optional team on Skill Track sessions

**Date:** 2026-11-18
**Issue:** [#526](https://github.com/redcloud-nz/avut/issues/526) (team scope v1, tracking #520)
**Branch:** `feat/session-team`, worktree `.claude/worktrees/session-team`
**DB:** adds a migration. `npm run db:branch session-team` before the first `migrate dev` (needs every connection to `avut` closed); `migrate dev` on the branch DB still needs permission.
**D4H:** not involved.
**Written against:** integration @ 32d8c9c0

## Decisions

- `SkillCheckSession.teamId String?` with a relation to `Team`, `onDelete: SetNull`. Teams are soft-deleted (`status: "Deleted"`), and only the Rubbish-bin purge (`trash.ts`) hard-deletes one, which then leaves its sessions org-wide rather than deleted. `@@index([teamId])`. Null means an org-wide session, such as a combined training weekend. Existing rows stay null; no backfill.
- **Create with a team seeds the assessees** (decided 2026-11-18): `createSession` connects every person with an `Active` membership in that team whose person isn't `Deleted` (the same person rule as `assertAssessablePersonnel`), in the same `create` as the session. People from other teams can still be added afterwards through `change-session-personnel.tsx` (unchanged, no warning). The create log entry gets an `assessees` `arr_add` change per seeded person, matching the shape `updateSessionAssessees` logs. (`createSession`'s log already runs outside a transaction because of the session-number retry loop; this inherits that.)
- **Editing the team doesn't touch assessees.** `updateSession` only changes the label; the user adjusts personnel separately. Approved sessions already refuse `updateSession`, so they can't change team either.
- **Which teams can be picked:** `Active` teams in the org. A new service check `SkillChecks.assertSessionTeam(ctx, teamId)` throws `ValidationError` (→ BAD_REQUEST) for a team not in the org or not `Active`. On update it's skipped when `teamId` is unchanged, so a session whose team has since been archived or binned can still be saved with its other fields edited.
- `teamId` joins `SkillCheckSession.modifiableSchema` (as `TeamId.schema.nullable()`), so create and update both carry it, and `diffObject` logs it like any other field. History shows "Team: Rescue" rather than an id, through `IdFields.SkillCheckSession.teamId = "Team"`.
- **API shape:** `getSession`, `listSessions`, and the `created`/`updated` results of `createSession`/`updateSession` all carry `team: TeamRef | null` (the flat `teamId` stays on the schema). `updateSession` returning `team` keeps the client's `updateSession` effect, which merges `updated` into the cached `getSession`, from leaving a stale team ref there.
- **The picker:** a `Select` with an explicit "No team (whole organisation)" option. Radix `Select` can't hold an empty value, so the dialog field is a `z.string()` holding a team id or the sentinel `"__none__"`, and `parseSessionDialog` maps the sentinel to `null` before parsing through `SkillCheckSession.inputSchema`. Options are `Active` teams by name, plus the session's current team when it isn't among them (archived or in the Rubbish bin), so the edit dialog never shows a blank value. Defaults to no team.
- **The sessions list** gets a **Team** column. Its accessor returns the team **id**, or `"__none__"` for none; the cell renders the name or "—". A `Kaga.filterFns.oneOf` filter with `meta.columnOptions` derived from the rows: each distinct team (label name, value id), plus "No team". The id keeps two same-named teams apart. The session detail card shows Team too, between When and Notes.

## Tasks

### Review group 1: data layer

- [x] **1. Schema and migration** — feat(skill-track): add an optional team to skill check sessions
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_skill_check_session_team/migration.sql`
  - **Do:** add `teamId String?`, `team Team? @relation("skill_check_session_to_team", fields: [teamId], references: [id], onDelete: SetNull)` and `@@index([teamId])` to `SkillCheckSession`, and the back-relation `skillCheckSessions SkillCheckSession[] @relation("skill_check_session_to_team")` on `Team`. Run `npm run db:branch session-team` first (stop the worktree's dev server; ask the user to stop theirs and Prisma Studio), then, with permission, `npm run prisma migrate dev --name skill_check_session_team`.
  - **Done when:** the migration only adds the column, FK and index; `npx prisma generate` is clean; `npm run prisma migrate status` on the branch DB is up to date.

- [ ] **2. Session team: schema, service, router, cache effects, tests**
  - **Files:** `src/lib/schemas/skill-check-session.ts`, `src/server/services/skill-checks.ts`, `src/trpc/routers/skill-check-sessions-router.ts`, `src/client/skill-check-sessions-effects.ts`, `src/trpc/routers/skill-check-sessions-router.test.ts`, `src/server/services/skill-checks.test.ts`, `src/client/skill-check-sessions-effects.test.ts`, plus any fixture or demo the new field breaks
  - **Do:**
    - Schema: `teamId: TeamId.schema.nullable()` on `skillCheckSessionSchema` and in `modifiableSchema`'s pick. Check `fromRecord` still parses.
    - Service (per `src/server/services/CLAUDE.md`): `assertSessionTeam(ctx, teamId)` as in Decisions, and `sessionTeamAssesseeIds(ctx, teamId)` returning the person ids of the team's `Active` memberships with a non-`Deleted` person. `createSession`'s include gains `team: { select: { id, name } }` (and its return type).
    - Router: `createSession` validates the team, seeds assessees (`assessees: { connect }`), sets `teamId`, and logs `teamId` plus the `assessees` `arr_add` changes. `updateSession` validates a changed `teamId`, writes it, includes `team` on the update, and diffs it (already covered by `modifiableSchema`). `getSession`, `listSessions`, `createSession` and `updateSession` return `team: TeamRef | null`. Update the JSDoc on each.
    - Effects: make sure `createSession` still writes `getSession` wholesale (now with `team`) and `updateSession`'s merge replaces `team`. Update the JSDoc (it says `created` "matches `getSession` exactly").
    - Tests (per `.claude/rules/testing.md`): create with a team seeds exactly the active, non-deleted members and logs them; create with no team seeds nobody; create or update with another org's team, or an archived one, is `BAD_REQUEST`; update changing the team logs a `teamId` change, returns the new `team`, and leaves assessees alone; update of a session whose team is archived but unchanged succeeds; `listSessions`/`getSession` return `team`; the effects test shows editing the team replaces the cached `team`.
  - **Done when:** `npm run check` passes with the new tests.

- [ ] **3. History resolves a session's team by name**
  - **Files:** `src/lib/schemas/object-history.ts`, `src/server/services/object-history.ts`, `src/components/history/object-history.tsx`, `src/server/services/object-history.test.ts`
  - **Do:** add `"Team"` to `IdFieldTarget` and `teamId: "Team"` to `IdFields.SkillCheckSession`. Carry it through `ObjectHistoryPage.schema.names` (a `Team` record), `collectIdFieldIds`, `emptyNames().idFields`, the `names` the service returns, and the client merge (`IdFieldNames`) in `object-history.tsx`. Team is already a ref type with its own permission gate, so mirror the Person split in `resolveNames`: one lookup for ref and IdField team ids, with the ref map restricted to the ref ids, so an IdField id can't surface a Team ref the caller couldn't view.
  - **Done when:** a test where a session entry's `teamId` `obj_mod` resolves in `names.Team`, plus the ref-restriction case, passes under `npm run check`.

### Review group 2: UI (`visual`)

- [ ] **4. Team field in the create and edit dialogs** — `visual`
  - **Files:** `src/modules/skill-track/components/session-when-picker.tsx` (`sessionDialogSchema`, `parseSessionDialog`), `session-when-picker.test.ts`, `create-session.tsx`, `update-session.tsx`, probably a shared `session-team-select.tsx` in the same folder
  - **Do:** add a Team select between Name and When in both dialogs, built as in Decisions (sentinel field, options including the current team when it isn't active), fed by `trpc.teams.listTeams`. On create, a hint under the field: "Everyone in the team is added to the session's personnel." Follow `docs/patterns/mutation-dialog.md` and `docs/patterns/field-layout.md`; the select markup follows `src/modules/d4h-nag/components/rule-form.tsx`. Add a `parseSessionDialog` test for the sentinel → `null` mapping and a team id passing through.
  - **Done when:** creating with a team lands on a session whose Personnel tab lists the team's members; editing the team saves, shows the new team, and doesn't change personnel; `npm run check` passes.

- [ ] **5. Team in the sessions list and session detail** — `visual`, `mechanical`
  - **Files:** `src/modules/skill-track/components/sessions-list.tsx`, `session-content.tsx`, `content/help/skill-track/sessions.mdx`, `content/help/skill-track/session.mdx`
  - **Do:** a Team column after Name, as in Decisions. Team on the detail card between When and Notes, as a `TeamLink` (`docs/patterns/entity-link.md`) or "—". Update the two help cards: a session can belong to a team, choosing one at creation adds its members, and the list can be filtered by team.
  - **Done when:** the column filters, including "No team"; the detail shows the team; `npm run check` passes.

Visual checkpoint after task 5.

## Docs impact

Skill Track sessions gain an optional team: §1 "Create the session" in `content/docs/skill-track/sessions.mdx` (team field, members added automatically), and the sessions-list and new-session-dialog screenshots.

## Out of scope

- Team-scoped views of sessions (`/teams/[slug]/…`): #527.
- Warning about or blocking assessees from outside the session's team.
- Re-seeding assessees when the team changes on edit.
- Reworking `change-session-personnel.tsx` to put the session's team first (the work plan calls this "may need refining later").

## Parked
