# Pattern: `Protect` permission gating

`<Protect>` (`src/components/protect.tsx`) conditionally renders UI based on the current
user's permissions in the current org — see AGENTS.md's Permissions section for its
signature (`children`/`fallback` vs `render`). This doc covers two things that are easy
to get subtly wrong: matching `Protect` to the mutation it's actually gating, and how to
gate the actions in a detail page's menus and action cards, or an item in another
`DropdownMenu`.

---

## `permissions` must match what the guarded mutation requires

A `<Protect>` around a button/menu item is only correct if its `permissions` prop is the
same resource/action set as the `organizationProcedure({...})` gate on the tRPC mutation
that element triggers. If the two disagree, the UI and the server disagree about who's
allowed to act — a user sees a control they can click that then fails server-side.

To check a given `<Protect>`:

1. Find what the wrapped element does when activated — trace its `onClick`/`onSubmit` to
   the `useMutation(trpc.<router>.<procedure>.mutationOptions(...))` call it invokes.
2. Look up that same `<procedure>` in `src/trpc/routers/<router>-router.ts` and read its
   `organizationProcedure({...})` argument.
3. Compare. `Protect` gating with _fewer/looser_ permissions than the procedure requires
   is the dangerous direction — it lets someone see and click a control the server will
   reject. `Protect` gating _stricter_ than needed just over-hides a control from someone
   who could actually use it — lower severity, but still worth fixing.

**Watch for one `<Protect>` wrapping several actions that call different mutations** — a
dropdown menu is the common shape (e.g. one `<Protect permissions={{ person: ["update"] }}>`
around an Archive item, a Delete item, and a Restore item). A single permission check only
covers the loosest of the wrapped mutations' requirements; if any wrapped action's
procedure requires something the group-level `permissions` doesn't grant (e.g. the Delete
item's mutation is actually gated on `person: ["delete"]`, distinct from `["update"]`),
that action is under-protected even though the others are fine. The fix is the per-item
`render` shape below, not loosening the group check to the union of everything inside it
(which would just make the _other_ items over-permissive instead).

---

## Detail-page menus and action cards: hide, per action

A detail page's record-card ⋮ (`RecordCardMenu`) and its action cards (`ActionsCard`) leave
out what the viewer can't do, whether for want of a permission or because of the record's
state ([`detail-page-actions.md`](detail-page-actions.md)). They don't show it disabled.
Each card shows only the actions it can take, so a viewer with none sees no ⋮ and no card,
rather than a menu of greyed-out items.

Gate **each action on its own permission**, the one its mutation's procedure requires,
with `useHasPermission`, and build the list from what passes. This keeps the
multi-mutation rule above: one check never covers two actions.

```tsx
const canArchive = useHasPermission({ person: ["update"] });
const canDelete = useHasPermission({ person: ["delete"] });

const actions: MenuActionProps[] = [];
if (canArchive && person.status === "Active") actions.push({ verb: "archive", … });
if (canDelete) actions.push({ verb: "delete", destructive: true, … });

<RecordCardMenu actions={actions} category="Personnel" primary />;
```

An action-card button is the same: `{canInvite ? <Button …>Invite to AVUT</Button> : null}`.
Don't wrap action-card buttons in `<Protect>`: `ActionsCard` can only see that a child is
`null`, so a card of `Protect`-wrapped buttons renders as an empty shell for a viewer who can
use none of them.

`disabled` stays only for a short-lived in-flight state (an export running, a sync
pending), not for permission or record state.

## Other dropdown menus: `render`, per item

Menus that aren't a detail page's record actions, such as row menus in a table, keep the
earlier rule for now: show the item disabled rather than hide it, with the per-item
`render` form, so each item checks exactly the permission its own mutation needs.

```tsx
<Protect
  permissions={{ person: ["delete"] }}
  render={(hasPermission) => (
    <DropdownMenuItem disabled={!hasPermission} onClick={handleDelete}>
      Delete
    </DropdownMenuItem>
  )}
/>
```

In such a menu, a `DropdownMenuItem` (or a whole `DropdownMenuGroup`) wrapped in
`children`/`fallback` — including the common "wrap the item list, show an empty-state
fallback" shape — should be converted to the per-item `render` form above, not just have
its permissions corrected in place.
