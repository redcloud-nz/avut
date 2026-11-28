# Pattern: detail-page actions

Where a detail page's actions go: on the record cards they act on, and in action cards at the
top of the secondary column. There is no page-level actions menu. The components are in
`src/components/ui/record-card-actions.tsx`: `RecordCardEditButton` (the pencil),
`RecordCardMenu` (the card's ⋮) and `ActionsCard`. Decided in #561 (plan
`docs/plans/2026-11-28-detail-page-actions.md`), which also fixes #555, the empty secondary
column.

## Where each action goes

- **`Saratoga.Actions` holds only page-level navigation** that isn't a record action: the D4H ↗
  link, a picker that switches the page. Record actions never go there. Leave `Saratoga.Actions`
  out when it would be empty.
- **Each `RecordCard` acts on its own record**, from its `action` slot (the header strip):
  - **Icons** for the quick ones: the edit pencil (`RecordCardEditButton`), ↗ to a related
    record, D4H sync, refresh.
  - **A ⋮ (`RecordCardMenu`) after the icons** for the record's non-primary actions: Archive,
    Restore, Recover, Delete, Unlink, Replace, Move, Export, owner and role changes.
- **History is never a menu item.** It's the card's "Updated" footer (`RecordCard`'s
  `historyHref`). Notes have no record card, so a note's "updated" timestamp is the link.
- **Primary actions that need words go in an `ActionsCard`** at the top of the secondary column:
  - **Titled, with a one-line description,** when the action needs explaining or the page has
    more than one job ("Record" and "Review" on a session, "Publishing" on a package).
  - **Bare (no `title`)** when the button labels say it all ("Invite to AVUT", "Link to existing
    user").
- **An action with a home elsewhere stays there.** Add to team is the Team Memberships card's
  Add, not a menu item. Its ⌥N goes with it: ⌥N stays a list page's Create key.
- **A single-item ⋮ stays a ⋮.** A lone Delete or Unlink as a bare icon would sit one click from
  the pencil with no label, and pages would differ by how many actions the viewer happens to
  hold.

## Hidden, not disabled

Leave out an action the viewer can't take, whether for want of a permission or because of the
record's state, rather than showing it disabled:

- Build `actions` from what the viewer can do now (`useHasPermission`, the record's status) and
  pass the rest nowhere. `RecordCardMenu` with no actions and `after={null}` renders nothing, so
  an empty ⋮ never shows. Pass `null` for `after`, not a component that renders null.
- In an `ActionsCard`, render `null` for a button the viewer can't use. With no buttons left the
  card renders nothing.
- `disabled` is only for a short-lived in-flight state: an export running, a sync pending.
- The one disabled control left is the D4H equipment item's pencil, whose tooltip gives the
  reason (no token, not editable in D4H). That reason is what the viewer needs to know.

The tRPC procedure is still the real check; hiding only removes the entry point.

## Button styles in an action card

`outline` for every button, except the one that moves the record to its next lifecycle state
(Reopen, Publish, Invite to AVUT, Subscribe), which is the default (filled). At most one filled
button per page.

## Keyboard

The page's **primary record card**, the one its `<h1>` names, owns the shortcuts. Pass `primary`
to its pencil and its ⋮:

- `RecordCardEditButton primary` registers ⌥E, which clicks the pencil (so it does whatever a
  click does: opens the dialog, follows the link).
- `RecordCardMenu primary` registers `Mod+.` (opens the menu with its first enabled item
  focused) and the ⌥ verb keys of its actions (⌥⌫ Delete, ⌥A Archive).

Other cards' pencils and menus register nothing (a second registration of the same key would
collide). On a page whose only ⋮ is on a non-primary card, `Mod+.` does nothing. Action-card
buttons get no hotkeys.

## Wiring the pencil to its dialog

The pencil stays the update dialog's own trigger. `RecordCardEditButton` spreads its props and
forwards its ref, so it can be `<DialogTrigger asChild>`'s child. The update dialog takes a
`primary` prop and passes it on:

```tsx
<DialogTrigger asChild>
  <RecordCardEditButton label="Edit person" category="Personnel" primary={primary} />
</DialogTrigger>
```

A record edited on its own route uses `asChild` around a `Link`; the pencil renders inside it:

```tsx
<RecordCardEditButton label="Edit organisation" primary asChild>
  <Link href={route("/orgs/[slug]/admin/organization/--update", { slug })} />
</RecordCardEditButton>
```

## Dialogs

The [mutation-dialog pattern](mutation-dialog.md) holds. Menu items and action-card buttons only
set `?action=`; each page's dialogs stay mounted once, in its `*-menu.tsx`, whether or not the
⋮ or the card shows. Card menus and action cards parse the same verb set and never mount dialogs
themselves.

A dialog opened from a button that disappears on success (Link, Subscribe, Publish, Reopen,
Return) has no trigger to return focus to: spread `useReturnFocus(fallbackRef)` onto its
content, with `fallbackRef` on a control that stays (the card's ⋮ via `RecordCardMenu`'s
`triggerRef`, or the pencil). Pick one that every viewer who can open the dialog is sure to
see: a ⋮ renders nothing for a viewer with no actions in it.

## The secondary column

A page whose secondary column would be empty drops `Saratoga.Columns` and renders its cards full
width (`Saratoga.Root`'s `max-w-5xl` still caps them). A page with an action card keeps the
columns.

## Pages that need care

- **No D4H token:** cards for D4H actions (Link to D4H, Compare) still show; the dialog reports
  the missing personal token when it opens.
- **An action that sends real email** (a nag rule's Run now) opens a confirm dialog from its
  action card. A dry run doesn't need one.
