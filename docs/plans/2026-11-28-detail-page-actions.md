# Detail-page actions: record-card menus and sidebar action cards

**Date:** 2026-11-28
**Branch:** `feat/detail-page-actions` (worktree `.claude/worktrees/detail-page-actions`)
**DB:** none, no migration
**Written against:** integration @ bd978299
**Issues:** #561 (actions), #555 (empty secondary column). Spike: `explore/app-shell` @ 72f327cf (`person-menu.tsx`, `session-menu.tsx`), worktree `app-shell`.

## Decisions

The direction from #561, settled:

1. **No page-level ⋮.** `Saratoga.Actions` holds only page-level navigation that isn't a record action: D4H ↗ (stays where it is today), a team picker that switches the page. Record actions leave it.
2. **Each record card gets a ⋮** (in its header strip, after its icons) for that record's non-primary actions: Archive/Restore/Recover, Delete, Unlink, Replace, Move, Export, owner/role changes. The card's icons (pencil, ↗ to a related record, D4H sync, refresh) stay beside it.
3. **History leaves every menu.** It's the card's "Updated" footer link. Notes have no record card, so the note's "updated" timestamp (`NoteCard`, view mode only) becomes the History link.
4. **Primary actions that need words go in cards at the top of the secondary column** (`ActionsCard`):
   - **Titled, with a one-line description,** when the action needs explaining or the page has more than one job (session: Record, Review; package builder: Publishing; nag rule: Run; I3 bundle: Compare; skill-track package: Subscription; D4H item: I3).
   - **Bare (no title),** when the button labels say it all (person: Invite / Link; org user: Link person; system user: Impersonate; team: Link to D4H).
5. **Hidden, not disabled,** for actions the viewer can't take because of permission or record state: callers leave them out of `actions` (and pass `null` for an action-card button). `disabled` stays only for short-lived in-flight states (export running, sync pending). A ⋮ with no actions, or an action card whose caller has no button to give it, renders nothing. This reverses the "disable, never hide" rule for menus in `protect-permission-gating.md` and `conventions-checklist.md`; both are rewritten in Task 1. The organisation menu's unbuilt "Delete" and system-admin's "No actions available" go.
6. **Actions with a home elsewhere stay there:** Add to team = Person's Team Memberships card Add; Add person = the org-admin team's Related card Add; Add organisation (system group) = the Members card's Add. Their ⌥N goes with the menu item, deliberately: ⌥N stays a list-page Create key.
7. **A single-item ⋮ stays a ⋮.** A lone Delete or Unlink as a bare icon sits one click from the pencil with no label, and pages would differ by how many actions the viewer happens to hold. (Open for the user at approval.)
8. **Button styles in action cards:** `outline` for every button except the one that moves the record to its next lifecycle state (Reopen, Publish, Invite to AVUT, Subscribe), which is the default (filled). At most one filled button per page.
9. **Keyboard:** the page's **primary record card** (the one the `<h1>` names) owns the shortcuts. Its pencil registers ⌥E; its ⋮ registers `Mod+.` and the ⌥ verb keys (⌥⌫, ⌥A). Other cards register none. `RecordCardMenu` and `RecordCardEditButton` take `primary` to opt in. On a page whose only ⋮ is on a non-primary card (skill-track package, organisation, team-admin team), `Mod+.` does nothing; accepted. Action-card buttons get no hotkeys.
10. **The pencil stays each update dialog's `DialogTrigger`.** `RecordCardEditButton` forwards its ref and spreads props so it can be `<DialogTrigger asChild>`'s child; each update dialog takes a `primary` prop and passes it on. Pages that edit by route (organisation `--update`) use it with `asChild` around a `Link`. The D4H item's disabled-with-tooltip pencil (`updateEquipmentItemDisabledReason`) keeps its tooltip: the reason (no token, not editable in D4H) is the information the viewer needs, so it's the one disabled control left.
11. **#555, the empty secondary column:** a page whose secondary column would be empty after this pass drops `Saratoga.Columns` and renders its cards full width (`Saratoga.Root`'s `max-w-5xl` still caps it). Pages that gain an action card keep the columns. Per page below.
12. **The mutation-dialog pattern holds:** buttons and menu items only set `?action=`; each page's dialogs stay mounted once, in its `*-menu.tsx`. Card ⋮s and action cards parse the same verb set but never mount dialogs, which `mutation-dialog.md` gets a line for. A dialog opened from a button that disappears on success (Link, Subscribe, Publish, Reopen, Return) returns focus through `useReturnFocus` with a `fallbackRef`.
13. **No D4H token:** the Link-to-D4H card and the bundle's Compare card still show; each dialog reports the missing personal token when opened, as today.
14. **Run now sends real email,** so the nag rule's Run card opens a confirm dialog for it (Dry run doesn't need one). The Run card is hidden while the rule is paused (the paused Alert explains it).

### Per-page action map

`✎` = card pencil (⌥E when primary), `⋮` = card menu, **card** = sidebar action card. "Columns" = what #555 does with the layout.

| Page                             | Primary card ✎ / ⋮                                                                       | Other cards                                    | Sidebar action card                                                                                         | Elsewhere                                 | Columns                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------- |
| org-admin person                 | Person: ✎ · ⋮ Archive/Restore/Recover, Delete; Link to user when unlinked and not Active | Linked User: ↗ · ⋮ Unlink                      | bare: Invite to AVUT (filled), Link to existing user — Active and unlinked only                             | Add to team → Team Memberships Add        | keep                                     |
| org-admin user                   | User: ✎ · ⋮ Make/Remove owner (`member: ["owner"]`, Remove not for self), Delete         | Linked Person: ↗ · ⋮ Unlink                    | bare: Link person — unlinked only                                                                           |                                           | keep (Teams card)                        |
| org-admin team / team-admin team | Team: ✎ · ⋮ Archive/Restore/Recover, Delete (team-admin: ✎ only)                         | Linked D4H Team: sync icon · ⋮ Unlink from D4H | bare: Link to D4H team — D4H on, unlinked                                                                   | Add person → Related card Add (org-admin) | keep                                     |
| org-admin team membership        | Membership: ⋮ Remove from team                                                           | D4H Member card moves to the secondary column  |                                                                                                             |                                           | keep (D4H Member) / full width when none |
| org-admin organisation           | Organisation: ✎ (→ `--update` route) · no ⋮                                              | D4H org card: sync icon · ⋮ Unlink from D4H    |                                                                                                             |                                           | full width                               |
| org-admin D4H access token       | Token: ✎, refresh icon · ⋮ Replace token value, Delete                                   |                                                |                                                                                                             |                                           | full width                               |
| user-settings D4H token          | Token: ✎, refresh icon · ⋮ Replace token value, Remove                                   |                                                |                                                                                                             |                                           | full width                               |
| user-settings organisation       | Organisation: ⋮ Leave                                                                    |                                                |                                                                                                             |                                           | full width                               |
| system-admin group               | Group: ✎ · ⋮ Delete                                                                      |                                                |                                                                                                             | Add organisation → Members card Add       | full width                               |
| system-admin user                | User: ⋮ Promote/Demote, Ban/Unban, Delete                                                |                                                | bare: Impersonate                                                                                           |                                           | keep                                     |
| skill-track session              | Session: ✎ (hidden while approved) · ⋮ Delete                                            |                                                | titled **Record** (by person / by skill; Reopen filled while approved), titled **Review**                   | header Record ▾ goes                      | keep                                     |
| skill-track package              | Package: —                                                                               | Subscription: ⋮ Unsubscribe                    | titled **Subscription**: Subscribe (filled), unsubscribed and not withdrawn; above the metric tiles         |                                           | keep                                     |
| skill-track group                | Group: —                                                                                 |                                                |                                                                                                             |                                           | full width                               |
| skill-package-builder package    | Package: ✎ · ⋮ Export .json, Archive/Restore/Recover, Delete                             |                                                | titled **Publishing** (needs `skillPackage: publish`): status line + Publish (filled) / Unpublish (outline) |                                           | keep                                     |
| skill-package-builder group      | Group: ✎ · ⋮ Archive/Restore/Recover, Delete                                             |                                                |                                                                                                             |                                           | full width                               |
| skill-package-builder skill      | Skill: ✎ · ⋮ Move, Archive/Restore/Recover, Delete                                       |                                                |                                                                                                             |                                           | full width                               |
| D4H equipment item               | D4H Item: ✎ (disabled with reason, Decision 10)                                          |                                                | titled **I3**: Return, via the page's slot                                                                  | D4H ↗ stays in `Saratoga.Actions`         | keep                                     |
| D4H I3 bundle                    | Bundle: ✎ · ⋮ Delete / Recover                                                           |                                                | titled **Compare**: Compare with a team (picker)                                                            |                                           | keep                                     |
| D4H I3 template                  | Template: ✎ · ⋮ Delete / Recover                                                         |                                                |                                                                                                             |                                           | full width                               |
| d4h-nag rule                     | Rule: ✎ · ⋮ Enable/Disable, Delete                                                       |                                                | titled **Run**: Dry run, Run now (confirm) — hidden while paused                                            |                                           | keep                                     |
| notes (org, user)                | no record card: ✎ in the note header (⌥E) · ⋮ Delete (`Mod+.`, ⌥⌫)                       |                                                |                                                                                                             | History → the "updated" timestamp         | Hermes, n/a                              |

Untouched: D4H catalogue/member/team pages (↗ only), self-audit campaign (out of scope), system-admin organisation, d4h-nag run, skill-track skill, I3 issued-type (its header ⋮ is "Show Columns" view options, not record actions).

## Tasks

### Group A — shared pieces and the two reference pages (visual checkpoint, plus a code read before the sweep)

- [x] **Task 1 — `RecordCardMenu`, `RecordCardEditButton`, `ActionsCard`, and the rules**
  - **Files:** new `src/components/ui/record-card-actions.tsx` (+ `record-card-actions.test.tsx`), `src/components/ui/README.md`, `src/lib/hotkeys.ts` (doc comments), new `docs/patterns/detail-page-actions.md`, `docs/patterns/protect-permission-gating.md`, `docs/patterns/mutation-dialog.md`, `docs/conventions-checklist.md`, `AGENTS.md` (one pointer line to the new pattern doc).
  - **Do:** Add the new components **beside** an untouched `EntityActionMenu` (every current page keeps working; each page task switches its own imports, Task 9 deletes the old one).
    - `RecordCardMenu`: icon-size ghost ⋮ sized for the `RecordCard` header strip, props `actions`, `category`, `after?`, `primary?`, `triggerRef?`, plus a trigger context like `useEntityActionMenuTrigger` for focus return. Renders nothing when `actions` is empty and `after` is null (callers pass `null`, not a component that renders null). `primary` gates `useMenuActionHotkeys` and the `Mod+.` registration (same open-with-first-item-focused behaviour as today). `disabled` stays for in-flight states only.
    - `RecordCardEditButton`: forwardRef pencil icon button spreading props (works as `DialogTrigger asChild` / `Button asChild` child); `label` for `aria-label`; registers ⌥E when `primary` by clicking itself.
    - `ActionsCard`: `title?`, `description?`, children; titled form = `CardHeader`/`CardTitle`/`CardDescription` + stacked buttons, bare form = the column only (`p-3`), as in the spike. Renders nothing when `children` is null/empty.
    - Docs: `detail-page-actions.md` from Decisions 1–14 (rules, not the per-page table); rewrite `protect-permission-gating.md`'s "Dropdown/menu items" section and replace checklist item 83 with the hide-not-disable rule for record-card menus and action cards; add the Decision 12 line to `mutation-dialog.md`.
  - **Done when:** tests cover: empty menu renders null, hotkeys only with `primary`, `Mod+.` opens with first item focused, ⌥E clicks a primary pencil only, `ActionsCard` null when empty. `npm run check` passes.

- [x] **Task 2 — Reference pages: org-admin person, skill-track session** `visual`
  - **Files:** `src/modules/org-admin/components/personnel/{person-menu,person-content,linked-user-card,update-person}.tsx`, `src/modules/skill-track/components/{session-menu,session-content,update-session}.tsx`, `content/help/admin/personnel.mdx`, `content/help/skill-track/session.mdx`.
  - **Do:** Port the spike's shape (`git show 72f327cf`) onto the Task 1 components, per the map rows. Person: `RecordCardMenu primary` in the Person card's `action`, the update dialog's trigger a `RecordCardEditButton primary`, Linked User card ⋮ (Unlink), bare `ActionsCard` at the top of the secondary column. Session: pencil hidden while approved, ⋮ Delete, Record and Review cards, header Record ▾ removed; keep the stale-`?action=update` effect. Remove `Saratoga.Actions` where it empties. Update the two help cards' wording.
  - **Done when:** both pages show the map's actions as an admin and as a member without the permissions (nothing disabled visible); ⌥E and `Mod+.` work on both; `npm run check` passes.

### Group B — admin pages (visual checkpoint)

- [ ] **Task 3 — org-admin user, team, team membership; team-admin team; D4H link card** `visual`
  - **Files:** `src/modules/org-admin/components/users/{user-menu,user-content,update-user}.tsx`, `src/modules/org-admin/components/teams/{team-menu,team-content,team-membership-menu,team-membership-content}.tsx`, `src/modules/team-admin/components/{team-menu,team-admin-content}.tsx`, `src/components/teams/{d4h-link-card,team-details-card,update-team}.tsx`, `content/help/admin/teams.mdx`, `content/help/admin/users.mdx`.
  - **Do:** Per the map. `Teams_D4HMenuGroup` splits: Sync stays the Linked D4H Team card's icon, Unlink goes to that card's ⋮, Link becomes a bare action card in the secondary column (both team pages). Make owner gets the `member: ["owner"]` gate. Team membership: D4H Member card moves to the secondary column; full width when there's none.
  - **Done when:** map rows hold as owner, admin and member; `npm run check` passes.

- [ ] **Task 4 — org-admin organisation, D4H access tokens (org + user)** `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/organization/page.tsx`, `src/modules/org-admin/components/organization/{organization-menu,d4h-org-card}.tsx`, `src/modules/org-admin/components/d4h-access-tokens/{d4h-access-token-menu,access-token-content}.tsx`, `src/modules/user-settings/components/{d4h-access-token-menu,d4h-access-token-content}.tsx`.
  - **Do:** Per the map. Organisation: the D4H Sync/Unlink group moves onto the D4H org card (sync icon, ⋮ Unlink); the disabled Delete goes. Tokens: the header refresh button becomes a card icon beside the pencil; History leaves the menu. All three go full width.
  - **Done when:** map rows hold; `npm run check` passes.

- [ ] **Task 5 — user-settings organisation, system-admin group and user** `visual`
  - **Files:** `src/modules/user-settings/components/{organization-menu,organization-content}.tsx`, `src/modules/system-admin/components/groups/{group-menu,group-content,edit-group-dialog}.tsx`, `src/modules/system-admin/components/users/{user-actions-menu,user-content}.tsx`, `src/modules/system-admin/components/users/user-actions-menu.test.tsx`.
  - **Do:** Per the map. User-settings organisation and system group go full width. System user: Impersonate becomes a bare action card; self sees no ⋮ and no card.
  - **Done when:** map rows hold; the system-admin menu test is updated for hidden-not-disabled and `primary`; `npm run check` passes.

### Group C — module pages (visual checkpoint)

- [ ] **Task 6 — skill-track package and group; skill-package-builder package, group, skill** `visual`
  - **Files:** `src/modules/skill-track/components/{package-content,group-content}.tsx`, `src/modules/skill-package-builder/components/{package-menu,package-content,group-menu,group-content,skill-menu,skill-content,update-package,update-group,update-skill}.tsx`, `content/help/skill-track/packages.mdx`, `content/help/skill-package-builder.mdx`.
  - **Do:** Per the map. Builder package: Publish/Unpublish leave the ⋮ for a titled Publishing card (one line on whether it's published and what that means for subscribers).
  - **Done when:** map rows hold; `npm run check` passes.

- [ ] **Task 7 — D4H equipment item + I3 Return, I3 bundle and template, d4h-nag rule** `visual`
  - **Files:** `src/modules/d4h/components/items/{equipment-item-menu,equipment-item-content,update-equipment-item}.tsx`, `src/modules/d4h-i3/components/equipment-item/{item-return-action,return-equipment-item}.tsx`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h/teams/[d4h_team_id]/_components/equipment-item-page.tsx`, `src/modules/d4h-i3/components/bundles/{bundle-menu,bundle-content,update-bundle}.tsx`, `src/modules/d4h-i3/components/templates/{template-menu,template-content,update-template}.tsx`, `src/modules/d4h-nag/components/{rule-content,update-rule-dialog}.tsx`, `content/help/d4h.mdx`, `content/help/d4h-i3.mdx`, `content/help/d4h-i3/return.mdx`.
  - **Do:** Per the map. The equipment item's `extraActions` slot becomes a secondary-column slot: the I3 module renders its own titled action card and mounts the Return dialog itself (the item has no ⋮ to host it); the cross-module wiring stays in `equipment-item-page.tsx`. Return's focus return moves off `useEntityActionMenuTrigger` to `useReturnFocus` with a `fallbackRef`. Template menu moves to `RecordCardMenu`. Nag rule: Run card with a confirm dialog for Run now, hidden while paused.
  - **Done when:** map rows hold; Return works through the slot for an I3 user with a D4H token; `npm run check` passes.

- [ ] **Task 8 — Notes (org and user)** `visual`
  - **Files:** `src/modules/notes/components/org-note-content.tsx`, `src/modules/user-notes/components/user-note-content.tsx`, `src/components/notes/note-card.tsx` (and `NoteDetail`), `content/help/notes.mdx`.
  - **Do:** The note header keeps the pencil (`RecordCardEditButton primary`) and a ⋮ with Delete (`primary`). `NoteCard` gets a `historyHref` prop that only `NoteDetail` (view mode) passes, making the "updated" timestamp the History link (`/orgs/[slug]/notes/[note_id]/history`, `/user/notes/[note_id]/history`).
  - **Done when:** ⌥E, `Mod+.`, ⌥⌫ work on a note; History reachable from the timestamp; the editor's timestamp isn't a link; `npm run check` passes.

### Closing

- [ ] **Task 9 — remove `EntityActionMenu` and sweep** `mechanical`
  - **Files:** `src/components/ui/{menu-action,menu-action.test}.tsx`, `src/components/ui/README.md`, `src/lib/hotkeys.ts`, whatever the greps find.
  - **Do:** Delete `EntityActionMenu`, `useEntityActionMenuTrigger` and their tests (keep `MenuAction`/`useMenuActionHotkeys`, which `RecordCardMenu` uses). Then: `grep -rn "EntityActionMenu\|glyph-halo" src` has only intended hits; no `Saratoga.Actions` wraps an empty fragment; help cards don't mention a detail-page "Actions menu" (`grep -rniE "actions menu|⋮" content/help`).
  - **Done when:** greps clean, `npm run check -- --all` passes.

## Docs impact

Every detail page's actions move: guides that say "open the ⋮ / Actions menu" on a detail page (10 files under `content/docs/` match `actions menu|⋮`), and every detail-page screenshot, change. Run `/avut-docs 0.14` after this ships, as the milestone plan says.

## Out of scope

- Row menus in tables (`SystemAdmin_MemberActionsMenu`, group member menus, campaign `RequestMenu`): not detail-page record actions.
- The self-audit campaign page's header buttons (its own page-level flow).
- List pages' Create buttons.
- Mobile-specific layouts beyond checking 390px at each checkpoint.

## Parked
