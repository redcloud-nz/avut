# Mutation dialog migration — design

**Date:** 2026-08-30
**Status:** Approved, ready for implementation planning
**Pattern reference:** [`docs/patterns/mutation-dialog.md`](../../patterns/mutation-dialog.md)

## Goal

`admin/teams` was converted to the URL-routed mutation dialog pattern in PR #58
(`--create` / `--update` / `--delete` routes nested under a `(list)` / `(detail)`
route group, controlled dialog components, no intercepting routes). Every other
mutation dialog in the app still uses the older "self-contained dialog owns its
own `DialogTrigger` + `useState`" approach.

This migration brings the rest of the application onto the documented pattern,
area by area, one reviewable PR per area, so that:

- every create / update / delete / confirm dialog has its own URL and survives a
  refresh or a pasted link;
- the underlying list or detail page stays mounted under the dialog (no refetch)
  on both soft navigation and direct load;
- trigger sites are plain `<Link>`s, and menu components stop carrying dialog
  state;
- there is one consistent shape to read across the codebase.

## Non-goals

- **No tRPC procedure or `src/client/*-effects.ts` changes.** Only where a dialog
  lives changes, not the mutation wiring. (Two exceptions where existing code
  drifted from the effects-only convention — subscribe/unsubscribe — are called
  out in their phase.)
- **`admin/organization/--update` and `admin/d4h-access-tokens/--create` are not
  touched.** They are full-page _form_ routes, not dialogs, and are already
  URL-routed.
- **`user-settings` is not touched.** It is a global (non-org) intercepting
  `@modal` parallel route; realigning it is a separate project.
- No optimistic updates are introduced. `meta: { effects: … }` remains the only
  cache mechanism.
- No unrelated refactoring of the affected pages beyond what the pattern
  requires (plus the client-page extraction noted below, which the pattern
  requires).

## Scope

### In scope

| Wave | Area                                        | Dialogs                                                                                                    |
| ---- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1    | `admin/personnel`                           | create, update, delete person                                                                              |
| 1    | `skill-track/sessions`                      | create, update, delete session                                                                             |
| 1    | `skill-package-builder` — packages          | create, update, delete package                                                                             |
| 1    | `skill-package-builder` — groups + skills   | create, update, delete group; create, update, delete skill                                                 |
| 1    | `i3/templates`                              | create, update, delete template                                                                            |
| 1    | `admin/users`                               | update, delete user                                                                                        |
| 1    | `admin/invitations`                         | create invitation                                                                                          |
| 2    | `i3/templates` — variants                   | add, update, delete variant (nested entity)                                                                |
| 2    | `admin/teams` — remainder                   | add / remove team member, import team from D4H                                                             |
| 2    | `skill-track/catalogue`                     | subscribe / unsubscribe package                                                                            |
| 2    | `admin/users` — remainder                   | link / unlink person                                                                                       |
| 2    | `skill-package-builder` — state transitions | archive / restore for package, group, skill; publish / unpublish for package (all **new** confirm dialogs) |
| 2    | `skill-package-builder` — ordering          | move-skill, reorder-skills, reorder-groups                                                                 |

Plus a small cleanup folded into phase 1: rename the teams components from PR #58
(`AdminModule_CreateTeam_DialogContent`, `AdminModule_UpdateTeam_DialogContent`)
to the `…_Dialog` convention below, and update `mutation-dialog.md` to match.

**Wave 1** is the clean case: create / update / delete of a single record that
already has a list and/or detail page. **Wave 2** is nested entities, join /
relationship dialogs, new state-transition confirms, bulk-order dialogs, and the
teams remainder — each needs a small pattern decision, made in the spec below and
confirmed when the phase is reached.

### Explicitly out of scope

- `user-settings` `@modal` route.
- `admin/organization/--update`, `admin/d4h-access-tokens/--create` (full-page
  forms).
- Any `*-effects.ts` / tRPC router logic, except stripping the manual
  `queryClient.setQueryData` calls from subscribe/unsubscribe (phase 9).
- The `history` / `contents` / `checks` / `by-person` / `by-skill` / `review` /
  `skills` / `personnel` sibling subpages — they stay outside the new route
  groups and are not modified.

## The canonical per-area conversion

Every phase's PR follows this checklist, distilled from PR #58.

### Routing

1. Wrap the bare list page in a `(list)` route group; wrap the bare detail page
   in a `(detail)` group. Sibling subpages stay _outside_ the group, unchanged.
2. The group's `page.tsx` becomes `layout.tsx`: it renders the existing list /
   detail content component, then `{props.children}`, inside `HydrateClient`.
   `requireOrganization`, `prefetch(...)`, breadcrumb / header markup move here.
   The default export is renamed to `…Layout` and its props type gains
   `children: ReactNode`.
3. Add a new bare `page.tsx` in each group:
   - list: `export const metadata = { title: … }` + `export default () => null`
   - detail: `export default () => null` only (title comes from the layout).
4. Move `generateMetadata` (detail) onto the layout, so the dynamic title (e.g.
   the record name) covers the bare page and every dialog and is fetched once.
5. Add the dialog routes:
   - `--create` under `(list)/`
   - `--update` and `--delete` under `(detail)/`

   Each is a thin `"use client"` page that:
   - reads and parses its id param (`SomeId.schema.parse(...)`);
   - for `--update` / `--delete`, reads the record with `useSuspenseQuery`
     against the cache the layout already hydrated (`--create` fetches nothing);
   - renders `<…_Dialog open onOpenChange={(open) => { if (!open) router.push(parentPath); }} …>`.

   `open` is hard-coded `true` — the route existing _is_ the open state. Use
   `router.push`, never `router.back` (direct load has no history entry).

### Components

6. Rename the self-contained `…_Dialog` component to remain `…_Dialog` (the
   suffix stays — it renders a `Dialog` / `AlertDialog`) but make it
   **controlled**: it takes `open` / `onOpenChange`, owns **no** `DialogTrigger`
   and **no** `useState`. Delete dialogs already controlled via
   `ComponentProps<typeof AlertDialog>` need no rename.

   Naming convention: `<Area>Module_<Verb><Entity>_Dialog`, e.g.
   `AdminModule_CreatePerson_Dialog`, `SkillTrack_DeleteSession_Dialog`.

7. `onSuccess` closes by navigating, never by calling `onOpenChange(false)`:
   - **create** → `router.push` to the **new record's detail page** (not the
     list);
   - **update** → back to the detail page;
   - **delete** → back to the list.

   Do not call `mutation.reset()` in `onSuccess` (it flips the button out of its
   success state mid-navigation).

8. `handleDialogOpenChange` resets `form.reset()` + `mutation.reset()` on close,
   so re-navigating to the route shows no stale fields or banner.

9. `form.handleSubmit(onValid, onInvalid)` — always pass the second argument;
   log `onInvalid` to the console.

10. Trigger sites become `<Link>`s:
    - list header / card action: `<Button asChild><Link href={route(...)}>…</Link></Button>`
    - dropdown menu item: `<DropdownMenuItem asChild><Link href={route(...)}>…</Link></DropdownMenuItem>`

    Still wrapped in `<Protect>` (or its `render` prop for the disabled-item
    case). A menu / wrapper component that existed **only** to hold a dialog's
    `useState` loses the state, the fragment, and the dialog import; if that was
    its whole purpose, delete it and inline the `<Link>`.

### Verify (every phase)

```
npx next typegen        # required after adding routes, or route() won't typecheck
npx tsc --noEmit
npm run test:run
```

Then a browser click-through via the `test-in-browser` skill, for each dialog in
the phase:

- open by soft navigation (from the trigger) — underlying page stays visible
  behind the dialog;
- open by direct load / refresh of the dialog URL — same result;
- submit / confirm — correct toast, correct post-success navigation, the
  underlying data reflects the change (effects invalidation);
- cancel — navigates back to the parent, titles restored;
- one sibling subpage of the area still routes correctly (proves the route group
  didn't capture it).

## Per-area notes

| Area                                               | Detail page today                                                                     | Restructure                                                                                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin/personnel`                                  | server component, `generateMetadata`, `AdminModule_Person_Content`                    | clean — mirrors teams. Sibling: `[person_id]/history`.                                                                                                                                                                                    |
| `skill-track/sessions`                             | server, `generateMetadata`, `SkillTrack_Session_Content`                              | clean. Six sibling subpages (`by-person`, `by-skill`, `checks`, `personnel`, `review`, `skills`) — validates `(detail)` with many siblings.                                                                                               |
| `skill-package-builder` packages / groups / skills | server, `generateMetadata`, `*_Content` components                                    | clean, but three entities at increasing nesting depth (`packages/[package_id]`, `.../groups/[group_id]`, `.../skills/[skill_id]`). Siblings: `contents`, `history`.                                                                       |
| `i3/templates`                                     | **client component**, uses `useI3Template` hook, dialogs inline                       | **extraction required:** move the page body into an `I3Module_Template_Content` client component; the new `(detail)/layout.tsx` is a server component doing `requireOrganization` + `prefetch` + `generateMetadata`. No sibling subpages. |
| `admin/users`                                      | **client component**, inline `useState` for all four dialogs, no `-content` component | **extraction required**, same shape as i3 templates → `AdminModule_User_Content`. No `--create` (users are invited, not created).                                                                                                         |
| `admin/invitations`                                | no detail page                                                                        | `(list)` group + `--create` only.                                                                                                                                                                                                         |

## Phasing

One PR per phase. Waves are ordered so the clean pattern is proven at scale
before the awkward cases.

### Wave 1

| #   | Phase                                                    | Notes                                                                                                                                                                           |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `admin/personnel`                                        | **Reference phase.** After it lands, refine `mutation-dialog.md`: apply the `…_Dialog` naming (rename the teams PR #58 components too), and fold in anything phase 1 clarified. |
| 2   | `skill-track/sessions`                                   |                                                                                                                                                                                 |
| 3   | `skill-package-builder` — packages, then groups + skills | Split into two PRs if the combined diff is unwieldy.                                                                                                                            |
| 4   | `i3/templates` — template only                           | Client-page extraction.                                                                                                                                                         |
| 5   | `admin/users` — update / delete only                     | Client-page extraction.                                                                                                                                                         |
| 6   | `admin/invitations`                                      | List-only.                                                                                                                                                                      |

### Wave 2

Each phase confirms its pattern decision (below) before implementation.

| #   | Phase                                                                | Pattern decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | `i3/templates` — variants                                            | **Nested entity.** Routes nest under the template `(detail)` group: `--add-variant` directly under it; `variants/[variant_id]/--update` and `variants/[variant_id]/--delete` under a `variants/[variant_id]/` path segment. Close navigates to the template detail page. The variant record is read from the already-hydrated `listTemplateVariants` cache (or a `getVariant` query if one exists).                                                                                                                                                                                                         |
| 8   | `admin/teams` — add / remove member, import from D4H                 | add / remove member are triggered from `teams/[team_id]/personnel`, which becomes its own `(…)`-grouped sub-layout hosting `--add-member` and `members/[member_id]/--remove` (or `--remove-member` keyed by a query/route param). import-from-D4H is a `--import` route under the teams `(list)` group. Close returns to the personnel page / teams list respectively.                                                                                                                                                                                                                                      |
| 9   | `skill-track/catalogue` — subscribe / unsubscribe                    | Routed under the catalogue package detail (`catalogue/[package_id]/(detail)/--subscribe` / `--unsubscribe`). **Also strip** the manual `queryClient.setQueryData` in both `onSuccess` handlers — rely on `meta: { effects: skillsEffects.* }` alone, matching every other dialog.                                                                                                                                                                                                                                                                                                                           |
| 10  | `admin/users` — link / unlink person                                 | Relationship dialogs routed under the user `(detail)` group (`--link-person`, `--unlink-person`). Close returns to the user detail page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 11  | `skill-package-builder` — state transitions                          | **New confirm dialogs.** `--archive` / `--restore` for package, group, and skill; `--publish` / `--unpublish` for package. All plain `Dialog` (not `AlertDialog` — none are irreversible), no `react-hook-form` (no field input), body is descriptive text + a `MutationButton` with an `onClick` that fires the mutation. Routed under each entity's `(detail)` group. On success, navigate back to the detail page. The menu items that currently fire `toast.promise(mutateAsync(...))` directly become `<Link>`s; the per-action `useMutation` + handler functions move into the new dialog components. |
| 12  | `skill-package-builder` — move-skill, reorder-skills, reorder-groups | **Bulk-order dialogs.** Same routing mechanic (`--move` under the skill `(detail)` group; `--reorder-skills` / `--reorder-groups` under the group / package `(detail)` group). `Dialog`, not `AlertDialog`. Body is the existing sortable-list / select UI, kept as-is. `move-skill` has a form (target group select) so keeps `react-hook-form`; the reorder dialogs submit an ordered array on confirm.                                                                                                                                                                                                   |

## Wave-2 general rules (codify in `mutation-dialog.md` at the start of wave 2)

- **Nested entity (no page of its own):** dialog routes live under the parent's
  `(detail)` group. The "add" route sits directly under the group; "update" /
  "delete" sit under a `<entity>/[id]/` path segment. Close navigates to the
  parent detail page. The record is read from the parent's already-hydrated list
  query.
- **Relationship / join dialog:** routed under whichever side owns the detail
  page the action is triggered from; close returns there.
- **State-transition confirm (archive, restore, publish, unpublish, subscribe,
  unsubscribe):** same routing mechanic, **`Dialog` not `AlertDialog`** (reserve
  `AlertDialog` strictly for delete), no `react-hook-form` when there is no field
  input — a `MutationButton` with an `onClick` firing the mutation, plus
  descriptive body text.
- **Bulk-order dialog:** same mechanic, `Dialog`, bespoke body (sortable list or
  target select), form only if there is genuine field input.

## Documentation touchpoints

- `docs/patterns/mutation-dialog.md` — updated after phase 1 (naming +
  refinements), and again at the start of wave 2 (the four rules above), once
  phase 7 proves the nested-entity shape.
- `AGENTS.md` — pointer already updated (PR #58 follow-up); no change.
- `.claude/skills/avut-conventions-review/SKILL.md` — pointer already correct; no
  change.

## Risks

- **Client-page extraction (phases 4, 5)** is the least mechanical step —
  `i3/templates/[template_id]/page.tsx` and `admin/users/[user_id]/page.tsx` are
  client components with inline dialog state and, for users, no existing content
  component. Extraction must preserve the exact query keys the page reads so the
  layout's `prefetch` hydrates the right cache. Budget extra review here.
- **`skill-package-builder` route depth** — `packages/[package_id]/groups/[group_id]/skills/[skill_id]` plus a `(detail)` group and `--*` pages at three
  levels is a lot of small files. Phase 3 may split into package / group / skill
  PRs.
- **Phase 8 (team members)** has no obvious "member detail page"; the
  add/remove routes hang off the `personnel` subpage, which itself needs a route
  group. This is the shakiest pattern decision — revisit carefully when reached.
- Long-lived wave-2 branches vs. `master` churn — keep phases small and merge
  promptly.
