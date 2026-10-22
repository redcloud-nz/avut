# Tinted shell pass: i3 tables, Hermes, notes, history, CommandInput, record-check focus

**Date:** 2026-10-22
**Branch:** `fix/tinted-shell-pass`, in `.claude/worktrees/tinted-shell` (dev server on its `.dev-port`, 3106)
**DB:** none. No schema change, shared `avut`.
**Written against:** integration @ d87c39f0
**Issues:** Fixes #388, Fixes #389, Fixes #390 (all follow-ups from #381)

The tinted shell (#381) put pages on a `--page` tint with white cards, and settled one rule (see "Controls vs cards" in [`src/components/ui/README.md`](../../src/components/ui/README.md)): anything clickable hovers to `bg-accent`, anything selected is `bg-selected` + `text-selected-foreground`, controls are raised white with `shadow-xs`, and cards are flat with a ring and never react to hover. This plan brings the surfaces the exploration skipped onto that rule.

## Decisions

- **#388's org settings half is already done:** #435 (worktree-card-in-card, merged) reworked the org settings page (see the comment on #390). What's left of #388 is the i3 pages.
- **i3 plain tables get a shared card panel, not Kaga.** Kaga already wraps its table in `rounded-lg bg-card ring-1 ring-foreground/10` (`kaga.tsx`, `data-slot="kaga-table-surface"`). Pull that panel out into a `TablePanel` in `ui/table.tsx`. Kaga and the four bare i3 tables both use it. The i3 tables keep their markup otherwise: no toolbar, sorting or pagination.
- **The i3 "Select Team" page (`i3/members/page.tsx`) needs no change.** Its `Item asChild` links are already controls under the rule.
- **The Hermes list pane is white,** a navigation surface like the sidebar: `bg-navbar`, the shell token that frames the page alongside the sidebar (white in light mode, the card shade in dark). The detail pane stays on the `--page` tint. Below `md` only the list shows, so the notes index is white on a phone while other pages stay tinted. That's intended: the list is navigation, like the sidebar sheet. Hermes is used only by the two notes layouts, so this and #389's notes list are one screen.
- **Notes list rows and object-history rows stay controls, not cards.** A notes row is a nav link and a history row is an expand trigger. Both are flat, full-width rows (like sidebar items, not raised buttons), with `hover:bg-accent`. The selected notes row (`aria-current="page"`) uses `bg-selected text-selected-foreground`.
- **`CommandInput` matches `Input`:** `border-input bg-transparent` (`dark:bg-input/30`), not the grey `bg-input/30` fill it has in light mode today. `CommandItem`'s highlighted row (`data-selected`) moves from `bg-muted` to `bg-accent text-accent-foreground`, the same as `SelectItem` and `DropdownMenuItem`.
- **The record-check dialog opens with no focus ring on an option.** It moves initial focus to the dialog content (`onOpenAutoFocus` → `preventDefault()` and focus the content element), so Tab still reaches the first option. It doesn't use `use-return-focus`: that handles closing, and this is about opening.
- **"Dialogs" in #390 is a check, not a task.** In light mode, `DialogContent` is `bg-popover` (white) with a `bg-muted/50` footer, matching `CardFooter`, and that already fits the rule. The dialog-group visual checkpoint looks at the session dialogs, the report scope dialogs and record-check, in light and dark mode. Anything off is fixed in-session as a checkpoint tweak.

## Tasks

### Review group 1: shared surfaces (Tasks 1–4), then visual checkpoint A

- [x] **Task 1: `TablePanel` in `ui/table.tsx`, used by Kaga** · `visual` · `mechanical` — feat(ui): add TablePanel and use it for the Kaga table surface
  - **Files:** `src/components/ui/table.tsx`, `src/components/blocks/kaga.tsx`, `src/components/ui/README.md`
  - **Do:** Add `TablePanel({ className, ...props }: React.ComponentProps<"div">)` to `table.tsx`. It renders `<div data-slot="table-panel" className={cn("overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10", className)} />` and is exported alongside the other table parts. In `KagaTable`, replace the hand-rolled `kaga-table-surface` div with `<TablePanel className="mt-2">`. First grep for `kaga-table-surface`: if anything (CSS, tests, docs) selects it, keep it as `data-slot` on the `TablePanel`. Otherwise use `table-panel`. Update the `table.tsx` row in `src/components/ui/README.md` to list `TablePanel` and say what it's for ("the card panel a table sits in on the page tint"), and add `TablePanel` to the "Controls vs cards" note as the card surface for tables.
  - **Done when:** Kaga tables look identical (same rounded white panel with a ring), `npm run check` passes, and the README lists `TablePanel`.

- [x] **Task 2: i3 tables onto `TablePanel`** · `visual` · `mechanical` — feat(i3): put the team member and equipment-kind tables in TablePanel
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/i3/teams/[team_id]/members/page.tsx`, `…/teams/[team_id]/members/[member_id]/page.tsx`, `…/teams/[team_id]/equipment-kinds/page.tsx`, `…/teams/[team_id]/equipment-kinds/[kind_id]/page.tsx`
  - **Do:** Wrap each bare `<Table>` (the ones that sit directly in `Saratoga.Root`, not inside a `Card`) in `<TablePanel>`. Give each header row `className="hover:bg-transparent"`, as Kaga does, so the header doesn't take the row hover. Two pages have category heading rows that span only part of the table: `teams/[team_id]/equipment-kinds/page.tsx:99-101` (`<TableHeadCell colSpan={2}>` in a 3-column table) and `members/[member_id]/page.tsx:260-264` (`<TableCell colSpan={2} className="font-semibold">` in a wider table). Make each span every column (`colSpan` = the table's column count), and give the row `className="bg-table-group hover:bg-table-group"`, the group band Glorious uses. Then they read as headings, not as rows that hover. Leave tables already inside a `Card` alone (`i3/components/templates/template-variants.tsx`).
  - **Done when:** each of the four pages shows its table in a white rounded panel on the page tint, the header row doesn't hover, and category rows are a full-width `table-group` band whose line reaches the panel edge and doesn't hover. `npm run check` passes. These pages read D4H, and the admin test account has no D4H token. If they can't be loaded with data, confirm the markup by reading it and say so.

- [x] **Task 3: Hermes list pane on `bg-navbar`** · `visual` — feat(ui): put the Hermes list pane on bg-navbar
  - **Files:** `src/components/blocks/hermes.tsx`, `src/components/notes/notes-list.tsx`
  - **Do:** Give `HermesList` `bg-navbar` so the list pane is white like the sidebar and navbar, keeping its `md:border-r`. `HermesDetail` stays on the page tint. Update the comment above `HermesList` (or the block's header comment) to say the list is a navigation surface on `bg-navbar`. In `notes-list.tsx`, the sticky toolbar is `bg-background`. Change it to `bg-navbar`, so it matches the pane in dark mode, where `--background` is darker than `--navbar`. `paneScroll`'s `[scrollbar-gutter:stable_both-edges]` pads both sides of the list, so the toolbar's `border-b`, each row's `border-b` and the row hover and selected fills (Task 4) all stop short of the pane's left edge. Give the list pane a one-edge `[scrollbar-gutter:stable]`: split `paneScroll` into the shared overflow and scrollbar-colour part plus a per-pane gutter, with `HermesDetail` keeping `stable_both-edges`.
  - **Done when:** at `md`+ on `/user/notes`, the list pane is white from the navbar to the bottom of the viewport, and the detail pane is tinted. The toolbar line, the row borders and the selected fill reach the pane's left edge. Below `md`, the list alone fills the width (white, by design). Dark mode is checked. `npm run check` passes.

- [x] **Task 4: notes list rows and object-history rows onto the accent hover** · `visual` · `mechanical` — feat(ui): put notes list and history rows on the accent hover
  - **Files:** `src/components/notes/notes-list.tsx`, `src/components/history/object-history.tsx`
  - **Do:** In `NotesList`, replace the row link's `hover:bg-muted/50` with `hover:bg-accent`, and `aria-[current=page]:bg-muted` with `aria-[current=page]:bg-selected aria-[current=page]:text-selected-foreground`. Keep the row flat and full-width, with no shadow or ring. In `ObjectHistory`'s `CollapsibleTrigger`, replace `hover:bg-muted/50` with `hover:bg-accent`. Both rows stay controls (see Decisions).
  - **Done when:** `grep -rn "bg-muted" src/components/notes/notes-list.tsx src/components/history/object-history.tsx` is empty. A hovered notes row and history row go translucent blue, and the open note's row is the selected fill, in light and dark mode. `npm run check` passes.

**Checkpoint A:** i3 team members / equipment kinds (`christchurch-cdem`), `/user/notes` (with a note, at desktop and phone width), `/orgs/demo/notes` (as `owner@demo.avut.nz`), and a history page such as `/orgs/christchurch-cdem/skill-track/sessions/<id>/history`.

### Review group 2: dialogs (Tasks 5–6), then visual checkpoint B

- [x] **Task 5: `CommandInput` and `CommandItem` onto the shared input and highlight** · `visual` · `mechanical` — feat(ui): put CommandInput and CommandItem on the shared input and accent highlight
  - **Files:** `src/components/ui/command.tsx`, `src/components/ui/README.md`
  - **Do:** In `CommandInput`, delete the `border-input/30 bg-input/30` override on the `InputGroup`. `InputGroup` already has `border border-input`, no light fill and `dark:bg-input/30`, so the search box then reads like an `Input` and like the `Select` trigger beside it in the report scope dialogs. Keep `h-8!`, `rounded-lg!` and `shadow-none!`. In `CommandItem`, change `data-selected:bg-muted data-selected:text-foreground` to `data-selected:bg-accent data-selected:text-accent-foreground`. Move the svg and `CommandShortcut` companions (`data-selected:*:[svg]:text-foreground`, `group-data-selected/command-item:text-foreground`) to `text-accent-foreground`. **Don't** add `SelectItem`'s `**:text-accent-foreground` descendant selector: in `SearchableSelect` it would recolour the `text-muted-foreground` subtitle and the outline `Badge`. Then check every `CommandInput`/`CommandItem` caller (`ui/searchable-select.tsx`, the three `skill-track/components/reports/*-scope-dialog.tsx`) for local overrides of these classes. `SearchableSelect` also drives the person picker, the timezone pickers, `create-check`, `link-person`/`link-user` and the system-admin add-member dialogs. Add `command.tsx` to the README's "Controls vs cards" note: its highlighted item uses `bg-accent`.
  - **Done when:** in `/orgs/christchurch-cdem/skill-track/reports/skill?action=select-scope`, the search box has the same border and fill as the Team select, and the keyboard-highlighted skill is translucent blue, in light and dark mode. `npm run check` passes.

- [x] **Task 6: record-check dialog opens without a focus ring** · `visual` — fix(skill-track): open the record-check dialog without a focus ring on a result
  - **Files:** `src/modules/skill-track/components/record-check-dialog.tsx`, `src/modules/skill-track/components/record-check-dialog.test.tsx`
  - **Do:** Follow `src/components/docs/docs-mobile-nav.tsx:63-68`, which already does this. On `<DialogContent mobile="sheet">`, add `onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement | null)?.focus(); }}` with a short why-comment. `DialogContent` passes Radix props through, and it is `outline-none`, so the focused dialog shows no ring. Focus then lands on the dialog itself, not the first result option, and Tab moves to the first option. In the test file, add a case that opens the dialog and asserts `document.activeElement` is the dialog (`getByRole("dialog")`), not an option button. Then `userEvent.tab()` and assert the first option has focus.
  - **Done when:** opening a check from a session's grid (`/orgs/christchurch-cdem/skill-track/sessions/4EoEfBbcJ8I2HEsH`, by person or by skill) shows no ring on any option, one Tab shows the ring on the first option, the new test passes, and `npm run check` passes.

**Checkpoint B:** the record-check dialog, the report scope dialogs (skill, person, team), one `SearchableSelect` popover (a timezone picker in user settings), and the session's Change personnel / skills / assessors dialogs, all in light and dark mode. The #390 "dialogs" check happens here. Fix anything off in-session.

## Docs impact

Visual only, with no behaviour change. Screenshots that may now look slightly different: the notes guide (white list pane, blue hover and selection), the skill-track reports scope dialogs (search box), and any i3 team members or equipment-kinds screenshots (table panel). No guide text changes.

## Out of scope

- Converting the i3 tables to Kaga (toolbar, sorting, pagination).
- Bare tables outside i3 (see Parked).
- Org settings: done in #435.
- The marketing and playground `bg-muted/40` bands, which are page sections, not controls.

## Parked

- Remaining `hover:bg-muted` outside this branch's screens: `ui/badge.tsx` (`outline` link hover, `ghost`) and `docs/docs-search.tsx` (result rows). Both should take the `bg-accent` hover.
- Session "When" picker: four modes. The modes are Start date only; Start date + time; Start date + End date; and Start date + Start time over End date + End time. Today "Add time" clears an end date, because a timed session can't span days. `SessionFormState` keeps `days` for all-day sessions only, `sessionInstants` lets a timed end wrap only to the next day, and `sessionFormState` turns a stored timed session of 24h or more back into an all-day one. All three, `use-format-session-when.ts` and their tests would change (`src/lib/session-timing.ts`, `skill-track/components/session-when-picker.tsx`). Raised at checkpoint B, where the tiles also went to two equal columns.
- Bare `Table`s on the page tint outside i3: `orgs/[slug]/admin/d4h-access-tokens/[token_id]/equipment-items/page.tsx` and `…/members/page.tsx`. Once `TablePanel` exists they can use it.
