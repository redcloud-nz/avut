# Pattern: `Protect` permission gating

`<Protect>` (`src/components/protect.tsx`) conditionally renders UI based on the current
user's permissions in the current org — see AGENTS.md's Permissions section for its
signature (`children`/`fallback` vs `render`). This doc covers two things that are easy
to get subtly wrong: matching `Protect` to the mutation it's actually gating, and how to
gate an item inside a `DropdownMenu`.

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
3. Compare. `Protect` gating with *fewer/looser* permissions than the procedure requires
   is the dangerous direction — it lets someone see and click a control the server will
   reject. `Protect` gating *stricter* than needed just over-hides a control from someone
   who could actually use it — lower severity, but still worth fixing.

**Watch for one `<Protect>` wrapping several actions that call different mutations** — a
dropdown menu is the common shape (e.g. one `<Protect permissions={{ person: ["update"] }}>`
around an Archive item, a Delete item, and a Restore item). A single permission check only
covers the loosest of the wrapped mutations' requirements; if any wrapped action's
procedure requires something the group-level `permissions` doesn't grant (e.g. the Delete
item's mutation is actually gated on `person: ["delete"]`, distinct from `["update"]`),
that action is under-protected even though the others are fine. The fix is the per-item
`render` shape below, not loosening the group check to the union of everything inside it
(which would just make the *other* items over-permissive instead).

---

## Dropdown/menu items: always `render`, per item

Hiding a menu item outright (`children`/`fallback` — whether wrapping the whole item list
or one item) makes the set of available actions look arbitrarily different from person to
person with no explanation. Showing it disabled tells the user the action exists and (via
a tooltip, if warranted) why they can't use it right now. It also sidesteps the
multi-mutation problem above: gating each `DropdownMenuItem` independently means each
item's `render` call checks exactly the permission its own mutation needs.

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

A `DropdownMenuItem` (or a whole `DropdownMenuGroup`) wrapped in `children`/`fallback` —
including the common "wrap the item list, show an empty-state fallback" shape — should be
converted to the per-item `render` form above, not just have its permissions corrected in
place.
