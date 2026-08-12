# Pattern: non-destructive mutation dialog

Shape for a dialog that creates or updates a record — the counterpart to
[destructive-mutation-dialog.md](destructive-mutation-dialog.md). Examples:
`AdminModule_AddTeamMember_Dialog`, `AdminModule_UpdateTeam_Dialog`,
`AdminModule_CreatePerson_Dialog`.

```tsx
export function AdminModule_AddTeamMember_Dialog({ team }: { team: TeamData }) {
  const organization = useOrganization();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm({ resolver: zodResolver(schema) });

  const mutation = useMutation(
    trpc.teams.createTeamMembership.mutationOptions({
      meta: { invalidates: teamsInvalidations.createTeamMembership },
      onError(error) {
        console.error("Failed to add team member:", error);
        toast.error(`Failed to add team member: ${error.message}`);
      },
      onSuccess({ created }) {
        toast.success(/* ... */);
        handleOpenChange(false);
      },
    }),
  );

  function handleOpenChange(open: boolean) {
    if (!open) {
      form.reset();
      mutation.reset();
    }
    setDialogOpen(open);
  }

  const handleSubmit = form.handleSubmit(
    (formData) => mutation.mutate({ organizationId: organization.id, ...formData }),
    (errors) => console.error("Form validation errors:", errors),
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>...</Button>
      </DialogTrigger>
      <DialogContent>
        <form id="add-team-member-form" onSubmit={handleSubmit}>
          {/* fields */}
        </form>
        <DialogFooter>
          <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
          <MutationButton type="submit" form="add-team-member-form" status={mutation.status} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Key points:

- **Self-contained**: the component owns its `DialogTrigger` (the button that opens it)
  and its `dialogOpen` state. Callers just render `<AdminModule_X_Dialog record={record} />`
  wrapped in `<Protect>` if permission-gated — no open-state or trigger-button plumbing
  at the call site.
  - **Caveat**: this only works when the trigger is a primary, standalone button on the
    page (a card action, a page-header action). If the action instead lives inside a
    `DropdownMenu` (e.g. an "Edit" item in `AdminModule_TeamMenu`), the dialog can't own
    a `DialogTrigger` — closing the dropdown on select would tear down the trigger before
    the dialog opens. There, fall back to the controlled shape from
    [destructive-mutation-dialog.md](destructive-mutation-dialog.md): the dialog takes
    `open`/`onOpenChange`, and the menu's own `useState` plus its `DropdownMenuItem`'s
    `onSelect={() => setOpen(true)}` drive it instead.
- **No optimistic updates.** `meta: { invalidates: ... }` (see
  `src/client/<domain>-invalidations.ts` and `src/trpc/mutation-invalidator.tsx`) is
  enough — the UI updates on refetch after the mutation settles. Reach for
  `onMutate`/rollback only if that latency is a genuinely reported problem, not by
  default; it roughly triples the mutation's code for a UI difference of one round trip.
- **`form.handleSubmit(onValid, onInvalid)`** — always pass the second argument. Silent
  validation failures (a submit that does nothing because a field is invalid, with no
  visible error) are hard to debug from a bug report; logging `onInvalid` at least
  surfaces it in the console.
- **`handleOpenChange`** resets both the form and the mutation on close, so reopening
  the dialog doesn't show stale field values or a stale error/success state.
- Success/error toasts stay at the call site (not centralized), since their copy is
  specific to the mutation.
