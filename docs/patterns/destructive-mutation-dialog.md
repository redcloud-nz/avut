# Pattern: destructive mutation dialog

Shape for a dialog that deletes or removes a record — the counterpart to
[non-destructive-mutation-dialog.md](non-destructive-mutation-dialog.md). Examples:
`AdminModule_DeletePerson_Dialog`, `AdminModule_DeleteTeam_Dialog`,
`AdminModule_RemoveTeamMember_Dialog`.

```tsx
export function AdminModule_DeletePerson_Dialog({
  person,
  ...props
}: ComponentProps<typeof AlertDialog> & { person: PersonData }) {
  const mutation = useMutation(
    trpc.personnel.deletePerson.mutationOptions({
      meta: { invalidates: personnelInvalidations.deletePerson },
      onError(error) {
        console.error("Failed to delete person:", error);
        toast.error(`Failed to delete person: ${error.message}`);
      },
      onSuccess() {
        toast.success(/* ... */);
        props.onOpenChange?.(false);
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
            onClick={() => mutation.mutate({ personId: person.id })}
          />
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Key points:

- **`AlertDialog`, not `Dialog`.** Alert dialogs can't be dismissed by clicking outside
  or pressing Escape without an explicit action, which is the point for something
  irreversible.
- **Button order is reversed from the non-destructive dialog: destructive action
  first, `AlertDialogCancel` second.** The non-destructive pattern puts Cancel first
  because the primary action is the safe default to reach for. Here the layout itself
  should read as "this is the dangerous one" — putting Cancel last would make it the
  visually primary action, which undersells the risk.
- **Controlled, not self-contained.** Unlike the create/update pattern, these are
  triggered from somewhere that already has its own state to manage — a dropdown menu
  item (`AdminModule_TeamMenu`), a per-row delete button whose target varies
  (`team-personnel-content.tsx`'s `deleteTarget`). The dialog takes `open`/`onOpenChange`
  (or spreads `ComponentProps<typeof AlertDialog>`) rather than owning a trigger.
- **No form.** Confirmation dialogs rarely take input, so it's a plain `onClick={() =>
mutation.mutate(...)}` on the `MutationButton` — no `handleSubmit`, no validation.
- **`meta.invalidates`, same as the non-destructive pattern** — no optimistic removal.
- If deleting the record being viewed (not a list row), redirect away in `onSuccess`
  (see `AdminModule_DeletePerson_Dialog`'s `router.push` back to the list) since the
  page can't keep rendering a record that no longer exists.
