# Skill Track: Checks page becomes a general check search

**Date:** 2026-11-06
**Issue:** [#419](https://github.com/redcloud-nz/avut/issues/419) (v0.13 - nucula)
**Branch:** `feat/check-search`, worktree `.claude/worktrees/check-search` (dev server port 3102)
**DB:** no migration, so shared `avut` (see Decision 8).
**Other:** D4H not involved. Read-only, so no new permissions and no `ctx.logEvent`.
**Written against:** integration @ fa813b30

The Checks page (`/orgs/[slug]/skill-track/checks`) lists only the last month of checks, from `skillChecks.listRecentChecks`, filtered and paged in the browser. It becomes a search over every check in the organization: filters for person, skill, session, assessor, result and date range, held in search params so a filtered view can be linked to, and a paginated server query behind it. The skill page's **Related** card gains a **Recent checks** item that opens the page filtered to that skill.

## Decisions

1. **Paged on the server.** A new `skillChecks.searchChecks` returns one page of rows and the total match count. It replaces `listRecentChecks`, which is removed along with its tests and effects. The table runs TanStack Table with `manualPagination` and `rowCount` from the total; in 8.21.3 `getRowCount()`/`getPageCount()` derive from `rowCount`, so `Kaga.TablePagination` works unchanged. This is the first server-paged Kaga table.
2. **No default date window.** With no filters, the page shows every check, newest first. The one-month limit goes, and so does `create-check.tsx`'s "it won't appear under Recent Skill Checks" toast and the help card's matching sentence. The title becomes **Skill Checks**.
3. **Fixed order: `checkedAt` desc, then `id` desc** (so paging is stable). No column sorting: sorting one page of a server-paged table misleads.
4. **The filters replace the free-text search.** `Kaga.TableToolbar`'s search box filters only the rows in hand, which on one page is misleading, so the page drops it. The filters are:
   - **Person** (assessee) and **Assessor**: `PersonPicker` (`src/components/controls/person-picker.tsx`), inactive people included, since past checks name them.
   - **Skill:** a `SearchableSelect` over `skillPackageSubscriptions.listAssessableSkills`. Archived skills aren't offered (#437), but a `?skill=` link to one still filters (the skill page links to every skill, Decision 11); the trigger then shows the skill's name from the first result row, or the id when no row matches.
   - **Session:** a `SearchableSelect` over `skillCheckSessions.listSessions`, newest first, with a "No session" option for standalone checks.
   - **Result:** one of the org's enabled results (`getEnabledSkillCheckResultOptions`).
   - **Date:** `DateRangePicker` (`src/components/controls/date-range-picker.tsx`, unused until now; its bugs are fixed in Task 4). Both ends inclusive.
   - **Clear filters**, shown when any filter is set.

   One value per filter. Multi-select is out of scope.

5. **Search params,** parsed with nuqs: `person`, `assessor`, `skill`, `session` (an id, or `none` for standalone checks), `result`, `from`, `to` (ISO dates), and `page` (1-based in the URL, default 1, cleared at the default). Changing any filter resets `page`. Filters use `history: "replace"`, so typing through filters doesn't flood the back button; `page` uses `push`. Parsers live in one module, `src/modules/skill-track/lib/check-search-params.ts`, importing from `nuqs/server` so both `page.tsx` (via `createLoader`, new to the repo; other pages parse `props.searchParams` by hand) and the client component read the same params and build the same query input, and the prefetch hits.
6. **Date range: calendar days in the viewer's display time zone,** the zone the Date column renders `checkedAt` in, so the filter and the column always agree. (Session pages judge a session's day in the org's zone, so a viewer in another zone may see a session's checks a day apart there; matching the column on this page matters more.) The input carries the plain dates and the server works out the bounds: it reads the caller's `display.timeZone` (defaults to `Pacific/Auckland` in the schema, so there's no missing case), builds the start as `new TZDate(y, m - 1, d, tz)` as `src/lib/session-timing.ts` does, and bounds the end with `lt` the start of the day after `to` (`addDays` on a `TZDate`, DST-safe). The prefetch and the client build the same query key.
7. **Filter changes don't flash the loading page.** nuqs updates its state synchronously, so a new query key would suspend `useSuspenseQuery`, and with no `<Suspense>` of its own the page would fall through to `skill-track/loading.tsx`, filter bar included. `checks-list.tsx` builds the query input from `useDeferredValue(params)`, which keeps the old rows and the filter bar on screen until the new page arrives, for filter changes, paging and back/forward alike.
8. **No new index.** `SkillCheck` already has `@@index([organizationId])` and single-column indexes on `skillId`, `assesseeId`, `assessorId` and `sessionId`. A composite `(organizationId, checkedAt)` would help only the unfiltered order, the count can't come from it (`status` isn't in it), and OFFSET paging reads skipped rows regardless. At per-org check volumes that isn't worth a migration. Revisit if the page is measurably slow. The count runs alongside the page query in one `$transaction([count, findMany])` (one round trip).
9. **Same rows as today:** every check that isn't `Deleted`, from sessions or standalone, whether or not its session is approved. Permission stays `skillCheck: ["view"]`.
10. **The query lives in `SkillChecks.search`** (`src/server/services/skill-checks.ts`), with the router a thin wrapper. It has one caller, so the service layer isn't required, but it keeps the filter logic testable without tRPC.
11. **Recent checks shows for every skill.** The Related card today renders only when `coverageAvailable` (subscribed, not withdrawn, not archived), since Skill Coverage was its only item. It now renders whenever the user has `skillCheck: ["view"]`: **Recent checks** always, **Skill Coverage** still only when `coverageAvailable`. Archived and withdrawn skills are exactly the ones whose history this link is for. Recent checks comes after Skill Coverage, linking to `/orgs/[slug]/skill-track/checks?skill=<id>`, built like Skill Coverage's link.

## Tasks

### Review group A: data layer

- [x] **Task 1: `searchChecks` service and procedure; remove `listRecentChecks`.** _feat(skill-track): searchChecks service and procedure, replacing listRecentChecks_
  - **Files:** `src/server/services/skill-checks.ts` and its test, `src/trpc/routers/skill-checks-router.ts` and its test, `src/client/skill-checks-effects.ts`, `src/client/skill-check-sessions-effects.ts` and its test (lines ~340 and ~402 name `listRecentChecks`), `src/lib/schemas/skill-check.ts` (the filters schema).
  - **Do:**
    - **Schema:** `CheckSearchFilters`: `assesseeId?`, `assessorId?`, `skillId?` (their `Id` schemas), `sessionId?` (a `SkillCheckSessionId` or the literal `"none"`), `result?` (`SkillCheckResultValue`), and `from?`/`to?` reused from `DateRange.schema` (`src/lib/schemas/date-range.ts`). Page input: `page` (int ≥ 1) and `pageSize` (int 1 to 100).
    - **Service:** `SkillChecks.search(ctx, { filters, page, pageSize, timeZone })` builds one `where` (`organizationId`, `status: { not: "Deleted" }`, each filter given; `sessionId: null` for `"none"`; `checkedAt` bounds per Decision 6), then runs `ctx.prisma.$transaction([count, findMany])` with `orderBy: [{ checkedAt: "desc" }, { id: "desc" }]`, `skip`, `take` and the same `include` `listRecentChecks` uses. Returns `{ rows, total }` with rows shaped exactly as `listRecentChecks`' output.
    - **Router:** `searchChecks: organizationProcedure({ skillCheck: ["view"] })`, input `{ filters, page, pageSize }`, reading the time zone with `readUserSettings(ctx.prisma, ctx.userId)` from `src/server/user-settings-store.ts` (`display.timeZone`). Alphabetical placement. Delete `listRecentChecks` and its tests.
    - **Effects:** every `listRecentChecks` invalidation becomes `searchChecks.queryFilter({ organizationId })`, and the comments that name it (including `skill-check-sessions-effects.ts` ~101) are updated.
  - **Done when:**
    - **Service tests:** `Deleted` excluded; another org's checks never appear; each filter on its own; `session: "none"` returns only standalone checks; both date bounds inclusive, including a check late on the `to` day in a non-UTC zone and across a DST change; ties broken by id; `page`/`pageSize` slicing with the right `total`; a page past the end returns no rows and the real total.
    - **Router tests:** no `skillCheck` view is `FORBIDDEN`; org isolation; the caller's time zone reaches the service.
    - `git grep listRecentChecks -- src` finds nothing; `npm run check` passes.

### Review group B: UI (visual checkpoint after Task 4)

- [x] **Task 2: search params and the server-paged table.** `visual` _feat(skill-track): server-paged Checks table driven by search params_
  - **Files:** new `src/modules/skill-track/lib/check-search-params.ts`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/skill-track/checks/page.tsx`, `src/modules/skill-track/components/checks-list.tsx`, `src/modules/skill-track/components/create-check.tsx`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/skill-track/page.tsx` (line ~88), `content/help/skill-track/checks.mdx`.
  - **Do:** Read `docs/patterns/detail-page-data-fetching.md` first.
    - `check-search-params.ts` (imports from `nuqs/server`): the parsers for Decision 5 (`parseAsString`, `parseAsStringLiteral` for `result`, ISO date strings for `from`/`to`, `parseAsInteger.withDefault(1)` for `page`), a `createLoader` for `page.tsx`, and one function turning the parsed params into `searchChecks` input. An id that fails its `Id` schema, or a bad date, is dropped, and `page` below 1 is clamped to 1, so a mangled link shows a valid view rather than erroring.
    - `page.tsx` loads the params from `props.searchParams` and prefetches `searchChecks` with that input, `pageSize: Kaga.DEFAULT_PAGE_SIZE`.
    - `checks-list.tsx`: `useQueryStates` with the same parsers, query input built from `useDeferredValue` of them (Decision 7), `useSuspenseQuery(searchChecks…)`, TanStack Table with `manualPagination: true`, `rowCount: total`, and `state.pagination` driven by `page` (with `onPaginationChange` writing it back). Columns as today, with `enableSorting: false` and no column filters. Drop `Kaga.TableToolbar`. Title **Skill Checks**. Empty states: "No skill checks have been recorded yet." with no filters set; "No skill checks match these filters." otherwise; and for a page past the end (`rows` empty, `total > 0`), a message with a link back to page 1. Leave a slot above the table for Task 3's filter bar.
    - `create-check.tsx`: drop the month-old toast branch.
    - Skill Track index page: the Checks description becomes "Search skill checks and their results."
    - Help card: drop the one-month wording, describe the filters (Task 3's set), and say a filtered view's URL can be shared.
  - **Done when:** `npm run check` passes; `/orgs/<slug>/skill-track/checks?page=2` shows the second page; hand-edited `?skill=`/`?person=` params filter the list; `?page=0` and `?page=999` don't error; paging keeps the old rows on screen until the new page arrives.

- [x] **Task 3: the filter bar.** `visual` _feat(skill-track): filter bar on the Checks page_
  - **Files:** new `src/modules/skill-track/components/checks-filter-bar.tsx`, `checks-list.tsx`, `src/components/controls/date-range-picker.tsx`, `src/lib/schemas/date-range.ts`.
  - **Do:**
    - The filters in Decision 4, laid out as a wrapping row of compact controls above the table (`size="sm"` where the controls have it), each writing its param via the shared `useQueryStates` setters and resetting `page` to its default. Skill and Session options load with `useQuery` (not suspense) so the bar renders before they arrive. Clear filters resets every param.
    - Fix `DateRangePicker`/`formatDateRange` for their first real use: with only `from` set it says "until {from}" and with only `to` "from {to}" (swap them: "from …", "until …"); `formatDate` on a bare `YYYY-MM-DD` parses as UTC midnight, so a viewer west of UTC sees the day before (format the plain date without a time zone shift); and the calendar disables every day before 2024-01-01, so older back-dated checks can't be picked (lift that limit).
  - **Done when:** `npm run check` passes; each filter narrows the list, survives a reload, and changing one returns to page 1; changing a filter keeps the old rows and the filter bar on screen; Clear filters restores the full list; a one-ended date range reads correctly; a date before 2024 can be picked.

- [ ] **Task 4: Recent checks on the skill page.** `visual`
  - **Files:** `src/modules/skill-track/components/skill-content.tsx`, `content/help/skill-track/skills.mdx` (lines ~22-24 describe Related).
  - **Do:** Per Decision 11: the Related card's condition changes from `coverageAvailable` to the existing `<Protect permissions={{ skillCheck: ["view"] }}>` alone; Skill Coverage moves inside a `coverageAvailable` check; Recent checks follows it as an `Item` with title **Recent checks**, description "checks of this skill", and the same `ItemLinkActionIcon`. Update the comment above the card. The help card says Recent checks shows for every skill and Skill Coverage only for skills you can assess.
  - **Done when:** `npm run check` passes; the link opens the Checks page filtered to that skill; the card shows (with Recent checks only) on an archived skill.

## Docs impact

The Checks page is now a filterable search over all checks, not the last month: the Skill Track checks guide page (`content/docs/skill-track/`) and its Checks page screenshot change, and the skill page's Related card gains Recent checks and now shows on every skill (skill page screenshot).

## Out of scope

- Free-text search across names, column sorting, multi-select filters, saved searches, CSV export.
- Archived skills in the Skill filter's options (a link to one still works).
- A composite index for the query (Decision 8).
- A check detail page, or editing checks from this list.
- Using the search anywhere but the Checks page and the skill page link (e.g. from a person's page).

## Parked

- **`formatDate` on bare `YYYY-MM-DD` strings shows the day before west of UTC.** `formatDate` (`src/lib/datetime.ts`) parses its input as an instant, so a plain date string becomes UTC midnight. Task 3 added `formatPlainDate` in `src/lib/schemas/date-range.ts` for the date range picker but left `formatDate` alone. Other callers may pass plain dates, for example D4H `dateExpires` in `issued-type-content.tsx`. Audit the callers and route plain dates through `formatPlainDate`.
