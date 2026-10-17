# Docs layout: header search, three columns, scrollable and mobile nav; glossary hides flag-hidden terms

**Date:** 2026-10-17
**Issues:** [#378](https://github.com/redcloud-nz/avut/issues/378), [#363](https://github.com/redcloud-nz/avut/issues/363)
**Branch:** `feat/docs-layout`, worktree `.claude/worktrees/docs-layout` (dev server on its `.dev-port`, 3107)
**DB:** no migration; shared `avut`.
**D4H:** not involved.
**Written against:** integration @ 12d0c8d1

## Decisions

- **The docs get their own sibling route group, `(public)/(docs)/docs/…`, instead of a slot threaded through the marketing layout.** `PublicHeader` is rendered by `(public)/(marketing)/layout.tsx`, above the docs layout, so the docs layout can't hand it props today. `(public)/auth/layout.tsx` already sets the precedent: a sibling group whose layout renders `PublicHeader` + `PublicFooter` with its own props. URLs don't change (route groups drop out of the path; `src/proxy.ts` matches on `/docs`). Rejected: a path-aware header (the issue argues against it) and a parallel-route `@header` slot (needs a `default.tsx` per segment and fights the `[[...slug]]` catch-all).
- **`PublicHeader` gets two optional slots and a flag:** `menu` (rendered before the logo, grouped with it; the mobile nav trigger), `search` (first inside the right-hand `<nav>`; the docs search), and `wide`, which swaps its `max-w-[1120px]` container for `max-w-7xl`, so the header's edges line up with the three columns. The docs body uses the header's horizontal padding. Other pages pass nothing and render exactly as now.
- **`DocsSearch` gets `className` (for the input's width) and `align: "start" | "end"` (popover edge) props.** It's narrower in the header at `md` (`md:w-40 lg:w-56`) so the header row doesn't overflow, and full width in the mobile sheet.
- **"On this page" reuses `SaratogaContents`,** taught to measure against the window when it has no `[data-slot="scroll-container"]` ancestor. Two new optional props: `offset` (px from the top of the scroll viewport to the trigger line; default 24, the current behaviour) and `className` (merged with `cn`, so the docs page can set its own `sticky top-…` below the sticky header and its own breakpoint). Settings pages pass neither and are unaffected.
- **Heading labels and levels come from the content-collections transform,** not from reading the rendered DOM. `headingAnchors` already walks the markdown with the same slugger as `rehype-slug`. It becomes `headingOutline(markdown): { id, label, depth }[]`, and `headingAnchors` stays as `headingOutline(...).map(h => h.id)`, so its consumers (including the help-card guide check) are untouched. Docs gain a `headings` field. The contents list shows depth 2 entries with the depth 3 entries after them nested as `children`. A depth 3 heading before any depth 2 one becomes a top-level entry. `#` (the page title) and depth 4+ are left out.
- **The three-column split lives in the doc page, not the layout.** The layout is nav | main. `docs/[[...slug]]/page.tsx` renders article | contents inside `main`, because only a guide has headings. Glossary and What's new stay single-column at `max-w-3xl`, now set on their own root elements. The contents column shows from `xl` up. At exactly `xl` (1280px) the article shrinks to roughly 690px to make room. That's an acceptable reading width, and it reaches its full `max-w-3xl` from about 1360px.
- **On mobile (below `md`), search moves into the nav sheet.** The header row is already crowded at that width. A menu button before the logo opens a left `Sheet` holding `DocsSearch` and the sidebar. It closes when a link inside it is clicked (including the current page's) and when the pathname changes. Escape while the search results are open closes only the results, not the sheet. From `md` up, search sits in the header and the trigger is hidden.
- **The mobile sheet keeps the Suspense split without a second loader.** `DocsMobileNav` is a client component that is always enabled and takes its nav as `children`. The layout passes the existing `<Suspense fallback={<DocsNav_Skeleton />}><DocsNav /></Suspense>` (docs/reviews/2026-09-12-suspense-boundaries.md §3). The layout stays non-async.
- **#363: a glossary entry is hidden when it is tagged with modules and every one of them is hidden.** Entries with no `modules` always show. The check uses the same `hiddenDocsSectionIds()` set as doc sections. A kept entry shows badges only for its visible modules. "See also" links to a hidden entry are dropped, since its anchor no longer exists. The glossary page gets the same static shell + in-page Suspense split as the doc page, because the filter reads headers.

## Tasks

### Review group 1: data and plumbing

- [x] **1. Glossary hides terms for flag-hidden modules (#363)** — feat(docs): hide glossary terms for flag-hidden modules (#363)
  - **Files:** `src/lib/glossary.ts`, `src/lib/glossary.test.ts`, `src/server/docs.ts`, `src/app/(public)/(marketing)/docs/glossary/page.tsx`
  - **Do:**
    - In `src/lib/glossary.ts`, add a pure `visibleGlossaryEntries(entries, hidden: ReadonlySet<string>): GlossaryEntry[]`. It drops entries whose `modules` is non-empty and entirely in `hidden`. For kept entries it removes hidden ids from `modules` (badges) and drops `relatedTerms` slugs that aren't in the kept set. JSDoc it with the rule from Decisions. Keep it here, not in `src/server/docs.ts`, so its test doesn't import `@/lib/flags` (whose `vercelAdapter()` runs at import time).
    - In `src/server/docs.ts`, add `getVisibleGlossaryEntries()`: `visibleGlossaryEntries(getGlossaryEntriesSorted(), await hiddenDocsSectionIds())`.
    - Glossary page: keep the `<h1>` and intro paragraph static. Move the `<dl>` into an async `GlossaryEntries` component behind `<Suspense>` inside `page.tsx` (not a `loading.tsx`), with a short skeleton fallback. It awaits `getVisibleGlossaryEntries()`. Add a comment explaining why the page isn't `async`, in the style of `docs/[[...slug]]/page.tsx`.
  - **Done when:** `glossary.test.ts` covers: an entry with no modules is kept; one whose only module is hidden is dropped; one with a hidden and a visible module is kept with only the visible badge; a `relatedTerms` slug pointing at a dropped entry is removed. On the dev server, entries for flag-hidden modules (e.g. the I3 `ppe-template` entry with dev defaults) disappear from `/docs/glossary` and the rest render. `npm run check` passes.

- [x] **2. Heading outline with labels and levels** — feat(docs): heading outline with labels and levels
  - **Files:** `content-collections/heading-anchors.ts`, `content-collections/heading-anchors.test.ts`, `content-collections.ts`
  - **Do:**
    - Add `export interface HeadingOutlineItem { id: string; label: string; depth: number }` and `headingOutline(markdown)`, which walks the markdown exactly as `headingAnchors` does now and records the `#` count as `depth`. `label` is the heading's display text: `headingText(...)` with emphasis and code markers (`*`, `` ` ``) removed and whitespace collapsed. The slug is still computed from `headingText(...)` as today, so ids don't change.
    - Re-implement `headingAnchors` as `headingOutline(markdown).map((h) => h.id)`.
    - In the docs collection transform, add `headings: headingOutline(doc.content)` next to `anchors`, with a JSDoc saying what it's for ("On this page") and that it's computed over the whole document like `anchors`. The file can't use `@/` imports (see the header comment of `heading-anchors.ts`).
  - **Done when:**
    - Unit tests show `headingOutline` gives depth and clean labels: ``"## The `code` part"`` → label `The code part`; `"### See [the guide](/x)"` → label `See the guide`, depth 3.
    - `compiledHeadingIds` in the test is extended to capture the tag level (`/\.h([1-6]),\{id:"([^"]*)"/g`), and a per-doc test asserts `doc.headings.map(({ id, depth }) => ({ id, depth }))` equals the rendered `(depth, id)` sequence across intro + rest.
    - Existing tests pass unchanged. `npm run check` passes.

- [x] **3. Docs move into their own route group** `mechanical` — refactor(docs): move docs into their own route group
  - **Files:** move `src/app/(public)/(marketing)/docs/**` to `src/app/(public)/(docs)/docs/**` (`git mv`); `src/app/(public)/(docs)/docs/layout.tsx`; `src/app/(public)/(marketing)/layout.tsx` (header comment); `src/components/docs/docs-search.tsx` and `src/components/docs/help-sheet.tsx` (their `@/app/(public)/(marketing)/docs/…` type imports).
  - **Do:**
    - Move the whole `docs` segment into the new `(docs)` group with `git mv`, then run `npx next typegen`. Fix the two type imports.
    - The docs layout renders the full shell itself, as `(public)/auth/layout.tsx` does: the `flex min-h-svh w-full flex-col bg-background text-foreground` wrapper, `<PublicHeader />`, the existing docs body (sub-bar included, unchanged for now), `<PublicFooter />`. No visual change in this task. Update the header comments: the marketing layout no longer covers `/docs`, and the docs layout now owns its header and footer.
  - **Done when:** `/docs`, a guide, `/docs/glossary`, `/docs/updates`, `/docs/search-index.json` and a `/docs/help/…` route all respond as before; `grep -rn "(marketing)/docs" src` finds nothing. `npm run check` passes.

_End of review group 1._

### Review group 2: layout (visual checkpoint)

- [x] **4. Search moves into the header** `visual` — feat(docs): move docs search into the public header
  - **Files:** `src/components/nav/public-header.tsx`, `src/components/docs/docs-search.tsx`, `src/app/(public)/(docs)/docs/layout.tsx`
  - **Do:**
    - `PublicHeader` gains `menu?: ReactNode`, `search?: ReactNode` and `wide?: boolean` (see Decisions), each with a one-line JSDoc as `showCta` has. `menu` renders before the logo link, the two grouped in a `flex items-center gap-2` wrapper. `search` renders first inside the `<nav>`. `wide` swaps `max-w-[1120px]` for `max-w-7xl`.
    - `DocsSearch` gains `className?: string` (merged onto the `Input`, replacing the hardcoded `w-40 sm:w-56` default) and `align?: "start" | "end"` (default `"end"`: the popover's `right-0`; `"start"`: `left-0`).
    - The docs layout passes `wide` and `search={<DocsSearch className="hidden md:block md:w-40 lg:w-56" />}` (or wraps it so it's hidden below `md`), and deletes the `h-14 … border-b` sub-bar (the "AVUT Docs" link and its search). Keep the layout non-async and `<DocsNav>` behind its `<Suspense>`.
  - **Done when:** search works from the header on `/docs` pages; the header row doesn't overflow at `md` (768px), signed out; `/`, `/tools` and `/policies/*` look exactly as before. `npm run check` passes.

- [x] **5. `SaratogaContents` works with window scroll** — feat(blocks): SaratogaContents works with window scroll
  - **Files:** `src/components/blocks/saratoga-contents.tsx`
  - **Do:**
    - When `navRef.current?.closest('[data-slot="scroll-container"]')` is null, measure against the window: listen for `scroll` on `window`; "at the bottom" is `window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1`; the trigger line is `offset` px from the viewport top. With a container, the trigger line stays `container.getBoundingClientRect().top + offset`, so the existing path is unchanged.
    - Add optional props `offset?: number` (default `24`) and `className?: string`, merged onto the `<nav>` with `cn("hidden lg:block sticky top-4 text-sm", className)`. Give `SaratogaContentsSpacer` a `className` prop too, merged the same way (Task 6 gates it to `xl`). Update the header comment to mention both scroll modes.
  - **Done when:** `npm run check` passes, and the org settings page's contents list still highlights sections as it scrolls (checked at this group's visual checkpoint).

- [x] **6. Three columns: scrollable nav and "On this page"** `visual` — feat(docs): three columns with scrollable nav and "On this page"
  - **Files:** `src/app/(public)/(docs)/docs/layout.tsx`, `src/app/(public)/(docs)/docs/[[...slug]]/page.tsx`, `src/app/(public)/(docs)/docs/glossary/page.tsx`, `src/app/(public)/(docs)/docs/updates/page.tsx`, `src/components/docs/docs-contents.tsx` (new), `src/components/docs/mdx-components.tsx` (only if `scroll-mt-20` needs changing)
  - **Do:**
    - **Layout:** the container becomes `mx-auto w-full max-w-7xl px-6 md:px-10` (the header's padding), so the edges line up. The sidebar `<aside>` keeps `hidden w-56 shrink-0 md:block`. Its inner wrapper becomes `sticky top-[<header height>] max-h-[calc(100svh-<header height>)] overflow-y-auto`, with the vertical padding moved inside it, so the whole nav is reachable at any scroll position. Measure the header's rendered height (about 61px: `py-3.5` around a 32px logo plus its border) and use one value throughout. `<main>` drops `max-w-3xl` and stays `min-w-0 flex-1`.
    - **Single-column pages keep their reading width:** the glossary page's root `<article>` and the updates page's root `<div>` get `max-w-3xl`.
    - **Doc page:** inside `DocsArticle`, render `<div className="flex gap-10">` with `<article className="min-w-0 max-w-3xl flex-1">` (existing content) and `<aside className="hidden w-52 shrink-0 xl:block"><DocsContents headings={doc.headings} /></aside>`.
    - **`DocsContents`** (client component): maps `headings` to `SaratogaContentsItem[]` per Decisions, and renders `<SaratogaContents items={…} offset={<header height + 24>} className="xl:block lg:hidden top-[<header height + 32>]" />` (whatever `cn` merge yields `xl`-only and sticky below the header). If the last headings can't reach the trigger line, add `<SaratogaContentsSpacer className="lg:hidden xl:block" />` at the end of the article (same idea: `xl`-only).
    - **Jump offset:** a heading's `scroll-mt` must stay at or below the trigger `offset`, or clicking an entry won't highlight it. `scroll-mt-20` (80px) against about 61 + 24 = 85px is fine; keep it unless the measured header height says otherwise. `mdx-components.tsx` is shared with the in-app `?help=` sheet, so if it changes, check the sheet too.
  - **Done when:** at `xl` a long guide (e.g. Skill Track → Sessions) shows nav | article | "On this page", with the current section highlighted while the window scrolls, and clicking an entry lands its heading just below the header, highlighted. The nav scrolls on its own once taller than the viewport. At `md`–`lg` the contents column is hidden. Glossary and What's new keep their `max-w-3xl` width. `npm run check` passes.

- [x] **7. Mobile nav sheet** `visual` — feat(docs): mobile nav sheet with search
  - **Files:** `src/components/docs/docs-mobile-nav.tsx` (new), `src/app/(public)/(docs)/docs/layout.tsx`, possibly `src/components/nav/public-header.tsx` (padding below `sm`)
  - **Do:**
    - `DocsMobileNav` (client) takes `children` (the nav). It uses `Sheet` from `src/components/ui/sheet.tsx`, `side="left"`. The trigger is a ghost icon `Button` (`MenuIcon` from lucide, `aria-label="Docs menu"`, `md:hidden`), always enabled. The content has a visually hidden `SheetTitle` ("Docs"), then `<DocsSearch className="w-full" align="start" />` and `children`, scrollable.
    - Controlled `open` state. Close it when the pathname changes, and on any click inside the content whose target is within an `a` element (so tapping the current page's link closes it too). Escape while the search results are open closes only the results: in `onEscapeKeyDown`, `preventDefault()` when the focused element is the search combobox with `aria-expanded="true"`.
    - The docs layout passes `menu={<DocsMobileNav><Suspense fallback={<DocsNav_Skeleton />}><DocsNav /></Suspense></DocsMobileNav>}`, reusing the existing `DocsNav`.
    - **Fit at 360px:** the signed-out header is about 296px of logo, toggle and CTAs. Adding the button must not overflow a 360px viewport. Use the `gap-2` menu+logo group from Task 4, and if needed tighten the header's horizontal padding below `sm` when `wide` is set (`px-4 sm:px-6 md:px-10`, matched by the docs body).
  - **Done when:** below `md` a menu button sits before the logo. It opens the nav with search. Picking a page (including the current one) or a search result closes the sheet. Escape in open search results closes only the results. From `md` up the button is gone. No horizontal overflow at 360px wide, signed out. `npm run check` passes.

_End of review group 2._

## Docs impact

None.

## Out of scope

- An "On this page" column for `/docs/glossary` (A–Z) or `/docs/updates` (per release).
- Glossary terms for hidden modules elsewhere: `<KeyTerms>` on a visible guide, and in-app glossary tooltips.
- Restyling the marketing header for non-docs pages.

## Parked
