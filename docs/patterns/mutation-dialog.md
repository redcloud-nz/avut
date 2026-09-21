# Pattern: mutation dialog

Shape for a dialog that creates, updates, deletes, or confirms a state change on
a record. Every mutation dialog in AVUT is driven by an **`action` search param**
(`?action=create`, `?action=update`, `?action=delete`, …) managed with
[nuqs](https://nuqs.dev), so it can be opened from any entry point (a button, a
menu item, a keyboard shortcut, a pasted link), survives a refresh, and updates
the URL through the History API without a server round-trip or a page remount.

This replaces two earlier approaches: the original "self-contained dialog owns
its own `<DialogTrigger>` + `useState`" components, and the `(list)` / `(detail)`
route-group + `--create` / `--update` / `--delete` page experiment (see [what was
tried and dropped](#what-was-tried-and-dropped)).

Examples on personnel: `AdminModule_CreatePerson_Dialog` (list),
`AdminModule_UpdatePerson_Dialog` (detail card action + menu),
`AdminModule_DeletePerson_Dialog` (detail menu).

## Setup

`NuqsAdapter` (from `nuqs/adapters/next/app`) wraps the app once in
`src/components/providers.tsx`, inside `QueryClientProvider`. Nothing else is
global — each dialog reads its own param.

## The `action` param

```tsx
import { parseAsStringLiteral, useQueryState } from "nuqs";

const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
const dialogOpen = action === "update";
```

- **One param name — `action` — shared across the whole app.** Each component
  parses only the literal(s) it owns (`["create"]`, `["update"]`, `["delete"]`,
  `["archive", "restore"]`, …); an unrecognised value parses to `null`, so
  `?action=delete` leaves the update dialog closed. Two dialogs cannot be
  addressable-open at the same time — that has never been needed.
- **`history` per transition:** push when opening, replace when closing.

  ```tsx
  function handleDialogOpenChange(open: boolean) {
    void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
  }
  ```

  Push-on-open makes the browser Back button close the dialog;
  replace-on-close means Back from the closed page doesn't reopen it (no ghost
  history entry).

- **Reset the form and the mutation when the dialog _opens_**, in an effect —
  not in `handleDialogOpenChange`. A Back-button close changes `action` without
  going through `onOpenChange` (Radix only calls it for interactions inside the
  dialog), so a reset that lives in the close branch is skipped on a Back-button
  close and the next open shows stale field values or a stale error/success
  banner. An open-triggered effect covers every close path:

  ```tsx
  useEffect(() => {
    if (dialogOpen) {
      form.reset(person); // create dialogs: form.reset() — back to blank defaults
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
  }, [dialogOpen]);
  ```

  Resetting from the current `person` prop (rather than a bare `form.reset()`)
  also picks up any change to the record since the dialog was last open —
  react-hook-form captures `defaultValues` once and does not track prop changes.

- A per-row / list-item dialog needs a second param to say _which_ row:
  `?action=delete&personId=…`. Add `const [personId] = useQueryState("personId",
parseAsString)` and resolve the record from the list query cache. Personnel
  deletes from the detail page, so it needs only `?action=delete` — the id is
  already in the route.

- `npx next typegen` is **not** needed — no routes are added.

## The dialog component

Controlled by the param, keeps the `…_Dialog` name (it renders a `Dialog` /
`AlertDialog`). It may keep its own `<DialogTrigger>` **or** be fully
prop-driven — see [triggers](#triggers).

### Structure: header, body, footer

`DialogContent` owns no padding of its own. Compose it from three regions, each
of which owns its own padding:

```tsx
<DialogContent>
  <DialogHeader>…title and description…</DialogHeader>
  <DialogBody>…fields…</DialogBody>
  <DialogFooter>…buttons…</DialogFooter>
</DialogContent>
```

- **`DialogBody` is the only part that scrolls.** The header and footer stay put
  at every size, so a tall form never pushes the buttons off a small screen. Keep
  the `<form>` inside the body and submit from the footer with the `form="…"`
  attribute, as above — the footer is never inside the `<form>`.
- **Below `sm` the dialog is full screen** (slides up, with a visible close
  button, since there's no overlay left to tap; the footer buttons share the
  row). From `sm` up it's the usual centred modal. `AlertDialog` is different: it
  stays a compact bottom sheet below `sm`, as tall as its content.
- **A header directly above a footer, with nothing between them** (a plain
  confirm) needs no `DialogBody` — the header supplies the space below it.
- **Dialogs that lay themselves out** (a `Command` picker with its own scrolling
  list, an image lightbox) can skip the three regions and pass `p-0` to
  `DialogContent`. They aren't full-screen-aware yet, so check them on a phone.
- If a region's content is conditional (a different footer per step, say), put a
  `DialogBody` in each branch rather than wrapping the whole conditional.

### Loading data inside a dialog

A dialog that fetches its own data (a list to pick from, the current state of
something) wraps the part that waits in **`DialogBoundary`**, between the header and
the body/footer. The query lives in a child component rendered inside
`DialogContent`, not in the host:

```tsx
export function SkillPackageBuilder_MoveSkill_Dialog({ skill, ...props }: Props) {
  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>…title and description from props…</DialogHeader>
        <DialogBoundary>
          <MoveSkill_Body skill={skill} />
        </DialogBoundary>
      </DialogContent>
    </Dialog>
  );
}

function MoveSkill_Body({ skill }: { skill: Skill }) {
  const { data: packages } = useSuspenseQuery(…);
  const form = useForm(…);
  const mutation = useMutation(…);

  return (
    <>
      <DialogBody>…</DialogBody>
      <DialogFooter>…</DialogFooter>
    </>
  );
}
```

- **Loading and errors are the boundary's job.** While the child suspends it shows
  a spinner where the body will be and no footer; if the child throws it shows the
  message with a Close button. The header, the close button and Escape are
  unaffected in both.
- **Use `useSuspenseQuery` in the child**, not `useQuery` with an `isPending`
  branch — that is what keeps the child free of loading ternaries, and lets its body
  and footer sit together.
- **Form and other local state live in the child.** Radix only mounts
  `DialogContent`'s children while the dialog is open, so the child starts fresh on
  every open: no `useEffect(() => { form.reset(); mutation.reset(); }, [open])`. The
  host passes down what the child needs to close the dialog (`onDone`).
- **A header that depends on the fetched data** (`invite-person`, whose title
  depends on whether the email already belongs to a member) goes inside the child
  instead. Give the boundary a neutral `fallbackHeader` so the loading and error
  states still have a title (`DialogTitle` is required for accessibility). Most
  headers are built from props and belong above the boundary; check first.
- **Always-mounted dialogs** (one rendered in a report header, say) pay for their
  query on every page load if it runs in the host. Putting it in the child makes it
  lazy, because the child is only mounted while open — see the scope pickers in
  `skill-track/reports/`.
- **Prefetch a dialog's list only when the dialog will be open on the first render.**
  In a `page.tsx`, that means the dialog opens on arrival (nothing picked yet, so it
  is forced open) or `searchParams.action` names it. Otherwise the list isn't needed
  until the user opens it, and the client fetches it then behind the spinner.

### Create / update (non-destructive) — `Dialog` + form

```tsx
export function AdminModule_UpdatePerson_Dialog({ person }: { person: PersonData }) {
  const organization = useOrganization();

  const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
  const dialogOpen = action === "update";

  const form = useForm({
    resolver: zodResolver(PersonData.modifiableSchema),
    defaultValues: person,
  });

  const mutation = useMutation(
    trpc.personnel.updatePerson.mutationOptions({
      meta: { effects: personnelEffects.updatePerson },
      onError(error) {
        console.error("Failed to update person", error);
        toast.error(`Failed to update person: ${error.message}`);
      },
      onSuccess() {
        toast.success("Person updated");
        handleDialogOpenChange(false);
      },
    }),
  );

  function handleDialogOpenChange(open: boolean) {
    void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
  }

  useEffect(() => {
    if (dialogOpen) {
      form.reset(person);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
  }, [dialogOpen]);

  const handleSubmit = form.handleSubmit(
    (formData) =>
      mutation.mutate({
        organizationId: organization.id,
        personId: person.id,
        update: formData,
      }),
    (errors) => console.error("Form validation errors:", errors),
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <ObjectIcons.Edit />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update person</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form id="update-person-form" onSubmit={handleSubmit}>
            {/* fields */}
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
          <MutationButton type="submit" form="update-person-form" status={mutation.status} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- **`form.handleSubmit(onValid, onInvalid)`** — always pass the second argument.
  A submit that silently does nothing because a field is invalid is hard to
  diagnose from a bug report; logging `onInvalid` surfaces it in the console.
- **On success**, close by clearing the param via `handleDialogOpenChange(false)`
  — _unless_ success also navigates (create), in which case see the next rule.
- Cancel is the visually primary (first) button — the safe default to reach for.

### Delete / remove (destructive) — `AlertDialog`, no form

```tsx
export function AdminModule_DeletePerson_Dialog({
  person,
  ...props
}: ComponentProps<typeof AlertDialog> & { person: PersonData }) {
  const organization = useOrganization();
  const router = useRouter();

  const mutation = useMutation(
    trpc.personnel.deletePerson.mutationOptions({
      meta: { effects: personnelEffects.deletePerson },
      onError(error) {
        console.error("Failed to delete person:", error);
        toast.error(`Failed to delete person: ${error.message}`);
      },
      onSuccess() {
        toast.success(
          <>
            Person <ObjectName>{person.name}</ObjectName> deleted.
          </>,
        );
        // Navigate away. Don't also clear the action param or reset the mutation
        // here — see the rule below.
        router.push(route("/orgs/[slug]/admin/personnel", { slug: organization.slug }));
      },
    }),
  );

  return (
    <AlertDialog {...props}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Person</AlertDialogTitle>
          <AlertDialogDescription>
            Confirm deletion of <ObjectName>{person.name}</ObjectName>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <MutationButton
            type="button"
            variant="destructive"
            status={mutation.status}
            text={{ idle: "Delete", pending: "Deleting", success: "Deleted" }}
            onClick={() =>
              mutation.mutate({ organizationId: organization.id, personId: person.id })
            }
          />
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- **`AlertDialog`, not `Dialog`.** No dismiss on outside-click or Escape without
  an explicit choice — the point for something irreversible. **Only `delete` /
  `remove` uses `AlertDialog`.** State-transition confirms (archive, restore,
  publish, unsubscribe) use a plain `Dialog`.
- **Button order is reversed:** destructive action first, `AlertDialogCancel`
  second. Putting Cancel last would make it look like the primary action and
  undersell the risk.
- **No form** — a plain `onClick={() => mutation.mutate(...)}` on the
  `MutationButton`, no `handleSubmit`, no validation.

### Never pair a closing param-write with a navigation in `onSuccess`

If `onSuccess` calls `router.push(...)`, that is the _whole_ close. Do **not**
also call `handleDialogOpenChange(false)` / `setAction(null)` / `mutation.reset()`
in the same handler:

- the `router.push` unmounts the dialog anyway;
- the param clear (`setAction(null)`, a History `replace`) **races** the
  `router.push` — in the pilot this left the page stranded on a now-deleted
  detail route until a manual reload (which then 404'd).

So: **create** → `onSuccess` does only `router.push` to the new record's detail
page. **update** → `onSuccess` does only `handleDialogOpenChange(false)` (no
navigation, stays on the page). **delete** → `onSuccess` does only `router.push`
to the list.

### A mutation that navigates sets `navigates: true`

```tsx
trpc.teams.createTeam.mutationOptions({
  meta: { effects: teamsEffects.createTeam, navigates: true },
  onSuccess({ created }) {
    router.push(route("/orgs/[slug]/admin/teams/[team_id]", { slug, team_id: created.id }));
  },
});
```

`meta.effects` run — and are **awaited** — before the call site's own `onSuccess`, and an
`invalidate()` effect awaits a real refetch of every matching query that is still mounted. For a
create that redirects, the mounted query is the list on the page being left, so the redirect and
the button's spinner sit through a round trip nobody will see. After a delete it is worse: the
detail page's own query is still mounted, so the invalidation refetches the record that no longer
exists.

`navigates: true` makes the effector mark those queries stale (`refetchType: "none"`) without
fetching anything. They refetch the next time they are used — when the list mounts after the
redirect, or on Back — so nothing goes stale-but-unrefreshed for long. The trade-off is that a
query that stays mounted _across_ the navigation (a layout or sidebar query) is not refetched
until its next trigger, so don't set the flag when an effect has to refresh something the
destination page shows straight away.

Keep the cache side-effects in `meta.effects` rather than a hand-rolled
`await queryClient.invalidateQueries(...)` before `router.push`: the hand-rolled version blocks
the redirect in exactly the same way and has no flag to turn it off.

## Wave-2 dialog kinds

Beyond plain create / update / delete on a record that owns a route, four
recurring shapes have fixed rules:

- **Nested entity (no page of its own).** A child row — a template variant, a
  team member — gets a distinct `action` value **plus a second param naming the
  row** (`&variantId=…`, `&memberId=…`). The dialog component keeps its
  `{...props}`-driven signature (Recipe B — no `useQueryState` inside it); the
  **hosting** component owns both params and resolves the record from the
  parent's list query, then renders the dialog only once that record resolves.
  Close is a same-page clear of **both** params with `{ history: "replace" }` —
  no navigation.

  Worked example — `template-variants.tsx` hosting the update/delete variant
  dialogs (`?action=update-variant&variantId=…`):

  ```tsx
  import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

  const [action, setAction] = useQueryState(
    "action",
    parseAsStringLiteral(["update-variant", "delete-variant"] as const),
  );
  const [variantId, setVariantId] = useQueryState("variantId", parseAsString);
  const activeVariant = variants.find((v) => v.id === variantId) ?? null;

  function openVariantAction(next: "update-variant" | "delete-variant", id: string) {
    void setVariantId(id, { history: "push" });
    void setAction(next, { history: "push" });
  }
  function closeVariantAction() {
    void setAction(null, { history: "replace" });
    void setVariantId(null, { history: "replace" });
  }

  return (
    <Card>
      {/* row buttons: onClick={() => openVariantAction("update-variant", variant.id)} */}
      {activeVariant && (
        <I3Module_UpdateVariant_Dialog
          template={template}
          variant={activeVariant}
          open={action === "update-variant"}
          onOpenChange={(open) => (open ? undefined : closeVariantAction())}
        />
      )}
    </Card>
  );
  ```

  `setVariantId` + `setAction` are two writes; nuqs batches synchronous writes
  into one History update. `variants` comes from a `useSuspenseQuery` (already
  awaited), so on a cold direct-load of `?action=update-variant&variantId=xyz`
  `activeVariant` resolves on first render. A bogus `variantId` resolves to
  `null` → the host renders nothing, no crash.

  Key the dialog's reset effect on the **row id** as well as `open`
  (`}, [props.open, variant.id]);`) — a back/forward jump between two rows can
  swap the `variant` prop while the dialog stays mounted, and an `open`-only dep
  would carry the previous row's form / mutation state into the new one.

- **Relationship / join dialog** (link-person, add-team-member,
  subscribe/unsubscribe). The `action` value names the relationship.
  Single-instance (one per page) → no second param. Two sub-shapes:
  - **Self-triggered** (add-team-member): the dialog keeps its own
    `<DialogTrigger>` and owns its `useQueryState` (Recipe A). Only safe when the
    dialog **stays mounted through its mutation's success**.
  - **Host-driven** (link-person, subscribe/unsubscribe): the hosting
    detail/list component owns the `action` param and passes `open` /
    `onOpenChange` down (Recipe C); the dialog is `{...props}`-driven; the
    trigger button lives in the host.

  **A dialog may own its own `action` param only if it outlives its mutation's
  `onSuccess`.** If a dialog's own success effect flips a condition that unmounts
  it — e.g. a `write()` effect toggling `subscription`, so the host swaps which
  of subscribe/unsubscribe it renders — the close `setAction(null)` would fire
  from an unmounted hook. Make it host-driven instead (the host stays mounted).
  Same-page close either way — `onSuccess` does only the param clear, never a
  navigation.

- **State-transition confirm** (archive, restore, publish, unpublish, subscribe,
  unsubscribe). Use a plain **`Dialog`, never `AlertDialog`** — `AlertDialog` is
  reserved strictly for delete/remove. No `react-hook-form` when there is no
  field input: descriptive body text, an `<ObjectName>` naming the target, and a
  `MutationButton` whose `onClick` fires the mutation. `onSuccess` stays on the
  page. One dialog component per action (`archive-package.tsx`,
  `publish-package.tsx`, …), each parsing its single verb. The verbs are
  **entity-agnostic** — don't render two menus that parse the same verb set on
  one page (a skill menu inside a group page would make `?action=archive` open
  two dialogs).

- **Bulk-order dialog** (reorder / bulk-assign). A plain `Dialog` with a bespoke
  body (sortable list, target select); add a `form` only if there is genuine
  field input.

## Triggers

A trigger is anything that sets the param. Because the dialog is param-driven,
**one dialog can have several triggers** with no coordination — a card-action
button and a menu item can both open the same update dialog.

- **Prefer a real `<button>` that stays mounted** (`<DialogTrigger>` inside the
  dialog component, or a sibling `<Button onClick={() => setAction("update", {
history: "push" })}>`). On close, Radix restores focus to it automatically.
- **A `<Link href="?action=…">` also works** and is fine for a header "New X"
  action, but the link is a navigation trigger, not a focus anchor.
- Wrap every permission-gated trigger in `<Protect>` (or its `render` prop for
  the disabled-item case). This only hides/disables the entry point — the tRPC
  procedure is the real guard.

### Menu-triggered dialogs and focus

When the trigger is a `DropdownMenuItem`, the menu item unmounts before the
dialog opens, so Radix has no element to restore focus to on close and it would
jump to `<body>` mid-interaction. Call `preventDefault()` on the dialog's
`onCloseAutoFocus` to stop that jump:

```tsx
<AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
```

## General points

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
- **Host `?action=` dialogs from a Server-Component `page.tsx`** (or a client component
  that reads route params with `useParams()`), never a client page that reads them with
  `use(props.params)`. The URL change hands that page a fresh `params` promise, and
  `use()` on it suspends the whole page: it flashes `PageLoadingSpinner` every time a
  dialog opens or closes. Server pages are unaffected — see
  [detail-page-data-fetching.md](detail-page-data-fetching.md).
- The pages themselves (`page.tsx`, `layout.tsx`, list/detail content components,
  sibling subpages, `generateMetadata`) are **not touched** by adding a dialog —
  no route groups, no bare `page.tsx`, no metadata moves.

## What was tried and dropped

- **Self-contained `useState` dialog** — the original shape. No URL, doesn't
  survive a refresh, a `<DialogTrigger>` inside a `<DropdownMenuItem>` tears down
  as the menu closes.
- **`(list)` / `(detail)` route groups + `--create` / `--update` / `--delete`
  pages** (shipped for `admin/teams` in PR #58, then reverted). Real routes, and
  the underlying page stayed mounted under a shared layout — but: the trigger
  `<Link>` unmounts on navigation so focus drops to `<body>` on close; `push`-on-
  close leaves a re-openable ghost history entry; the `(detail)` layout's
  `generateMetadata` re-runs a `fetchQuery` on every soft-nav open/close; a
  list-triggered delete routes _through_ a full detail-page render; and each area
  cost ~4 scaffolding files + a thin page per dialog + `npx next typegen`, plus a
  client-page-to-`-content`-component extraction for any area whose detail page
  was a client component. The nuqs param gets the same five goals
  (own URL, survives refresh, page stays mounted, link-triggerable, one
  consistent shape) for a fraction of the surface area and without the focus /
  Back / round-trip regressions.
- **Intercepting routes + `@modal` parallel slot** — an earlier spike; duplicated
  the list render across intercepted and direct-load paths, or cost three
  scaffolding files per object.
