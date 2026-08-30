# Mutation dialog migration — design

**Date:** 2026-08-30
**Status:** Approved, ready for implementation planning
**Pattern reference:** [`docs/patterns/mutation-dialog.md`](../../patterns/mutation-dialog.md)
**Pilot / comparison:** [`2026-08-30-mutation-dialog-pilot-comparison.md`](./2026-08-30-mutation-dialog-pilot-comparison.md)

## Goal

Every mutation dialog in the app is driven by an **`action` search param**
(`?action=create`, `?action=update`, …) managed with [nuqs](https://nuqs.dev), so
that:

- every create / update / delete / confirm dialog has its own URL and survives a
  refresh or a pasted link;
- the underlying list or detail page stays mounted (no refetch, no remount) —
  nuqs updates the URL through the History API, not the Next router;
- a dialog can be opened from any trigger (button, menu item, link, shortcut),
  and one dialog can have several triggers;
- there is one consistent, low-surface-area shape across the codebase.

Two earlier approaches are superseded: the original self-contained
`useState` + `<DialogTrigger>` dialogs (no URL, no refresh survival), and the
`(list)` / `(detail)` route-group + `--create` / `--update` / `--delete` page
experiment shipped for `admin/teams` in PR #58. The route-group version was
piloted head-to-head against a nuqs version of `admin/personnel`; nuqs hit the
same goals with a quarter of the diff and without the route-group's focus-drop,
Back-button ghost-entry, and per-open RSC round-trip regressions (see the
comparison doc). **`admin/teams` will be converted back off route groups as part
of this migration.**

## Prerequisite (done)

`nuqs` is a dependency and `NuqsAdapter` (`nuqs/adapters/next/app`) wraps the app
in `src/components/providers.tsx`. `admin/personnel` is already converted (the
pilot).

## Non-goals

- **No tRPC procedure or `src/client/*-effects.ts` changes.** Only how the dialog
  is opened/closed changes, not the mutation wiring. (One exception —
  subscribe/unsubscribe carry manual `queryClient.setQueryData` in `onSuccess`
  that is stripped to effects-only in their phase.)
- **`admin/organization/--update` and `admin/d4h-access-tokens/--create` are not
  touched.** They are full-page _form_ routes, not dialogs.
- **`user-settings` is not touched.** Global (non-org) intercepting `@modal`
  route; out of scope entirely.
- No optimistic updates. `meta: { effects: … }` remains the only cache mechanism.
- No page / layout / route restructuring. Adding a dialog does not touch
  `page.tsx`, `layout.tsx`, content components, `generateMetadata`, or sibling
  subpages.

## Scope

### In scope

| Wave | Area                                        | Dialogs                                                                                                    |
| ---- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| —    | `admin/personnel`                           | create, update, delete person — **done (pilot)**                                                           |
| 1    | `admin/teams`                               | **re-convert** create, update, delete team off the PR #58 route groups                                     |
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

**Wave 1** is create / update / delete of a single record. **Wave 2** is nested
entities, join / relationship dialogs, new state-transition confirms, and
bulk-order dialogs — each still needs a small decision (which param, which
component hosts it), made below and confirmed when reached.

### Explicitly out of scope

- `user-settings` `@modal` route.
- `admin/organization/--update`, `admin/d4h-access-tokens/--create` (full-page
  forms).
- Any `*-effects.ts` / tRPC router logic, except stripping the manual
  `queryClient.setQueryData` from subscribe/unsubscribe (their phase).
- All sibling subpages (`history`, `contents`, `checks`, `by-person`, …) — the
  nuqs approach never touches them.

## The canonical per-area conversion

Every phase's PR follows this checklist (see the pilot commit `4bc6d59` for the
worked example, and `mutation-dialog.md` for the full pattern).

For each dialog in the area:

1. **In the dialog component**, replace the open/close `useState` with the param:

   ```tsx
   const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
   const dialogOpen = action === "update";
   ```

2. **`handleDialogOpenChange`**:
   - open → `void setAction("update", { history: "push" })`
   - close → `form.reset()` (non-destructive only) + `mutation.reset()` +
     `void setAction(null, { history: "replace" })`

3. **Keep the component's `…_Dialog` name.** It stays a controlled component
   (drives `open` from the param, not from local state). It may keep its own
   `<DialogTrigger>` (create button, update pencil) or be fully prop-driven when
   the only trigger is a menu item (delete). A delete dialog already typed
   `ComponentProps<typeof AlertDialog>` needs no signature change.

4. **`onSuccess` navigation rule** — never pair a closing param-write with a
   `router.push` in the same handler (the `replace` races the push):
   - **create** → `onSuccess` does only `router.push` to the new record's detail
     page;
   - **update** → `onSuccess` does only `handleDialogOpenChange(false)` (stays on
     the page);
   - **delete** → `onSuccess` does only `router.push` to the list.

5. **`form.handleSubmit(onValid, onInvalid)`** — always pass the second argument;
   log `onInvalid`.

6. **Trigger sites** — a permission-gated `<Button onClick={() => setAction(…, {
history: "push" })}>` or `<DropdownMenuItem onClick={…}>`, still wrapped in
   `<Protect>` / its `render` prop. Prefer a real button (stays mounted → Radix
   restores focus on close) over a `<Link href="?action=…">`. A menu / wrapper
   component that existed only to hold a dialog's `useState` loses the state; if
   that was its whole purpose, delete it.

7. **Menu-triggered dialogs**: add an explicit `onCloseAutoFocus` on the dialog
   content pointing at a stable element (the menu trigger button), because the
   menu item unmounts before the dialog closes. Applies to `personnel`'s delete
   too — a pilot follow-up.

### Verify (every phase)

```
npx tsc --noEmit
npm run test:run
```

(`npx next typegen` is **not** needed — no routes are added.)

Then a browser click-through via the `test-in-browser` skill, for each dialog:

- open from its trigger (soft) — underlying page stays visible behind the dialog,
  URL gains `?action=…`;
- direct load / refresh of the `?action=…` URL — dialog opens on load;
- submit / confirm — correct toast, correct post-success navigation, underlying
  data reflects the change (effects invalidation);
- cancel — param cleared, focus returns to the trigger (for button triggers);
- Back button after open→close lands on the pre-dialog page, not a re-opened
  dialog.

## Per-area notes

| Area                                               | Notes                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin/teams`                                      | **Re-convert.** Delete the `(list)` / `(detail)` route groups, the bare `page.tsx → null` files, and the `--*` folders from PR #58; move `generateMetadata` back onto `[team_id]/page.tsx`; restore the list/detail `page.tsx` files; rename `…_DialogContent` → `…_Dialog` and swap `open`/`onOpenChange` props for the param hook. Net file _reduction_. |
| `skill-track/sessions`                             | Straightforward. Six sibling subpages untouched.                                                                                                                                                                                                                                                                                                           |
| `skill-package-builder` packages / groups / skills | Three entities. Deep nesting is irrelevant now — no routes added. May still split into package / group / skill PRs for review size.                                                                                                                                                                                                                        |
| `i3/templates`                                     | Detail page is a client component using `useI3Template` — **no extraction needed**, the param hook drops straight into it. Variant dialogs are wave 2.                                                                                                                                                                                                     |
| `admin/users`                                      | Detail page is a client component with inline `useState` for all dialogs — **no extraction needed**, swap each `useState` for the param hook in place. No `--create` (users are invited). link/unlink are wave 2.                                                                                                                                          |
| `admin/invitations`                                | List page only, one create dialog.                                                                                                                                                                                                                                                                                                                         |

## Phasing

One PR per phase.

### Wave 1

| #   | Phase                                                    | Notes                                                                                                                                                                                                      |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `admin/teams` re-convert                                 | Do first — proves the pattern removes the route-group scaffolding cleanly and re-establishes `teams` as a second reference alongside `personnel`. Refine `mutation-dialog.md` from anything this surfaces. |
| 2   | `skill-track/sessions`                                   |                                                                                                                                                                                                            |
| 3   | `skill-package-builder` — packages, then groups + skills | Split into two PRs if the combined diff is large.                                                                                                                                                          |
| 4   | `i3/templates` — template only                           |                                                                                                                                                                                                            |
| 5   | `admin/users` — update / delete only                     |                                                                                                                                                                                                            |
| 6   | `admin/invitations`                                      | List-only.                                                                                                                                                                                                 |

### Wave 2

Each phase confirms its decision before implementation.

| #   | Phase                                                                | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | `i3/templates` — variants                                            | **Nested entity → needs a second param.** `?action=add-variant` on the template detail; `?action=update-variant&variantId=…` / `?action=delete-variant&variantId=…`. The host reads `variantId` and resolves the variant from the `listTemplateVariants` cache. Close returns to the template detail page (no navigation — same page).                                                                                                                                                  |
| 8   | `admin/teams` — add / remove member, import from D4H                 | add / remove member triggered from `teams/[team_id]/personnel`: `?action=add-member` / `?action=remove-member&memberId=…` on that subpage. import-from-D4H: `?action=import` on the teams list. All same-page closes.                                                                                                                                                                                                                                                                   |
| 9   | `skill-track/catalogue` — subscribe / unsubscribe                    | `?action=subscribe` / `?action=unsubscribe` on the catalogue package detail. **Also strip** the manual `queryClient.setQueryData` in both `onSuccess` handlers — rely on `meta: { effects: skillsEffects.* }` alone.                                                                                                                                                                                                                                                                    |
| 10  | `admin/users` — link / unlink person                                 | `?action=link-person` / `?action=unlink-person` on the user detail page.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 11  | `skill-package-builder` — state transitions                          | **New confirm dialogs.** `?action=archive` / `restore` for package, group, skill; `?action=publish` / `unpublish` for package. Plain `Dialog` (not `AlertDialog` — none irreversible), no `react-hook-form`, body = descriptive text + a `MutationButton` with `onClick`. The menu items that currently fire `toast.promise(mutateAsync(...))` become `setAction(…)` calls; the per-action `useMutation` + handlers move into the new dialog components. `onSuccess` stays on the page. |
| 12  | `skill-package-builder` — move-skill, reorder-skills, reorder-groups | **Bulk-order dialogs.** `?action=move` on the skill; `?action=reorder-skills` / `reorder-groups` on the group / package. `Dialog`, not `AlertDialog`. Body is the existing sortable-list / select UI. `move-skill` keeps `react-hook-form` (target group select); reorder dialogs submit an ordered array on confirm.                                                                                                                                                                   |

## Wave-2 general rules (codify in `mutation-dialog.md` at the start of wave 2)

- **Nested entity (no page of its own):** a distinct `action` value plus a second
  param (`&variantId=…`, `&memberId=…`) identifying the row; the hosting
  component resolves the record from the parent's list-query cache. Close is a
  same-page param clear — no navigation.
- **Relationship / join dialog:** hosted by whichever detail/list component the
  action is triggered from; `action` value names the relationship
  (`link-person`, `subscribe`). Same-page close.
- **State-transition confirm (archive, restore, publish, unpublish, subscribe,
  unsubscribe):** **`Dialog` not `AlertDialog`** (reserve `AlertDialog` strictly
  for delete), no `react-hook-form` when there is no field input — a
  `MutationButton` with an `onClick` firing the mutation plus descriptive body
  text. `onSuccess` stays on the page.
- **Bulk-order dialog:** `Dialog`, bespoke body (sortable list or target select),
  form only if there is genuine field input.

## Documentation touchpoints

- `docs/patterns/mutation-dialog.md` — **rewritten around nuqs** (done). Update
  again at the start of wave 2 with the four rules above, once phase 7 proves the
  second-param shape.
- `AGENTS.md` — pointer updated to describe the nuqs approach (done).
- `.claude/skills/avut-conventions-review/SKILL.md` — links the pattern doc by
  reference only; no change.

## Risks

- **`admin/teams` re-convert (phase 1)** deletes real route files and moves
  `generateMetadata`. Verify the detail-page title, breadcrumbs, and the
  `personnel` sibling subpage all still work; verify no `route()` call anywhere
  still references a deleted `--create` / `--update` / `--delete` path.
- **Stale `route()` references** — grep for `teams/--` and any `--create` /
  `--update` / `--delete` route strings after phase 1.
- **Menu-triggered focus** — the `onCloseAutoFocus` fix is easy to forget; it
  applies to every delete/confirm dialog opened from a `DropdownMenuItem`. Make
  it a review checklist item.
- **`action` param collisions on one page** — a page hosting two dialogs (e.g. a
  detail page with update + delete) is fine because each component parses its own
  literal set, but a page hosting two dialogs that both want `?action=update`
  would clash. None currently do; watch for it in wave 2.
- **nuqs + `router.push` races** — the pilot hit one (delete). The rule in step 4
  above prevents it; enforce it in review.
