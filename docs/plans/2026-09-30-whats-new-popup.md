# In-app "What's new" popup

**Date:** 2026-09-30
**Issue:** [#272](https://github.com/redcloud-nz/avut/issues/272)
**Branch:** `feat/whats-new`, worktree `.claude/worktrees/whats-new`
**DB:** Adds a migration. Run `npm run db:branch whats-new` before task 2's `migrate dev`. Stop the worktree's dev server first, and ask the user to close anything else connected to `avut`. `migrate dev` needs permission, even on the branch DB.
**Written against:** integration @ 5d0069ec

A per-user "what's new" dialog. It opens once, automatically, whenever there are product-update entries the user hasn't seen, and a link in the sidebar footer reopens it. Entries are MDX files in a new `updates` content collection, authored like `content/docs/**`. Each entry is also listed on a permanent `/docs/updates` page.

## Decisions

- **Content.** A new `updates` collection in `content-collections.ts`, with files in `content/updates/*.mdx` named `YYYY-MM-DD-<slug>.mdx`. The frontmatter has `title`, `publishedAt` (an ISO date, `YYYY-MM-DD`, read as 00:00 UTC), an optional `description` and an optional `version` (the release it shipped in, for display only). The MDX body is the content. The entry's slug is its filename without the extension, and it becomes the `#anchor` on `/docs/updates`. Entries don't depend on release versions.
- **No scheduling.** Every entry in the collection counts as published: merging an entry publishes it. `publishedAt` is only the display date and the cursor comparison. A "now"-based filter would make `/docs/updates` dynamic. A future `publishedAt` is an authoring error, and `content/updates/README.md` says so.
- **Seen state.** A new column, `User.lastSeenUpdatesAt DateTime?`. An entry is unseen when `publishedAt > cursor`. A **null cursor falls back to `User.createdAt`**. Existing users then catch up on entries published since they joined, and brand-new users don't get the backlog. A separate welcome popup for new users is a later idea (see Out of scope). The column is **not** added to better-auth's `user.additionalFields`. better-auth filters output to declared fields, so the column never reaches the session. It's read with its own query.
- **Mark seen.** Closing the dialog when it showed unseen entries sets the cursor to the **newest `publishedAt` among the entries it actually showed**. The client passes that date as `markSeen` input, and the server clamps it to at most the newest `publishedAt` in the collection. It never moves the cursor backwards. It is deliberately not `now`. Entries merge to `integration` and reach `production` only at the next release, so an entry dated 09-28 can deploy after a user dismissed on 10-01. A `now` cursor would hide that entry forever. The same rule stops an entry that deploys between fetch and dismiss from being marked seen unshown. Every entry the dialog showed is marked seen together.
- **Ties count as seen** (`publishedAt <= cursor`). An entry dated the same day as one a user has already seen won't show, so the authoring rules say: date an entry the day it merges, never earlier than the newest existing entry, and use the next day when that date is already taken by an entry that shipped in an earlier release.
- **Mark-seen isn't audit-logged.** It's a read cursor, like a notification read-state, not a change to the user record. Logging it would fill the User's object history with an entry on every dismissal. The procedure carries a comment saying this deliberately departs from the "always `logEvent`" rule. _(Flagged for the user at plan approval.)_
- **Impersonation.** While `ctx.auth.session.impersonatedBy` is set, `getUnseen` returns no entries and `markSeen` does nothing. The popup doesn't fire, and the impersonated user's cursor stays untouched.
- **Environments.** It fires in every environment (production, integration, previews and dev). Entries aren't tied to versions, so integration can surface them before a release.
- **Mount point.** The trigger lives in the shared `(wrapper)/(authenticated)/layout.tsx`, which covers the org, user and system scope roots. The layout `prefetch`es `whatsNew.getUnseen` and does not `await` it, because the popup isn't needed for first paint. Consumers read it with `useSuspenseQuery` inside their own `<Suspense fallback={null}>`, the same shape as `listMemberships` and `ScopeSwitcher`. A plain `useQuery` over a pending dehydrated prefetch is exactly the hydration-mismatch case the layout's comments warn about.
- **Dialog outside the sidebar.** The dialog and its auto-open logic mount **outside `<Sidebar>`**, next to `{props.modal}`. On mobile the offcanvas sidebar is a Radix `Sheet` whose content unmounts while closed, so a dialog inside it would never auto-open. The footer button shares the dialog's open state through a small context provider.
- **UI.**
  - An auto-opening `Dialog` (`size="xl"`) lists all unseen entries newest first: title, date and the MDX body rendered with `docsMdxComponents`. Its footer has "See all updates" and "Got it".
  - "See all updates" opens `/docs/updates` in a new tab, as `help-sheet.tsx` does for docs, because `/docs/updates` sits outside the app shell.
  - A small "What's new" button next to `VersionString` in the sidebar footer reopens the same dialog and carries a dot while any entry is unseen. It opens the unseen list while there is one, and otherwise the 10 most recent entries ("recent" mode, which marks nothing seen).
  - Entry dates are formatted as calendar dates in UTC, so a date-only `publishedAt` doesn't show as the previous day west of UTC.
  - The dialog's open state is local React state held in a context provider, not a nuqs `?action=` param. It isn't a mutation dialog, and opening it automatically on load shouldn't push a history entry.
- **Docs page.** `/docs/updates` is one changelog-style page with every entry in full, newest first. Each entry has an `id={slug}` anchor, and the page is linked from the docs sidebar under "Glossary". It's a static segment beside `docs/[[...slug]]`, like `docs/glossary`.
- **No service module.** The entry logic is pure functions in `src/lib/updates.ts`, and the Prisma read and write live in the router. There's no `src/server/services/whats-new.ts`, because only one router uses it (services are for logic reused across procedures or routers).
- **Release checklist.** The authoring step is a soft item in `docs/releasing.md` and the `/avut-release` skill, not a CI requirement, because not every release has user-facing changes.

## Tasks

- [ ] **1. `updates` content collection and read model**
  - **Files:** `content-collections.ts`, `content/updates/2026-09-30-whats-new.mdx` (new), `src/lib/updates.ts` (new), `src/lib/updates-shared.ts` (new, client-safe), `src/lib/updates.test.ts` (new)
  - **Do:**
    - **Collection.** Add an `updates` collection next to `docs` in `content-collections.ts`: `directory: "content/updates"`, `include: "*.mdx"`. Use the frontmatter schema from Decisions, including `content: z.string()` as `docs` has it (`compileMDX` reads it), and `publishedAt` as `z.iso.date()`. `transform` compiles the MDX with the same `mdxOptions` and adds `slug` (from `_meta.path`) and `mdx`. Register the collection in `defineConfig`.
    - **Seed entry.** Add one real first entry announcing the "What's new" feature itself, a couple of short paragraphs written for end users.
    - **Read model.** `src/lib/updates.ts` must be pure with no `server-only` (mirror `src/lib/docs.ts`). Export:
      - `getAllUpdates()`: every entry, newest first (sort by `publishedAt` descending, then `slug`)
      - `getUpdatesAfter(cursor: Date)`: entries with `publishedAt > cursor`
      - `getRecentUpdates(limit)`
      - `clampSeenCursor(requested: Date)`: `min(requested, newest publishedAt)`, used by `markSeen`
    - **Client-safe types.** Put `updatesHref(slug?)` (`/docs/updates` or `/docs/updates#<slug>`, cast to `Route` the way `docsHref` is) and the `UpdateEntryData` payload type (`slug`, `title`, `publishedAt` as an ISO date string, `description`, `version`, `mdx`) in `src/lib/updates-shared.ts`. That module mustn't import `content-collections`, which keeps the corpus out of the browser bundle, as `docs-sections.ts` does for `docs.ts`.
    - **Regenerate.** Run `npx next typegen` after changing `content-collections.ts`. It rebuilds `.content-collections/generated`, and `npm run check` doesn't do that unless route files changed.
  - **Done when:** `npm run check` passes and `.content-collections/generated` exports `allUpdates`. `updates.test.ts` covers:
    - sort order
    - the `getUpdatesAfter` boundary (an entry equal to the cursor counts as seen)
    - `clampSeenCursor` (a requested date later than the newest entry is clamped)

    Test against fixture entries (`vi.mock("content-collections", …)`), not the real corpus.

- [ ] **2. `User.lastSeenUpdatesAt` migration**
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_user_last_seen_updates_at/migration.sql` (new)
  - **Do:** Add `lastSeenUpdatesAt DateTime?` to `model User`, with a `///` doc comment: the "what's new" read cursor, null falls back to `createdAt`, see `src/lib/updates.ts`. Don't touch `src/server/auth.ts` `additionalFields`. Run `npm run db:branch whats-new` first (see the DB note above), then, **with the user's permission**, `npm run prisma migrate dev --name user_last_seen_updates_at`.
  - **Done when:** the migration contains only the `ADD COLUMN`, `npm run check` passes, and `npm run prisma migrate status` shows it applied on `avut_whats_new`.

- [ ] **3. `whatsNew` tRPC router**
  - **Files:** `src/trpc/routers/whats-new-router.ts` (new), `src/trpc/routers/_app.ts`, `src/trpc/routers/whats-new-router.test.ts` (new)
  - **Do:** Read `src/trpc/CLAUDE.md` first. Build `whatsNewRouter` on `authenticatedProcedure` with three procedures:
    - `getUnseen` (query): returns `{ entries: UpdateEntryData[] }`, which is `getUpdatesAfter(lastSeenUpdatesAt ?? ctx.auth.user.createdAt)`. Only `lastSeenUpdatesAt` needs a DB read. Return `[]` while `ctx.auth.session.impersonatedBy` is set.
    - `listRecent` (query): `{ entries: getRecentUpdates(10) }`.
    - `markSeen` (mutation): the input is `{ through: z.iso.date() }`, the newest `publishedAt` shown. Set `lastSeenUpdatesAt = clampSeenCursor(through)`. Skip the write if the stored cursor is already at or past that date (never move it backwards). Do nothing while impersonated. No `logEvent`; add a comment saying why, citing this plan's Decisions.

    Mount it as `whatsNew` in `_app.ts`. Tests use prisma-mock and `createCaller`, per `.claude/rules/testing.md` (`createAuthenticatedMockContext` accepts `session: { impersonatedBy }`). Use `vi.mock("content-collections", () => ({ allUpdates: fixture }))`, so the tests don't depend on the real, growing corpus. Cover:
    - a null cursor falls back to `createdAt`
    - a set cursor filters entries
    - impersonated: empty result, and `markSeen` doesn't write
    - `markSeen` clamps to the newest entry and never moves the cursor backwards

  - **Done when:** `npm run check` passes, including the new tests.

- [ ] **4. Release checklist and authoring guide**
  - **Files:** `docs/releasing.md`, `.claude/skills/avut-release/SKILL.md`, `content/updates/README.md` (new)
  - **Do:**
    - **`content/updates/README.md`.** It isn't collected, because the collection only includes `*.mdx`. It covers:
      - the filename convention and frontmatter fields
      - that entries are for end users (one entry per user-visible feature, not per release, and no infra or refactors)
      - that merging publishes an entry
      - the dating rules from Decisions: date an entry the day it merges, never earlier than the newest existing entry and never in the future, and use the next day when that date is already taken by an entry that shipped in an earlier release
      - that entries are separate from `docs/releases/v*.md`
    - **`docs/releasing.md`.** In step 1, add a soft item next to the release-notes step: review what's shipping and add a `content/updates/` entry for anything user-facing. It's reviewed but not enforced.
    - **`/avut-release` skill.** Add the matching step: after drafting `docs/releases/v$NEW.md`, list the user-facing changes in the range and offer to draft `updates` entries. Entries can also land earlier, with the feature's own PR.
  - **Done when:** the docs read consistently, and `npm run check` passes.

- [ ] **5. `/docs/updates` page** · `visual`
  - **Files:** `src/app/(public)/(marketing)/docs/updates/page.tsx` (new), `src/components/whats-new/update-article.tsx` (new, shared with task 6), `src/components/docs/docs-sidebar.tsx`
  - **Do:**
    - **Page.** A static page under the existing docs layout, alongside `[[...slug]]` the way `docs/glossary/page.tsx` is: an `h1` "What's new", a lead line, then every entry from `getAllUpdates()`. Add `metadata`. Run `npx next typegen` after adding the page.
    - **`UpdateArticle`.** The shared entry renderer, which the dialog reuses. It's an `<article id={slug}>` with a title linking to its own anchor, the date formatted as a calendar date in UTC (see Decisions → UI), an optional version badge and `<MDXContent code={mdx} components={docsMdxComponents} />`. If an entry's body starts with an `h1`, suppress it the way `help-sheet.tsx` does.
    - **Sidebar.** Add a "What's new" link to `DocsSidebar`, under "Glossary", in the same style.
  - **Done when:** `/docs/updates` renders the seed entry signed out, `/docs/updates#<slug>` scrolls to it, the sidebar link highlights while you're on the page, and `npm run check` passes.

- [ ] **6. What's new dialog, auto-open and footer button** · `visual`
  - **Files:** `src/components/whats-new/whats-new-dialog.tsx` (new, with the context provider), `src/components/whats-new/whats-new-button.tsx` (new), `src/components/whats-new/whats-new-dialog.test.tsx` (new), `src/client/whats-new-effects.ts` (new), `src/app/(wrapper)/(authenticated)/layout.tsx`
  - **Do:** Read `docs/patterns/detail-page-data-fetching.md` (prefetch + `useSuspenseQuery`) and `docs/patterns/mutation-dialog.md` (dialog shape, `meta.effects`), but keep open state local (see Decisions). Build:
    - **`WhatsNewProvider`.** Holds the open state and mode (`unseen` / `recent`) and exposes `open()` to the button through context. It wraps the sidebar and the dialog in the layout.
    - **`WhatsNewDialog`.** Mounted outside `<Sidebar>`, next to `{props.modal}`, inside its own `<Suspense fallback={null}>`.
      - It reads `whatsNew.getUnseen` with `useSuspenseQuery` and opens itself once when there are unseen entries.
      - It renders entries with `UpdateArticle` in a scrollable `Dialog size="xl"`. The footer holds "See all updates" (`updatesHref()`, `target="_blank"`) and "Got it".
      - Closing from `unseen` mode (Got it, X, Esc or clicking outside) calls `markSeen({ through: <newest shown publishedAt> })`.
      - `recent` mode fetches `whatsNew.listRecent` on open and marks nothing seen.
      - Snapshot the shown entries into local state when the dialog opens, so the list doesn't empty during the close animation.
    - **`markSeen` effect.** In `src/client/whats-new-effects.ts`: `write(trpc.whatsNew.getUnseen.queryKey(), { entries: [] })`, not an invalidate, so there's no refetch.
    - **`WhatsNewButton`.** A small ghost button, "What's new", next to `<VersionString layout="stacked" />` in `SidebarFooter`, inside its own `<Suspense fallback={null}>`. It shows a dot while `getUnseen` has entries. Clicking opens `unseen` mode if there are unseen entries, and `recent` mode otherwise.
    - **Layout.** `prefetch(trpc.whatsNew.getUnseen.queryOptions())`, not awaited.
    - **Component test.** Following `src/components/system/admin/impersonation-banner.test.tsx`, cover:
      - it auto-opens once when there are unseen entries
      - closing calls `markSeen` with the newest shown date
      - `recent` mode doesn't call `markSeen`
  - **Done when:**
    - with the cursor unset, the dialog appears on first authenticated load in any scope, including at a mobile width
    - it closes and doesn't return on reload or in another scope
    - the footer button reopens it with recent entries, and the dot disappears after dismissal
    - nothing appears while impersonating
    - `npm run check` passes, including the component test

## Out of scope

- A separate welcome or onboarding popup for brand-new users (the user's later idea). This plan just keeps new users from getting the backlog.
- Dismissing entries one at a time, or a per-entry read table.
- Per-entry pages (`/docs/updates/<slug>`), including updates in the docs search index, and RSS.
- Enforcing the release checklist item in CI.
- The public blog (#250) and any reuse of `docs/releases/v*.md`.
