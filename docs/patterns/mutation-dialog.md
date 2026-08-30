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
        <form id="update-person-form" onSubmit={handleSubmit}>
          {/* fields */}
        </form>
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

  // row buttons: onClick={() => openVariantAction("update-variant", variant.id)}

  {
    activeVariant && (
      <I3Module_UpdateVariant_Dialog
        template={template}
        variant={activeVariant}
        open={action === "update-variant"}
        onOpenChange={(open) => (open ? undefined : closeVariantAction())}
      />
    );
  }
  ```

  `setVariantId` + `setAction` are two writes; nuqs batches synchronous writes
  into one History update. `variants` comes from a `useSuspenseQuery` (already
  awaited), so on a cold direct-load of `?action=update-variant&variantId=xyz`
  `activeVariant` resolves on first render. A bogus `variantId` resolves to
  `null` → the host renders nothing, no crash.

- **Relationship / join dialog** (link-person, add-team-member, subscribe). Hosted
  by whichever detail/list component the action is triggered from; the `action`
  value names the relationship (`link-person`, `subscribe`). Single-instance
  (one per page) so it needs no second param. Same-page close — `onSuccess` does
  only `handleDialogOpenChange(false)`, never a navigation.

- **State-transition confirm** (archive, restore, publish, unpublish, subscribe,
  unsubscribe). Use a plain **`Dialog`, never `AlertDialog`** — `AlertDialog` is
  reserved strictly for delete/remove. No `react-hook-form` when there is no
  field input: just descriptive body text and a `MutationButton` whose `onClick`
  fires the mutation. `onSuccess` stays on the page.

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
