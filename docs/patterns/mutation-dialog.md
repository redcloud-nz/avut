# Pattern: mutation dialog

Shape for a dialog that creates, updates, or deletes a record. Every mutation
dialog in AVUT gets **its own URL** — a `--create` / `--update` / `--delete`
route nested under the list or detail page it acts on — so it can be opened from
any entry point (a button, a menu item, a keyboard shortcut, a pasted link) and
survives a refresh. This replaces the older "self-contained dialog owns its own
trigger + `useState`" approach.

Examples on teams: `AdminModule_CreateTeam_DialogContent` (list `--create`),
`AdminModule_UpdateTeam_DialogContent` and `AdminModule_DeleteTeam_Dialog`
(detail `--update` / `--delete`).

## Route layout: route group + layout, no interception

```
admin/teams/
  (list)/
    layout.tsx           -- renders the list, then {children}
    page.tsx             -- empty (return null), matches bare /teams
    --create/page.tsx    -- create dialog, renders as children
  [team_id]/
    (detail)/
      layout.tsx         -- renders the detail page, then {children}
      page.tsx           -- empty (return null), matches bare /teams/[team_id]
      --update/page.tsx  -- edit dialog, renders as children
      --delete/page.tsx  -- delete dialog, renders as children
    personnel/page.tsx   -- untouched, sibling outside (detail)
```

- `(list)` / `(detail)` are **plain route groups** — no path segment. They scope
  the layout to the bare page and its dialogs while excluding sibling subpages
  (`[team_id]` at the list level, `personnel` at the detail level), which must
  not sit under the list/detail layout.
- The layout renders the list/detail content **and then `{props.children}`**. A
  shared ancestor layout stays mounted across a client-side navigation between
  routes it's an ancestor of, so nesting both the bare page and the dialog pages
  under one group's layout gives "list/detail stays mounted underneath, dialog
  appears on top" for free — on a soft navigation **and** a direct load/refresh,
  through ordinary layout + page composition. No intercepting routes, no
  `@modal` parallel slots.
- The bare `page.tsx` is intentionally empty (`return null`) — it exists only to
  match the bare path within the group. Put `export const metadata` (or
  `generateMetadata`) on the **layout**, not the empty page, so a dynamic title
  (e.g. the team name) applies across the bare page and every dialog and is
  fetched once. See `(detail)/layout.tsx`'s `generateMetadata`.
- The old `[team_id]/page.tsx` becomes `[team_id]/(detail)/layout.tsx`; its
  default export is renamed to `…Layout` and its props type gains
  `children: ReactNode`.

### What was tried and dropped

Two earlier spike commits explored parallel routes before landing here:

- **Intercepting route + `@modal` parallel slot** — worked, but duplicated the
  list render across an intercepted page and a non-intercepted direct-load
  fallback.
- **Named `@modal` slot without interception** — simpler, but cost three
  near-empty scaffolding files (a base `page.tsx` plus a `default.tsx` per slot)
  per object to support a single dialog. Worth revisiting only once an object
  has enough dialogs that an explicit `@modal/` folder earns back that fixed
  cost.

## The dialog page

Thin client component. Holds the dialog `open` and navigates back to the parent
route to close it.

```tsx
// [team_id]/(detail)/--update/page.tsx
"use client";

export default function AdminModule_UpdateTeam_Page(
  props: PageProps<"/orgs/[slug]/admin/teams/[team_id]/--update">,
) {
  const { team_id } = use(props.params);
  const teamId = TeamId.schema.parse(team_id);

  const organization = useOrganization();
  const router = useRouter();

  // Server Component already prefetched this via the layout's HydrateClient —
  // useSuspenseQuery reads the hydrated cache, no waterfall.
  const { data: team } = useSuspenseQuery(
    trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
  );

  return (
    <AdminModule_UpdateTeam_DialogContent
      team={team}
      open
      onOpenChange={(open) => {
        if (!open) {
          router.push(
            route("/orgs/[slug]/admin/teams/[team_id]", {
              slug: organization.slug,
              team_id: teamId,
            }),
          );
        }
      }}
    />
  );
}
```

- `open` is hard-coded `true` — the route existing _is_ the open state.
- `onOpenChange` handles only the close case, with `router.push` back to the
  parent path. (Use `push`, not `back` — the dialog may have been reached by
  direct load, where there's no history entry to go back to.)
- A `--create` page needs no data fetch; `--update` / `--delete` read the record
  with `useSuspenseQuery` against the cache the parent layout already hydrated.

## The dialog content component

Controlled — takes `open` / `onOpenChange`, owns **no** `DialogTrigger` and no
`useState`. Name it `…_DialogContent` when converting from a former
self-contained `…_Dialog` (the delete dialog was already controlled via
`ComponentProps<typeof AlertDialog>`, so it keeps its name).

### Create / update (non-destructive) — `Dialog` + form

```tsx
export function AdminModule_CreateTeam_DialogContent({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const organization = useOrganization();
  const router = useRouter();

  const form = useForm({ resolver: zodResolver(TeamData.modifiableSchema) });

  const mutation = useMutation(
    trpc.teams.createTeam.mutationOptions({
      meta: { effects: teamsEffects.createTeam },
      onError(error) {
        console.error("Failed to create team:", error);
        toast.error(`Failed to create team: ${error.message}`);
      },
      onSuccess({ created }) {
        toast.success("Team created");
        router.push(
          route("/orgs/[slug]/admin/teams/[team_id]", {
            slug: organization.slug,
            team_id: created.id,
          }),
        );
      },
    }),
  );

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset();
      mutation.reset();
    }
    onOpenChange(nextOpen);
  }

  const handleSubmit = form.handleSubmit(
    (formData) => mutation.mutate({ organizationId: organization.id, ...formData }),
    (errors) => console.error("Form validation errors:", errors),
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Team</DialogTitle>
        </DialogHeader>
        <form id="create-team-form" onSubmit={handleSubmit}>
          {/* fields */}
        </form>
        <DialogFooter>
          <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
          <MutationButton type="submit" form="create-team-form" status={mutation.status} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- **`handleDialogOpenChange`** resets both the form and the mutation on close, so
  reopening (or re-navigating to) the route doesn't show stale field values or a
  stale error/success banner.
- **`form.handleSubmit(onValid, onInvalid)`** — always pass the second argument.
  A submit that silently does nothing because a field is invalid is hard to
  diagnose from a bug report; logging `onInvalid` surfaces it in the console.
- **On success**, close by navigating: `--update` pushes back to the detail
  page; `--create` pushes straight to the new record's detail page (not the
  list). Don't also call `onOpenChange(false)` — the `router.push` away from the
  dialog route unmounts it.
- Cancel is the visually primary (first) button — the safe default to reach for.

### Delete / remove (destructive) — `AlertDialog`, no form

```tsx
export function AdminModule_DeleteTeam_Dialog({
  team,
  ...props
}: ComponentProps<typeof AlertDialog> & { team: TeamData }) {
  const organization = useOrganization();
  const router = useRouter();

  const mutation = useMutation(
    trpc.teams.deleteTeam.mutationOptions({
      meta: { effects: teamsEffects.deleteTeam },
      onError(error) {
        console.error("Failed to delete team:", error);
        toast.error(`Failed to delete team: ${error.message}`);
      },
      onSuccess() {
        toast.success(
          <>
            Team <ObjectName>{team.name}</ObjectName> deleted.
          </>,
        );
        router.push(route("/orgs/[slug]/admin/teams", { slug: organization.slug }));
      },
    }),
  );

  return (
    <AlertDialog {...props}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Team</AlertDialogTitle>
          <AlertDialogDescription>
            Confirm deletion of <ObjectName>{team.name}</ObjectName>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <MutationButton
            type="button"
            variant="destructive"
            status={mutation.status}
            text={{ idle: "Delete", pending: "Deleting", success: "Deleted" }}
            onClick={() => mutation.mutate({ teamId: team.id, organizationId: organization.id })}
          />
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- **`AlertDialog`, not `Dialog`.** No dismiss on outside-click or Escape without
  an explicit choice — the point for something irreversible.
- **Button order is reversed:** destructive action first, `AlertDialogCancel`
  second. The layout itself should read as "this is the dangerous one"; putting
  Cancel last would make it look like the primary action and undersell the risk.
- **No form** — a plain `onClick={() => mutation.mutate(...)}` on the
  `MutationButton`, no `handleSubmit`, no validation.
- **On success, redirect** — the deleted record's route (`--delete` under
  `[team_id]`) can't keep rendering, so `router.push` back to the list. Don't
  call `onOpenChange(false)` or `mutation.reset()` in `onSuccess`: the navigation
  unmounts the dialog anyway, and resetting mid-navigation just flips the button
  out of its "Deleted" state.

## Trigger sites

Triggers are `<Link>`s (usually `<Button asChild><Link href={route(...)}>` or
`<DropdownMenuItem asChild><Link>`), not buttons wired to local state:

```tsx
// list header
<Protect permissions={{ team: ["create"] }}>
  <Button variant="outline" asChild>
    <Link href={route("/orgs/[slug]/admin/teams/--create", { slug })}>
      <ObjectIcons.Create /> <span className="hidden md:inline">New Team</span>
    </Link>
  </Button>
</Protect>

// dropdown menu item
<Protect
  permissions={{ team: ["delete"] }}
  render={(allowed) => (
    <DropdownMenuItem asChild disabled={!allowed} className="text-destructive">
      <Link href={route("/orgs/[slug]/admin/teams/[team_id]/--delete", { slug, team_id: team.id })}>
        <ObjectIcons.Delete /> Delete
      </Link>
    </DropdownMenuItem>
  )}
/>
```

- Still wrap the trigger in `<Protect>` for permission-gated actions — this only
  hides the entry point; the tRPC procedure is the real guard.
- Because the dialog no longer owns a `DialogTrigger`, the old
  dropdown-menu caveat (a `DialogTrigger` inside a `DropdownMenuItem` tears down
  as the menu closes) disappears — a menu item is just a `<Link>` now.
- A component like `AdminModule_TeamMenu` that only rendered a dialog for its
  own `useState` loses the `useState`, the wrapping fragment, and the dialog
  import entirely.

## General points (both kinds)

- **No optimistic updates.** `meta: { effects: … }` (see
  `src/client/<domain>-effects.ts` and `src/trpc/mutation-effector.tsx`) is
  enough — the UI updates on refetch after the mutation settles, or instantly if
  the effect uses `write()` rather than `invalidate()`. Reach for
  `onMutate`/rollback only if that one-round-trip latency is a genuinely reported
  problem; it roughly triples the mutation's code.
- **Toasts stay at the call site**, not centralized — their copy is specific to
  the mutation.
- Always `ctx.logEvent(...)` in the tRPC procedure inside the `$transaction`, per
  [transactional-writes.md](transactional-writes.md).
- **After adding a `--create` / `--update` / `--delete` page, run
  `npx next typegen`** so `route()` calls for the new path typecheck.
