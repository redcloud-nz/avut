# Detail cards on `DataItem`, with short values inline on mobile

**Date:** 2026-10-06
**Issue:** [#351](https://github.com/redcloud-nz/avut/issues/351) (from `docs/ideas/2026-10-02-cleanup.md` item 7)
**Branch:** `feat/datalist-detail-cards`
**Worktree:** `.claude/worktrees/datalist-detail-cards`, with its dev server on 3106 (its `.dev-port`).
**DB:** no migration and no schema change.
**Written against:** integration @ 7a2fe1b9

## Goal

`DataItem` (`src/components/ui/data-item.tsx`) becomes the one title/value row component. Every detail card that uses `DL`/`DLTerm`/`DLDetails`/`DLDateDetails` moves onto it. Short values sit beside their label on every screen width, so a phone no longer spends two lines per field. `description-list.tsx` and `description-list-date.tsx` are deleted at the end.

## Decisions

- **Plain `<div>`s, not `<dl>`/`<dt>`/`<dd>`.** This departs from the issue's "Semantics" bullet; the user decided it on 2026-10-06. It matches `Item` (`item.tsx`). A `<dl>` adds little for screen readers: the title is still read before its value in source order. Its content model would also force the action slot into a fake `<dd>`, and make any wrapper `<div>` between the list and a row (`Suspense` fallbacks, `<Protect>`) invalid HTML.
- **`DataList`** is a new export of `data-item.tsx`. It renders a `<div data-component="DataList">` and is the container for every `DataItem`. It carries `DL`'s `-my-3` offset inside `CardContent` (rows have `py-3`, and that offset cancels the first and last row's padding against the card's).
- **Every `DataItem` lives in a `DataList`, settings cards included.** The four `src/components/user/user-settings/` files that use `DataItem` today (`datetime-settings.tsx`, `user-account-settings.tsx`, `user-modules.tsx`, `user-profile.tsx`) get wrapped, so there's one layout model. They pick up the `-my-3` offset, which brings their spacing in line with detail cards; the first visual checkpoint checks that. `SettingRow` (`src/components/admin/organization-settings/setting-row.tsx`) is a separate component and is out of scope.
- **The `inline` prop on `DataItem`** keeps `'title value action'` at every width. Without it, a row keeps today's stacked mobile layout (`'title action' / 'value value'`). From `sm` up the two look the same.
- **Inline values in one card line up.** Each `DataItem` today is its own grid, so with a content-sized title column the values would start at a different x on each row. Make `DataList` the grid and each `DataItem` a `grid-cols-subgrid col-span-full` row, so title, value and action columns are shared within a card. The `sm`+ title column stays `min(30%, --spacing(80))`, as now. Below `sm` the title column sizes to the card's widest inline label, capped so a long label ("Revalidation Frequency") wraps rather than squeezing the value. The exact track sizes are the implementer's call, against the criteria in Task 1, and get tuned at the first visual checkpoint. If subgrid turns out not to fit, fall back to a fixed mobile title width. Don't fall back to unaligned `auto` columns. Consequences of the subgrid:
  - `col-span-full` (`1 / -1`) only reaches explicit tracks, so `DataList` defines an explicit three-track template at every width, mobile included. Stacked mobile areas become `'title title action' / 'value value value'`. Spanning keeps stacked titles and values out of the title column's intrinsic sizing, which is what we want.
  - Rows must be **direct children** of `DataList`; fragments are fine. A wrapper element (a `Suspense` fallback `<div>`, a `<Protect>` that renders a div) breaks the alignment. None of today's call sites has one. Say so in `DataList`'s doc comment.
  - The action column is one shared `auto` track per list, so in a card where only some rows have an action, the rows without one also give up that width. That's fine today: the settings cards have an action on nearly every row, and the detail cards have none.
  - The value track is `minmax(0, 1fr)` and `DataItemValue` gets `min-w-0 break-words`, so one long word can't widen the shared track past the card edge.
  - Inline rows align to the top (`items-start`), so with a two-line value (`DataItemDateValue`, a wrapping `Owner`) the label stays on the first line instead of centring between the two.
- **Inline or stacked is per field.** Inline: IDs, names, titles, slugs, dates, statuses, Yes/No values, counts, servers, roles, short D4H references, links to a related entity. Stacked (no `inline`): descriptions, notes, emails (too long beside a label at 320px), `Parents` on the D4H item page, and anything rendering several lines. Tasks list the stacked fields per file. Anything not listed there is inline.
- **`DataItemDateValue` replaces `DLDateDetails`.** It lives in a new `src/components/ui/data-item-date.tsx` with `"use client"`, since it reads `usePreferences()`. `data-item.tsx` re-exports it, the way `description-list.tsx` re-exports `DLDateDetails`, so `data-item.tsx` stays usable from Server Components (`admin/organization/page.tsx`, `cards/user-profile-info.tsx`). It renders the preset timestamp in `<time dateTime={iso}>` with the relative time muted on the line below, and is used in an `inline` row. `description-list-date.test.tsx` moves to `data-item-date.test.tsx` and gains a `dateTime` assertion.
- **Hand-written Created/Updated/Last synced rows move to `DataItemDateValue`.** These rows call `formatDateTime`/`formatRelativeDateTime` from `@/lib/datetime` and so ignore the viewer's presets. Moving them fixes the date-format part of #352 for these cards. The files are `access-token-content.tsx`, `template-content.tsx`, D4H brand `page.tsx`, `person-content.tsx`, `catalogue-package-content.tsx`, and `skill-content.tsx`/`group-content.tsx`/`package-content.tsx`. Drop the now-unused `@/lib/datetime` imports. The brand page's `Updated` shows a single line today; after this it gets the relative line too.
- **Other dates stay as they are** (the session's `Date` via `formatDate`). That's #352's sweep.
- **Rows inside conditionals** (`{x && (<>…</>)}`) keep their conditionals; each fragment now holds one `DataItem` in place of a `DLTerm` + `DLDetails` pair.
- **`className`s on `DLDetails` carry over** to `DataItemValue` (for example `font-mono` on IDs).

## Tasks

Each task is one commit. Every migrated card follows the same mechanical shape:

```tsx
<DL>
    <DLTerm>Team ID</DLTerm>
    <DLDetails className="font-mono">{team.id}</DLDetails>
    <DLTerm>Created</DLTerm>
    <DLDateDetails date={team.createdAt} />
</DL>
// becomes
<DataList>
    <DataItem inline>
        <DataItemTitle>Team ID</DataItemTitle>
        <DataItemValue className="font-mono">{team.id}</DataItemValue>
    </DataItem>
    <DataItem inline>
        <DataItemTitle>Created</DataItemTitle>
        <DataItemDateValue date={team.createdAt} />
    </DataItem>
</DataList>
```

For a migration task, "done" means: the files no longer import `@/components/ui/description-list`, `npm run check` passes, and each changed page renders in the browser without errors.

### Task 1: `DataList`, the `inline` variant and `DataItemDateValue`

- [x] `feat(ui): DataList grid, inline DataItem rows and DataItemDateValue`
- **Files:** `src/components/ui/data-item.tsx`; new `src/components/ui/data-item-date.tsx`; `src/components/ui/description-list-date.test.tsx` → `src/components/ui/data-item-date.test.tsx` (`git mv`, then edit); `src/components/user/user-settings/{datetime-settings,user-account-settings,user-modules,user-profile}.tsx`.
- **Do:**
  - Add `DataList` and the `inline` prop, and switch rows to the subgrid layout, as in Decisions.
  - Update the doc comments: drop the reference to `DLActions`/`description-list.tsx`, and describe `inline` and `DataList`.
  - Add `DataItemDateValue({ date, className, ...props })` in `data-item-date.tsx`: a `DataItemValue`-styled `<div>` (`[grid-area:value]`) holding `<time dateTime={new Date(date).toISOString()}>{formatDateTime(date)}</time>` with `<div className="text-muted-foreground">{formatRelativeDateTime(date)}</div>` below it, both formatters taken from `usePreferences()`. Re-export it from `data-item.tsx`.
  - Port the test file to `DataItemDateValue`, and assert the `<time>` element's `dateTime`.
  - Wrap each settings card's rows in `<DataList>`. Those rows stay stacked (no `inline`).
  - Leave `description-list*.tsx` in place: nothing has migrated yet.
- **Done when:**
  - `npm run check` passes, including the moved test.
  - In a `DataList` at 320px wide (Chrome DevTools device emulation):
    - the values of a card's inline rows start at the same x
    - `Created` beside a preset timestamp ("02 Oct 2026 10:14 PM") stays on one line
    - `Created` sits on the timestamp's line, not centred between the timestamp and the relative line
    - a long inline label wraps instead of pushing its value below half the row's width
    - a long unbroken value wraps, and nothing overflows the card horizontally
    - a stacked row still puts its value on its own line, with the action top-right
  - From `sm` up, a row looks as it does today.
- **`visual`**

### Task 2: Session details card

- [ ] **Files:** `src/components/skill-track/session-content.tsx`.
- **Do:** migrate both cards (Session Details, and Created/Updated). Stacked: `Notes`. Everything else is inline.
- **Done when:** the migration criteria above hold. On a phone-width viewport the Session Details card's fields take one line each, Notes apart, and the Created/Updated card takes four lines.
- **`visual`**: **checkpoint 1** after this task. Show the session page and `/user/settings` at 320px and at desktop width, and tune the track sizes before the sweep.

### Task 3: Personnel and teams

- [ ] **Files:** `src/components/admin/personnel/person-content.tsx`, `src/components/admin/personnel/linked-user-card.tsx`, `src/components/admin/teams/team-content.tsx`, `src/components/admin/teams/team-membership-content.tsx`, `src/components/admin/teams/d4h-link-card.tsx`.
- **Do:** migrate every card. Stacked: `Email` (person, linked user) and `Description` (team). `person-content.tsx`'s hand-written Created/Updated rows become `DataItemDateValue`. Keep the `Last synced` fallbacks in `d4h-link-card.tsx` and `team-membership-content.tsx`: the fallback goes into a `DataItemValue`, beside the `DataItemDateValue` branch. `D4H Team` and `D4H Organisation` (`name (ID: n)`) are inline, and wrap in their column.
- **Done when:** the migration criteria above hold for a person, a team, a membership with a D4H link, and a team with a D4H link.

### Task 4: Users, organisation and the org's D4H access tokens

- [ ] **Files:** `src/components/admin/users/user-content.tsx`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/organization/page.tsx` (a Server Component), `src/components/admin/organization/d4h-org-card.tsx`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/d4h-access-tokens/[token_id]/access-token-content.tsx`.
- **Do:** migrate every card. Stacked: `Email` (both, in `user-content.tsx`). `D4H Organisation` in `d4h-org-card.tsx` is inline, as in Task 3. Its `Last synced` keeps the `Never` fallback, carried over the same way as in Task 3. `access-token-content.tsx`'s hand-written Created row becomes `DataItemDateValue`. `organization/page.tsx` must stay a Server Component, so import from `data-item.tsx` only.
- **Done when:** the migration criteria above hold. The organisation page still renders server-side (no `"use client"` added).

### Task 5: D4H views and i3 templates

- [ ] **Files:** under `src/app/(wrapper)/(authenticated)/orgs/[slug]/`: `d4h-views/equipment/brands/[brand_id]/page.tsx`, `d4h-views/equipment/categories/[category_id]/page.tsx`, `d4h-views/equipment/categories/[category_id]/kinds/[kind_id]/page.tsx`, `d4h-views/equipment/items/[item_id]/page.tsx`, `d4h-views/members/[team_id]/[member_id]/page.tsx`, `i3/templates/[template_id]/template-content.tsx`.
- **Do:** migrate every card. Stacked: `Parents` (item), `Email` (member), `Description` (template). The brand's `Updated` and the template's hand-written Created/Updated become `DataItemDateValue`. The `Owner` rows (title plus muted id) are inline.
- **Done when:** the migration criteria above hold. D4H views need an org with a D4H token, so where none is available, `npm run check` passing and a typecheck of the JSX are the bar, and the task report says which pages weren't opened.

### Task 6: Skill package builder and the skill-track catalogue

- [ ] **Files:** `src/components/skill-package-builder/package-content.tsx`, `src/components/skill-package-builder/group-content.tsx`, `src/components/skill-package-builder/skill-content.tsx`, `src/components/skill-track/catalogue-package-content.tsx`.
- **Do:** migrate every card. Stacked: `Description` (all four). The hand-written Created/Updated rows in all four become `DataItemDateValue`.
- **Done when:** the migration criteria above hold for a package, a group, a skill and a catalogue package.

### Task 7: System admin, user settings and the profile card

- [ ] **Files:** `src/components/system/admin/organizations/organization-content.tsx`, `src/components/system/admin/users/user-content.tsx`, `src/components/user/user-settings/d4h-access-token-content.tsx`, `src/components/user/user-settings/organization-content.tsx`, `src/components/cards/user-profile-info.tsx` (a Server Component).
- **Do:** migrate every card. Stacked: `Email` (system user, profile card). `Your Roles` (badges in a `flex-wrap`) is inline.
- **Done when:** the migration criteria above hold, and `user-profile-info.tsx` still has no `"use client"`.

### Task 8: Delete `DL` and update the catalogue

- [ ] **Files:** delete `src/components/ui/description-list.tsx`, `src/components/ui/description-list-date.tsx`; edit `src/components/ui/README.md` and `docs/patterns/entity-link.md`.
- **Do:**
  - Delete both files.
  - Rewrite the `<DLDetails>` example in `docs/patterns/entity-link.md` as a `DataItemValue` inside `<DataItem inline>`.
  - In the README, drop their rows and the `data-item.tsx` + `description-list.tsx` "related components" bullet. Rewrite the `data-item.tsx` row to cover `DataList`, `inline` and the re-exported `DataItemDateValue`, and add a `data-item-date.tsx` row, following `/avut-update-ui-readme`'s format.
  - Leave the historical mentions in `docs/plans/` and `docs/ideas/` alone.
- **Done when:** `grep -rn "description-list\|DLTerm\|DLDetails\|DLDateDetails" src docs/patterns` is empty, and `npm run check -- --all` passes.
- **`visual`**: **checkpoint 2** after this task. Spot-check one page from each of Tasks 3–7 at 320px and at desktop width.

## Out of scope

- The rest of #352: threading display preferences into `formatDate`, Kaga date columns, `FieldValue`, and the raw `toLocale*` calls.
- `SettingRow` and the organisation settings page.
- `FieldValue` (`field-value.tsx`) and other key/value displays that never used `DL`.
- Adding `role="group"`/`aria-labelledby` to rows. That's available if a screen-reader need shows up later.
