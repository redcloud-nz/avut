# D4H I3 Issue/Return: view submitted forms

**Date:** 2026-11-12
**Issue:** [#461](https://github.com/redcloud-nz/avut/issues/461) (milestone v0.13)
**Branch:** `feat/submitted-forms`, worktree `.claude/worktrees/submitted-forms`
**DB:** no migration; shared `avut`
**Written against:** integration @ fa813b30

The Issue Items and Return Items pages list only the current user's drafts. Once a form is
submitted, the form processor marks it `Processed` and it disappears from the UI, and its URL
404s. This adds a Submitted list to both pages and a read-only view of a submitted form.

## Decisions

- **Only your own submissions** (decided on the issue, 2026-11-03), matching drafts. Everyone's in
  the org, maybe for `i3-admin` behind a toggle, comes later.
- **"Submitted" means any `formStatus` other than `Draft`.** Only `Draft` and `Processed` are
  written today, but the schema has others (`Submitted`, `Pending`, …), and they should all list.
- **The submitted time is `updatedAt`.** The processor's status write bumps it, and Task 1 makes a
  non-draft read-only, so the form flow never moves it afterwards. No `submittedAt` column, no
  migration. Caveat: purging a user account (`user-accounts.ts`, `updateMany` setting
  `userId: null`) bumps it too. v1 never shows those rows (they no longer match the caller), but an
  org-wide list would need a `submittedAt` first.
- **Non-drafts are read-only on the server, not just in the UI.** `Forms.saveInstance` writes
  `formStatus: "Draft"` on every save, so today a stray autosave on a processed form would quietly
  turn it back into a draft, and resubmitting it would re-run the pipeline (creating the D4H
  equipment again for an Issue). Exposing submitted forms' URLs makes this reachable, so Task 1
  closes it. The submit procedures call `saveInstance` first, so the same guard stops a resubmit.
- **One URL per form, whatever its status.** `forms/issue-items/[instance_id]` (and the Return
  counterpart) renders the editable form for a draft and the read-only view otherwise. A link to a
  draft keeps working after it's submitted. No new routes.
- **Drafts / Submitted as tabs on the existing list page,** driven by a `?tab=` search param (nuqs),
  so a reload or the back button keeps the tab. Drafts is the default.
- **Paginated with a cursor, newest first, 20 per page, "Load more"**, since this list only grows.
  Same `cursor`-named input as `history-router.ts`, so tRPC's `infiniteQueryOptions` pages
  through it; the cursor is the last row's `FormInstanceId` (Prisma `cursor` + `skip: 1`), ordered
  by `updatedAt desc, id desc`.
- **A Return's D4H tasks come from their own query** (`forms.listFormInstanceTasks`), which reads
  AVUT records only: no D4H token and no Equipment RETIRE team filter, unlike `listItemTasks` and
  `listOpenTasks` (it's like `listReturnedItemIds`). The gate is that the caller owns the
  instance: a form's tasks hold nothing its submitter didn't enter. It also sits on
  `d4hTask: ["view"]`, which `i3-editor` and `i3-admin` hold (only they can submit a Return), and
  the view wraps the card in `<Protect>` to match. The read lives in `src/server/services/d4h-tasks.ts`
  (`listForFormInstance`, next to `listForItem`). The d4h-i3 module can't import the d4h module's
  task components (lint), so the card renders its own small list. It doesn't link to
  **D4H › Tasks**: that page needs a token, RETIRE on the team and the `d4h` module, none of which
  a Return submitter is guaranteed (they need only Equipment UPDATE).

## Tasks

### Review group A: data layer

- [x] **Task 1: Make non-draft form instances read-only on the server** (feat(forms): make submitted form instances read-only on the server)
  - **Files:** `src/server/services/forms.ts`, `src/server/services/forms.test.ts`,
    `src/trpc/routers/forms-router.ts`, `src/trpc/routers/forms-router.test.ts` (new),
    `src/modules/d4h-i3/components/form-shared.tsx`,
    `src/modules/d4h-i3/components/issue-items-form-content.tsx`,
    `src/modules/d4h-i3/components/return-items-form-content.tsx`.
  - **Do:** `Forms.saveInstance` throws `ConflictError` when the existing instance's
    `formStatus` isn't `"Draft"` (message names the id and status), and makes the update itself
    conditional on `formStatus: "Draft"` so a status write between its read and its write isn't
    reverted. `useDraftFormAutosave` returns a `cancel` (`debouncer.cancel()`), and both content
    components call it in their submit handler before `mutate`, so a pending autosave can't land
    after the form is processed and toast a spurious save failure. In `forms-router.ts`,
    `deleteFormInstance`, `saveFormInstanceItemData` and `deleteFormInstanceItem` only match draft
    instances: add `formStatus: "Draft"` to the instance lookup / `where`, so a non-draft is
    `NOT_FOUND` as an unknown id already is. While there, `deleteFormInstanceItem`'s initial
    `findUnique` doesn't check the instance's owner (its `delete` does); make the lookup filter on
    the owning instance (org, user, draft) so the `NOT_FOUND` path is the one that fires. Follow
    `src/server/services/CLAUDE.md` and `.claude/rules/testing.md`.
  - **Done when:** tests cover: saving over a `Processed` instance throws `ConflictError` and leaves
    it untouched; each of the three router procedures returns `NOT_FOUND` for a `Processed`
    instance and still works for a draft. `npm run check` passes.

- [x] **Task 2: Queries for submitted forms and a form's D4H tasks** (feat(forms): add queries for submitted forms and a form's D4H tasks)
  - **Files:** `src/lib/schemas/form-instance.ts`, `src/server/services/forms.ts`,
    `src/server/services/forms.test.ts`, `src/trpc/routers/forms-router.ts`,
    `src/trpc/routers/forms-router.test.ts`.
  - **Do:** Add three procedures to `formsRouter`, each reading only the caller's own instances in
    the current org, with the reads in `Forms` service functions:
    - `getFormInstance({ formInstanceId, formKey })` → `FormInstance`, any status; `NOT_FOUND`
      (via the service's domain error, mapped by `mapDomainErrors`) for an unknown id, another
      user's or org's instance, or a `formKey` mismatch.
    - `listSubmittedFormInstances({ formKey, cursor?: FormInstanceId, limit = 20 (1–100) })` →
      `{ items: FormInstance[], nextCursor: FormInstanceId | null }`, `formStatus: { not: "Draft" }`,
      ordered `updatedAt desc, id desc`. Add the page shape to `form-instance.ts` as
      `FormInstancePage` (schema + type), mirroring `ObjectHistoryPage`. Document `cursor` as named
      for `infiniteQueryOptions`, as `history-router.ts` does.
    - `listFormInstanceTasks({ formInstanceId })` on `organizationProcedure({ d4hTask: ["view"] })`
      → `z.array(D4HTask.schema)` for the caller's own instance, oldest first by `requestedAt`;
      `NOT_FOUND` if the instance isn't theirs. No D4H token and no RETIRE filter (see Decisions).
      The ownership check uses `Forms`; the task read is `D4HTasks.listForFormInstance` in
      `src/server/services/d4h-tasks.ts`, mapping records as `listForItem` does.

    Keep `formsRouter` alphabetical: `getFormInstance` before `listDraftFormInstances`;
    `listFormInstanceTasks` and `listSubmittedFormInstances` after `listFormInstanceItems`.

  - **Done when:** tests cover ownership (other user, other org → `NOT_FOUND` / empty), the draft
    exclusion, ordering, and that paging with `nextCursor` returns the next rows with no overlap
    and `null` at the end. `npm run check` passes.

### Review group B: UI (visual checkpoint at the end)

- [ ] **Task 3: Drafts / Submitted tabs on the Issue and Return list pages** — `visual`
  - **Files:** `src/modules/d4h-i3/components/issue-items-form-list.tsx`,
    `src/modules/d4h-i3/components/return-items-form-list.tsx`,
    `src/modules/d4h-i3/components/submitted-form-list.tsx` (new),
    `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h-i3/forms/issue-items/page.tsx`,
    `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h-i3/forms/return-items/page.tsx`,
    `src/client/i3-effects.ts`.
  - **Do:** Under the header, `Tabs` with **Drafts** and **Submitted**, the value held in a
    `?tab=` param via nuqs (`useQueryState` + `parseAsStringLiteral(["drafts", "submitted"])`,
    default `drafts`, cleared from the URL on the default; see `docs/patterns/mutation-dialog.md`
    for the nuqs shape). The Drafts tab is today's list and empty state, unchanged.
    `submitted-form-list.tsx` exports one component used by both pages, taking the `formKey`, a
    function from instance id to its `[instance_id]` href, and the empty-state wording. It reads
    `listSubmittedFormInstances` with `useSuspenseInfiniteQuery` (see
    `src/components/history/object-history.tsx`), renders rows in the same `Item` style as drafts:
    title the recipient name (both forms' `formData.recipient.name`), description
    `"<n> items, submitted <relative time>"`, a **Load more** button while `hasNextPage`, and an
    `Empty` state ("No submitted forms" / "Forms you submit are listed here."). Wrap it in
    `Suspense` with a skeleton fallback. Each `page.tsx` always `prefetch`es the drafts query (the
    list component reads it outside the tabs), and reads `searchParams.tab` to `prefetchInfinite`
    the first submitted page only when Submitted is active. In `i3-effects.ts`, `submitIssueItemsForm` / `submitReturnItemsForm` also invalidate
    `forms.listSubmittedFormInstances` and `forms.getFormInstance` for their `formKey`.
  - **Done when:** both pages switch tabs, the tab survives a reload, a just-submitted form appears
    at the top of Submitted without a reload, Load more pages, and `npm run check` passes.

- [ ] **Task 4: Read-only view of a submitted Issue Items form** — `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h-i3/forms/issue-items/[instance_id]/page.tsx`,
    `src/modules/d4h-i3/components/issue-items-submitted-view.tsx` (new),
    `src/modules/d4h-i3/components/form-shared.tsx` (if a shared piece fits there).
  - **Do:** The page `fetchQuery`s `forms.getFormInstance` (awaited, so a missing or foreign id is
    `notFound()`), replacing the draft-list lookup. A draft renders the existing content with
    today's prefetches (keep prefetching `listDraftFormInstances`, which the content reads). Any
    other status prefetches `getFormInstance` and renders the new view instead (no D4H
    prefetches). The view, following `docs/patterns/detail-page-data-fetching.md`
    (`useSuspenseQuery` in the client component): `Std.Navbar` breadcrumbs D4H I3 › Forms ›
    Issue Items (linked to the list's Submitted tab) › the recipient's name, the help button as on
    the list; a `Saratoga` page titled "Issue Items" with a "Submitted" badge, then read-only fields
    laid out like the form's: **Issued to**, **Recorded by** (`UserNameFieldValue`), **Submitted**
    (absolute date and time), the items (template, variant, serial number, or "—"), and
    **Comments** (hidden when empty). No autosave, no Submit, no delete.
  - **Done when:** a processed Issue form's URL shows the view; a draft's still shows the editable
    form; another user's id 404s. `npm run check` passes.

- [ ] **Task 5: Read-only view of a submitted Return Items form, with its D4H tasks** — `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h-i3/forms/return-items/[instance_id]/page.tsx`,
    `src/modules/d4h-i3/components/return-items-submitted-view.tsx` (new).
  - **Do:** The page branches as in Task 4. A draft keeps today's prefetches, including the
    `recipient`-dependent ones, read from the fetched instance. A non-draft prefetches
    `getFormInstance` and `listFormInstanceTasks`. The view mirrors Task 4's (breadcrumbs, title,
    badge, **Returned by**, **Recorded by**, **Submitted**, items as ref and type, **Comments**),
    plus a **D4H tasks** card inside `<Protect permissions={{ d4hTask: ["view"] }}>` listing each
    task's item label, kind and status (Open / Done / Dismissed, as the D4H tasks list words them).
    No link to D4H › Tasks (see Decisions). When there are none, the card says no tasks were
    queued. A Return is `Processed` once any item was returned, so items that failed stay on the
    form with no task: mark an item with no task matching its `itemId` (by `resourceId`) as
    "Not returned". Read the tasks in a nested component so only that card suspends; the items
    list shows the marks once the tasks have loaded.
  - **Done when:** a processed Return shows its items and the tasks it queued, with current
    statuses; a draft still shows the editable form. `npm run check` passes.

- [ ] **Task 6: Help cards for the Submitted tab** — `mechanical`
  - **Files:** `content/help/d4h-i3/issue.mdx`, `content/help/d4h-i3/return.mdx`.
  - **Do:** In each card's opening paragraph, say the page has **Drafts** and **Submitted** tabs:
    Submitted lists the forms you've submitted, newest first, and opening one shows it read-only
    (for Return, with the D4H tasks it queued and where they stand). Keep the cards' voice and
    length; see `content/README.md`.
  - **Done when:** the cards render in the `?help=` sheet on both pages. `npm run check` passes.

## Docs impact

Guides `d4h-i3/issuing` and `d4h-i3/returning`: Submitted tab and read-only view (Return shows its D4H tasks); list screenshots change.

## Out of scope

- Everyone's submissions in the org (e.g. for `i3-admin`), filters or search on the list. That
  needs a `submittedAt` column first (see Decisions), and **Recorded by** rendered from the
  instance's user rather than `UserNameFieldValue` (the signed-in user).
- Showing the processor's stage results, or why a form failed (a failed submit stays a draft).
- Copying a submitted form into a new draft, or editing/withdrawing a submitted one.
- A `submittedAt` column.

## Parked

- Two concurrent submits of the same draft both pass Task 1's guard (both read `Draft`) and both
  run the pipeline. Closing it needs an atomic Draft → in-progress claim before processing.
- `forms-router`'s writes (save/delete instance and items) never call `ctx.logEvent`; predates
  this branch. Autosave would make per-save logging noisy, so it needs a decision on what to log.

## Review notes

- (Task 1) `saveFormInstanceItemData` checks the given instance is the caller's draft, but its
  `upsert` by item id never checks the existing item belongs to that instance, so a draft id plus
  another instance's item id overwrites that item. Look the item up first and `NOT_FOUND` on a
  mismatched `formInstanceId` (or `updateMany` on `{ id, formInstanceId }`, create only when none
  matched). Test: a draft id with a processed instance's item id.
- (Task 1) `cancel` drops a pending autosave but not one already in flight, which can land between
  submit's save and the `Processed` write and leave stale `formData` on the record the read-only
  view shows. Make the processor's status write persist the submitted `formData` too
  (`src/server/form-processor.ts`, `data: { formStatus: "Processed", formData }`), and word the
  `cancel` doc comment as "pending".
- (Task 1) `saveInstance`'s new find-then-`create` turns two racing first saves of one id into a
  raw P2002 (500). Map the unique violation to the conditional-update path or a `ConflictError`.
