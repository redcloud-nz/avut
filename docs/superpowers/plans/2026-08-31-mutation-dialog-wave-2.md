# Mutation Dialog Migration — Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the remaining mutation dialogs — nested-entity dialogs (i3 template variants), relationship/join dialogs (team members, catalogue subscribe/unsubscribe, user link/unlink), and the not-yet-dialogs (skill-package-builder archive/restore/publish/unpublish, move-skill, reorder) — onto the `?action=` search-param pattern established in wave 1.

**Architecture:** Same nuqs `useQueryState("action", parseAsStringLiteral([...]))` pattern as wave 1. Two additions: (1) a **nested entity** with no page of its own also carries a second param (`&variantId=…`, `&memberId=…`) and the hosting component resolves the row from the parent's list-query cache; (2) **state-transition confirms** (archive/restore/publish/unpublish/subscribe/unsubscribe) become plain `Dialog` components — no `react-hook-form`, a `MutationButton` with an `onClick` — replacing the `toast.promise(mutateAsync(...))` calls that currently fire straight from menu items. No routes, layouts, `page.tsx`, or `generateMetadata` are touched. The mutation wiring stays as-is except phase 9, which moves two `onSuccess` `queryClient.setQueryData` calls into `write()` effects.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, nuqs 2, `@tanstack/react-query` 5, react-hook-form + zod 4, shadcn/ui (`Dialog` / `AlertDialog`).

**Spec:** [`docs/superpowers/specs/2026-08-30-mutation-dialog-migration-design.md`](../specs/2026-08-30-mutation-dialog-migration-design.md) — wave 2 is phases 7–12 of the "Phasing" section.
**Pattern doc:** [`docs/patterns/mutation-dialog.md`](../../patterns/mutation-dialog.md)
**Reference implementations (merged):** `admin/personnel` (`src/components/admin/personnel/`), and every wave-1 area — `admin/teams`, `skill-track/sessions`, `skill-package-builder` create/update/delete, `i3/templates`, `admin/users`, `admin/invitations`.

## Global Constraints

- **nuqs is installed** (`nuqs@^2`) and `NuqsAdapter` wraps the app in `src/components/providers.tsx`. Do not re-add either.
- **Param name is `action`.** Never `dialog`. One `useQueryState("action", parseAsStringLiteral([...] as const))` per dialog component (or per hosting component for prop-driven dialogs), parsing only the literal(s) that component owns.
- **`history` is mandatory on every `setAction` call:** `{ history: "push" }` when opening, `{ history: "replace" }` when closing/clearing.
- **`handleOpenChange` / `handleDialogOpenChange` is one line** — it only writes the param:
  ```tsx
  function handleDialogOpenChange(open: boolean) {
    void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
  }
  ```
- **Reset form + mutation in an open-triggered effect, NOT in the close branch.** A Back-button close changes `action` without firing `onOpenChange`, so a reset in the close handler is skipped. Use:
  ```tsx
  useEffect(() => {
    if (dialogOpen) {
      form.reset(record); // create/no-record dialogs: form.reset()
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
  }, [dialogOpen]);
  ```
  For a prop-driven dialog (no local `dialogOpen`), key the effect on `props.open`.
- **Never pair a param-clear with `router.push` / `router.replace` / `router.refresh` in the same `onSuccess`.** The `replace` races the navigation (wave-1 pilot stranded a page on a deleted route this way). Rules:
  - **create** → `onSuccess` does only `router.push` to the new record's detail page.
  - **update** → `onSuccess` does only `handleDialogOpenChange(false)` (stays on the page). If it must also `router.refresh()` (server-rendered detail page), `await setAction(null, { history: "replace" })` **first**, then `router.refresh()`.
  - **delete** → `onSuccess` does only `router.push` to the list.
  - **same-page state transition / join** (archive, subscribe, add-member, …) → `onSuccess` does only `handleDialogOpenChange(false)`; no navigation.
- **`form.handleSubmit(onValid, onInvalid)`** — always pass the second arg: `(errors) => console.error("Form validation errors:", errors)`.
- **Menu-triggered dialogs** (opened from a `DropdownMenuItem` or a table-row icon button that unmounts): add `onCloseAutoFocus={(e) => e.preventDefault()}` — and nothing else — to the `DialogContent` / `AlertDialogContent`. No `menuTriggerRef`, no `<DropdownMenu onOpenChange>`; wave 1 tried those and reverted them (`d8921662`).
- **`AlertDialog` is for `delete` / `remove` only.** Every reversible state-transition confirm (archive, restore, publish, unpublish, subscribe, unsubscribe) uses a plain `Dialog`.
- **No tRPC procedure changes.** No `src/client/*-effects.ts` changes **except phase 9** (move two `setQueryData` calls into `write()` effects on `skillsEffects.subscribeToPackage` / `unsubscribeFromPackage`).
- **Keep exported component names ending in `_Dialog`.** The new phase-11 confirm dialogs are one component per action, named `SkillPackageBuilder_<Verb><Entity>_Dialog` (e.g. `SkillPackageBuilder_ArchivePackage_Dialog`), in files named `<verb>-<entity>.tsx`.
- **Each phase is its own branch and PR**, branched from `master`, named `mutation-dialogs/<area>-<topic>` (e.g. `mutation-dialogs/i3-variants`). Phases are independent — no stacking; each branches fresh from `master`.
- **`npx next typegen` is NOT needed** in any wave-2 phase — no routes are added or removed. (If `npx tsc --noEmit` fails inside `.next/types/validator.ts` with a `.next/dev/types` mismatch, `rm -rf .next/dev/types && npx next typegen` — a stale-dev-server artifact, per AGENTS.md.)
- **Verification per phase, before opening the PR:**
  ```
  npx tsc --noEmit
  npm run test:run
  npm run lint
  ```
  then the browser click-through in that phase's "Manual verification" step.
- **Commit granularity:** one commit per dialog (or per tightly-coupled dialog + host pair), plus a final cleanup commit. Show the message and wait for yes/no before `git commit` (per AGENTS.md).

## The recipes

### Recipe A — convert an existing self-triggered dialog (own `<DialogTrigger>` + `useState`)

`add-variant`, `add-team-member`, `subscribe-package`.

1. Delete `const [dialogOpen, setDialogOpen] = useState(false)`.
2. Add `const [action, setAction] = useQueryState("action", parseAsStringLiteral(["<verb>"] as const))` and `const dialogOpen = action === "<verb>"`.
3. Collapse `handleOpenChange` / `handleDialogOpenChange` to the one-line param write (Global Constraints).
4. Add the open-triggered reset effect (Global Constraints).
5. `<Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>` — keep the existing `<DialogTrigger asChild><Button>…</Button></DialogTrigger>`.
6. Fix `onSuccess` per the navigation rules (these are all same-page → `handleDialogOpenChange(false)` only).
7. Ensure `form.handleSubmit` has the `onInvalid` arg.

### Recipe B — convert an existing prop-driven dialog (`DialogProps` / `AlertDialogProps` / `ComponentProps<typeof Dialog>`, controlled by a host's `useState`)

`update-variant`, `delete-variant`, `remove-team-member`, `unlink-person`, `link-person`.

1. **Signature unchanged** — it stays `{...props}`-driven onto `<Dialog>` / `<AlertDialog>`. Do **not** add `useQueryState` inside it.
2. Collapse its internal `handleOpenChange` to delegate straight to `props.onOpenChange` (drop the `form.reset()` / `mutation.reset()` from the close branch).
3. Add an open-triggered reset effect keyed on `props.open`:
   ```tsx
   useEffect(() => {
     if (props.open) {
       form?.reset(record); // if it has a form
       mutation.reset();
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
   }, [props.open]);
   ```
4. Fix `onSuccess` per the navigation rules. For these (all same-page): keep only `toast.*` + `handleOpenChange(false)` (which now just delegates to `props.onOpenChange(false)`). Move any `await queryClient.invalidateQueries(...)` so it is **not** gated behind a removed call, and does not race a navigation.
5. Add `onCloseAutoFocus={(e) => e.preventDefault()}` to the content if the trigger is a menu item / row icon button.

### Recipe C — the host component drives the param

The component that renders a Recipe-B dialog swaps its `useState` for the param.

**Single-instance dialog (one per page — e.g. a detail page's link/unlink):**

```tsx
const [action, setAction] = useQueryState("action", parseAsStringLiteral(["link-person", "unlink-person"] as const));
// trigger:
onClick={() => setAction("link-person", { history: "push" })}
// dialog:
<AdminModule_LinkPerson_Dialog
  userId={userId}
  open={action === "link-person"}
  onOpenChange={(open) => setAction(open ? "link-person" : null, { history: open ? "push" : "replace" })}
/>
```

**Per-row dialog (nested entity — needs a second param):**

```tsx
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update-variant", "delete-variant"] as const));
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

// row buttons:
onClick={() => openVariantAction("update-variant", variant.id)}
onClick={() => openVariantAction("delete-variant", variant.id)}

// dialogs — render only when the row resolves, so props.variant is always defined:
{activeVariant && (
  <I3Module_UpdateVariant_Dialog
    template={template}
    variant={activeVariant}
    open={action === "update-variant"}
    onOpenChange={(open) => (open ? undefined : closeVariantAction())}
  />
)}
{activeVariant && (
  <I3Module_DeleteVariant_Dialog
    template={template}
    variant={activeVariant}
    open={action === "delete-variant"}
    onOpenChange={(open) => (open ? undefined : closeVariantAction())}
  />
)}
```

- `setVariantId` / `setAction` are two writes; nuqs batches synchronous writes in one tick, so the URL updates once.
- On a cold direct-load of `?action=update-variant&variantId=xyz`, `variants` comes from a `useSuspenseQuery` (already awaited), so `activeVariant` resolves on first render.
- Close clears **both** params with `replace`.

### Recipe D — new state-transition confirm dialog (phase 11)

No existing component. **One dialog component per action** (not one per entity). `Dialog` (not `AlertDialog`), no `react-hook-form`, one `useMutation`, a single-verb `action` param. Template — this is the archive-package dialog; the other seven are the same shape with the verb / copy / mutation / entity-prop swapped per the phase-11 table:

```tsx
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

import { MutationButton } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ObjectName } from "@/components/ui/typography";
import { skillPackageBuilderEffects } from "@/client/skill-package-builder-effects";
import { useOrganization } from "@/hooks/use-organization";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_ArchivePackage_Dialog({
  skillPackage,
}: {
  skillPackage: SkillPackage;
}) {
  const organization = useOrganization();
  const [action, setAction] = useQueryState("action", parseAsStringLiteral(["archive"] as const));
  const dialogOpen = action === "archive";

  const mutation = useMutation(
    trpc.skillPackageBuilder.archivePackage.mutationOptions({
      meta: { effects: skillPackageBuilderEffects.archivePackage },
      onError(error) {
        toast.error(`Failed to archive package: ${error.message}`);
        console.error("Failed to archive package:", error);
      },
      onSuccess() {
        toast.success(
          <>
            Package <ObjectName>{skillPackage.name}</ObjectName> archived.
          </>,
        );
        handleDialogOpenChange(false);
      },
    }),
  );

  function handleDialogOpenChange(open: boolean) {
    void setAction(open ? "archive" : null, { history: open ? "push" : "replace" });
  }

  useEffect(() => {
    if (dialogOpen) mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
  }, [dialogOpen]);

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Archive package</DialogTitle>
          <DialogDescription>
            Archived packages are hidden from the catalogue and cannot be subscribed to. You can
            restore it later.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          <ObjectName>{skillPackage.name}</ObjectName>
        </p>
        <DialogFooter>
          <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
          <MutationButton
            type="button"
            status={mutation.status}
            text={{ idle: "Archive", pending: "Archiving", success: "Archived" }}
            onClick={() =>
              mutation.mutate({ skillPackageId: skillPackage.id, organizationId: organization.id })
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Each menu (`package-menu.tsx`, `group-menu.tsx`, `skill-menu.tsx`) drops the `useMutation` calls and `handleX` functions for the transitions it currently fires; widens its `useQueryState("action", …)` literal set from `["delete"]` to include that entity's transition verbs; each `<DropdownMenuItem onClick={handleArchive}>` becomes `onClick={() => setAction("archive", { history: "push" })}`; and the menu renders each new dialog next to the existing delete dialog (mounted unconditionally, like the delete dialog — each gates itself on its own verb). The dialog owns the exact single verb; the menu's wider set is only for its `setAction` calls — nuqs is fine with two components parsing the same `action` key with different literal sets.

### Recipe E — reorder dialog (phase 12)

`reorder-skills`, `reorder-groups` already `Dialog` + `DialogProps`-driven, with a `<Suspense>` body that remounts on open (seeding `order` state fresh). Convert the **host** (`group-contents.tsx` / `package-contents.tsx`) from `useState` to the param (Recipe C single-instance); the dialog itself just needs its internal `handleOpenChange` collapsed and `onCloseAutoFocus` added (its trigger is a toolbar icon button, not a menu item — check whether focus actually drops; add the prop only if it does).

---

## Phase 7: `i3/templates` — variants (nested entity, second param)

**Branch:** `mutation-dialogs/i3-variants`

Proves the `&variantId=` second-param shape. Do first — phase 8's `&memberId=` follows the same pattern, and the pattern doc is updated after this lands.

### File inventory

**Modify:**

- `src/app/(authenticated)/orgs/[slug]/i3/templates/[template_id]/add-variant.tsx` — Recipe A, `?action=add-variant`. `onSuccess` is same-page → `handleDialogOpenChange(false)` only (it currently also does `queryClient.setQueryData` + `invalidateQueries` — **leave that cache code**, just fix open/close).
- `src/app/(authenticated)/orgs/[slug]/i3/templates/[template_id]/update-variant.tsx` — Recipe B. Keep `DialogProps` signature. `onSuccess` → `toast` + `handleOpenChange(false)`; keep the `invalidateQueries`.
- `src/app/(authenticated)/orgs/[slug]/i3/templates/[template_id]/delete-variant.tsx` — Recipe B. Keep `AlertDialogProps`. `onSuccess` currently calls `handleOpenChange(false)` then `await queryClient.invalidateQueries(...)` — reorder to invalidate first (or drop the `handleOpenChange(false)` and let the host clear the param via `onOpenChange`); add `onCloseAutoFocus={(e) => e.preventDefault()}`.
- `src/app/(authenticated)/orgs/[slug]/i3/templates/[template_id]/template-variants.tsx` — **the host, Recipe C per-row.** Delete `variantToDelete` / `variantToEdit` `useState`; add `action` (`["update-variant","delete-variant"]`) + `variantId` (`parseAsString`) params; resolve `activeVariant` from the `listTemplateVariants` suspense query; row edit/delete buttons call `openVariantAction(...)`; render both dialogs gated on `activeVariant`. `add-variant` keeps its own trigger (it has no row context), so `<I3Module_Template_AddVariant_Dialog template={template} />` stays as-is in the `CardAction`.

**Leave untouched:** `page.tsx`, `template-menu.tsx`, `template-content` (if any), all sibling files.

### Interfaces

- `I3Module_Template_AddVariant_Dialog({ template })` — self-triggered, reads `?action=add-variant`.
- `I3Module_UpdateVariant_Dialog({ template, variant, ...props }: DialogProps & { template, variant })` — signature unchanged; host passes `open` / `onOpenChange`.
- `I3Module_DeleteVariant_Dialog({ template, variant, ...props }: AlertDialogProps & { template, variant })` — signature unchanged.

### Tasks

- [ ] **Branch** from `master`.
- [ ] **`add-variant.tsx`** — apply Recipe A with verb `add-variant`. Write the failing-then-passing loop as a manual browser check (no unit test exists for these). Commit.
- [ ] **`update-variant.tsx`** — apply Recipe B; open-reset effect keyed on `props.open`, resetting the form from `variant`. Commit.
- [ ] **`delete-variant.tsx`** — apply Recipe B; reset mutation on `props.open`; `onCloseAutoFocus`; fix `onSuccess` ordering. Commit.
- [ ] **`template-variants.tsx`** — apply Recipe C per-row. Commit.
- [ ] **Verify:** `npx tsc --noEmit`, `npm run test:run`, `npm run lint`.
- [ ] **Manual verification** (per the spec's per-phase checklist) for each of add / update / delete variant:
  - open from its trigger — template detail stays visible, URL gains `?action=…` (+ `&variantId=…` for update/delete);
  - direct-load `?action=update-variant&variantId=<real id>` — dialog opens with the variant's values on load;
  - direct-load with a bogus `variantId` — no crash, no dialog (host renders nothing);
  - submit/confirm — correct toast, variant list reflects the change, dialog closes, **both** params cleared;
  - cancel — both params cleared;
  - Back after open→close lands on the plain template detail page.
- [ ] **Update `docs/patterns/mutation-dialog.md`** — add the four wave-2 rules from the spec's "Wave-2 general rules" section, using this phase's `&variantId=` implementation as the worked example for "nested entity". Commit.
- [ ] Open PR `mutation-dialogs/i3-variants` → `master`.

---

## Phase 8: `admin/teams` — add / remove member

**Branch:** `mutation-dialogs/teams-members`

**Scope note:** the D4H team dialogs (`import-team-from-d4h.tsx`, and the unused `SyncD4HTeamDialog` in `team-personnel-content.tsx`) are **explicitly out of scope** — they are currently unwired and will be converted/integrated properly in a later, separate piece of work. Do not touch, wire, or delete them in this phase.

### File inventory

**Modify:**

- `src/components/admin/teams/add-team-member.tsx` — Recipe A, `?action=add-member`. Same-page `onSuccess` → `handleDialogOpenChange(false)` only.
- `src/components/admin/teams/remove-team-member.tsx` — Recipe B (`ComponentProps<typeof AlertDialog>`). Per-row (`&memberId=` — the member's `personId`). `onCloseAutoFocus`.
- `src/components/admin/teams/team-personnel-content.tsx` — **host, Recipe C per-row** for remove-member: delete `deleteTarget` `useState`; add `action` (`["remove-member"]`) + `memberId` (`parseAsString`) params; resolve the member from the `listTeamMemberships` suspense query; row delete button calls the open helper; render `<AdminModule_RemoveTeamMember_Dialog>` gated on the resolved member. `add-team-member` keeps its own trigger in `Saratoga.Actions`. **Leave `SyncD4HTeamDialog` and its `eslint-disable` exactly as they are.**

**Leave untouched:** `import-team-from-d4h.tsx`, `teams-list.tsx`, `page.tsx`, all other siblings.

### Interfaces

- `AdminModule_AddTeamMember_Dialog({ team })` — self-triggered, `?action=add-member`.
- `AdminModule_RemoveTeamMember_Dialog({ organizationId, team, person, ...props }: ComponentProps<typeof AlertDialog> & {...})` — signature unchanged; host passes `open` / `onOpenChange` derived from `?action=remove-member&memberId=<personId>`.

### Tasks

- [ ] **Branch** from `master`.
- [ ] **`add-team-member.tsx`** — Recipe A. Commit.
- [ ] **`remove-team-member.tsx`** — Recipe B; `onCloseAutoFocus`; reset mutation on `props.open`. Commit.
- [ ] **`team-personnel-content.tsx`** — host Recipe C per-row for remove; `add-team-member` unchanged; `SyncD4HTeamDialog` untouched. Commit.
- [ ] **Verify + Manual verification** (spec checklist) for add-member and remove-member (`&memberId=`).
- [ ] Open PR `mutation-dialogs/teams-members` → `master`.

---

## Phase 9: `skill-track/catalogue` — subscribe / unsubscribe

**Branch:** `mutation-dialogs/catalogue-subscribe`

### File inventory

**Modify:**

- `src/client/skills-effects.ts` — move the `onSuccess` `queryClient.setQueryData(trpc.skills.getPackage.queryKey…)` merge out of both dialogs and into `write()` entries:
  ```ts
  subscribeToPackage: (vars, { created }) => [
    write(
      trpc.skills.getPackage.queryKey({ organizationId: vars.organizationId, skillPackageId: vars.skillPackageId }),
      (old) => (old ? { ...old, subscription: created, subscriptionCount: old.subscriptionCount + 1 } : old),
    ),
    invalidate(trpc.skills.listPackages.queryFilter({ organizationId: vars.organizationId })),
  ],
  unsubscribeFromPackage: (vars) => [
    write(
      trpc.skills.getPackage.queryKey({ organizationId: vars.organizationId, skillPackageId: vars.skillPackageId }),
      (old) => (old ? { ...old, subscription: null, subscriptionCount: old.subscriptionCount - 1 } : old),
    ),
    invalidate(trpc.skills.listPackages.queryFilter({ organizationId: vars.organizationId })),
  ],
  ```
  `subscribeToPackage`'s output is `z.object({ created: SkillPackageSubscription.schema })` (confirmed in `skills-router.ts:678`) so `created` is the full subscription object the `write` needs. `unsubscribeFromPackage` returns no useful payload → its `write` is a pure updater. Confirm `getPackage`'s cached type has `subscription` + `subscriptionCount` fields (the manual code and `catalogue-package-content.tsx` both use them); if the `write` updater won't typecheck against that shape, fall back to `invalidate(getPackage.queryFilter(...))`.
- `src/components/skill-track/subscribe-package.tsx` — Recipe A, `?action=subscribe`. Delete the `queryClient` import + the `onSuccess` `setQueryData` block; `onSuccess` = `toast` + `handleDialogOpenChange(false)`.
- `src/components/skill-track/unsubscribe-package.tsx` — **`AlertDialog` → `Dialog`** (reversible state transition). Recipe A with its own `<DialogTrigger><Button variant="outline">Unsubscribe</Button></DialogTrigger>`, `?action=unsubscribe`. Delete the `queryClient` import + `setQueryData`. `MutationButton` keeps `variant="destructive"` is **wrong** here per the "AlertDialog for delete only" rule — but an unsubscribe is meaningfully destructive of the org's access; keep `variant="destructive"` on the button, just not the `AlertDialog` wrapper. Body text stays.
- `src/components/skill-track/catalogue-package-content.tsx` — the two dialogs are rendered conditionally on `skillPackage.subscription`; both keep their own triggers, so this file needs **no change** unless the `<Protect>` / conditional wrapping needs adjusting (verify the trigger buttons still render inside `Saratoga.Actions`).

### Tasks

- [ ] **Branch** from `master`.
- [ ] **`skills-effects.ts`** — write the two `write()` effects; run `npx tsc --noEmit` to confirm the `getPackage` cached type and the mutation response types line up. If `write` can't be typed cleanly, fall back to `invalidate(getPackage.queryFilter(...))`. Commit.
- [ ] **`subscribe-package.tsx`** — Recipe A; strip manual cache. Commit.
- [ ] **`unsubscribe-package.tsx`** — `AlertDialog`→`Dialog`, Recipe A; strip manual cache. Commit.
- [ ] **Verify + Manual verification:** subscribe then unsubscribe from a catalogue package detail page; confirm the header button, subscriber count, and "Subscribers" list all update **without a full page refetch** (the `write` effect); direct-load `?action=subscribe`; Back button.
- [ ] Open PR `mutation-dialogs/catalogue-subscribe` → `master`.

---

## Phase 10: `admin/users` — link / unlink person

**Branch:** `mutation-dialogs/users-link-person`

### File inventory

**Modify:**

- `src/components/admin/users/link-person.tsx` — Recipe B. Keep `DialogProps` + the internal `useState<string | null> personId` (that is a form field, not dialog state). Add open-reset effect keyed on `props.open` that also clears `personId` (`setPersonId(null)`). `onSuccess` = `toast` + `handleOpenChange(false)`.
- `src/components/admin/users/unlink-person.tsx` — Recipe B. Keep `AlertDialogProps`. `onSuccess` currently calls `props.onOpenChange?.(false)` — keep that (it's the whole close, no navigation). Add `onCloseAutoFocus={(e) => e.preventDefault()}`.
- `src/app/(authenticated)/orgs/[slug]/admin/users/[user_id]/page.tsx` — **host, Recipe C single-instance.** It already has `const [action, setAction] = useQueryState("action", parseAsStringLiteral(["delete"] as const))` for delete-user. Widen to `["delete", "link-person", "unlink-person"] as const`. Delete `linkPersonDialogOpen` / `unlinkPersonDialogOpen` `useState`. Link button → `onClick={() => setAction("link-person", { history: "push" })}`; unlink button → `onClick={() => setAction("unlink-person", { history: "push" })}`. Render `<AdminModule_LinkPerson_Dialog>` with `open={action === "link-person"}` / param `onOpenChange`; `<AdminModule_UnlinkPerson_Dialog>` (still gated on `linkedPerson &&`) with `open={action === "unlink-person"}`.

### Tasks

- [ ] **Branch** from `master`.
- [ ] **`link-person.tsx`** — Recipe B; reset effect clears `personId` + `mutation` on open. Commit.
- [ ] **`unlink-person.tsx`** — Recipe B; `onCloseAutoFocus`; reset mutation on `props.open`. Commit.
- [ ] **`[user_id]/page.tsx`** — widen the `action` literal set; swap both `useState` for the param. Commit.
- [ ] **Verify + Manual verification:** on a user detail page with no linked person → link one; on a user with a linked person → unlink; direct-load `?action=link-person`; Back button; confirm the delete-user dialog (already param-driven) is unaffected by sharing the widened literal set.
- [ ] Open PR `mutation-dialogs/users-link-person` → `master`.

---

## Phase 11: `skill-package-builder` — archive / restore / publish / unpublish (new confirm dialogs)

**Branch:** `mutation-dialogs/spb-state-transitions`

**Eight new dialog components — one per action** (Recipe D). The menus stop firing mutations directly.

### The eight dialogs

Each is the Recipe D template with these substitutions. File names follow the existing `delete-<entity>.tsx` convention.

| File                    | Component                                     | `action` verb | Procedure / effect | Permission    | Title             | Body                                                                                                     | Button `idle` / `pending` / `success`  | Toast                         |
| ----------------------- | --------------------------------------------- | ------------- | ------------------ | ------------- | ----------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------- |
| `archive-package.tsx`   | `SkillPackageBuilder_ArchivePackage_Dialog`   | `archive`     | `archivePackage`   | `["update"]`  | Archive package   | "Archived packages are hidden from the catalogue and cannot be subscribed to. You can restore it later." | Archive / Archiving / Archived         | Package `<name>` archived.    |
| `restore-package.tsx`   | `SkillPackageBuilder_RestorePackage_Dialog`   | `restore`     | `restorePackage`   | `["update"]`  | Restore package   | "The package returns to Active and can be edited and published again."                                   | Restore / Restoring / Restored         | Package `<name>` restored.    |
| `publish-package.tsx`   | `SkillPackageBuilder_PublishPackage_Dialog`   | `publish`     | `publishPackage`   | `["publish"]` | Publish package   | "Publishing makes this package available for other organisations to subscribe to."                       | Publish / Publishing / Published       | Package `<name>` published.   |
| `unpublish-package.tsx` | `SkillPackageBuilder_UnpublishPackage_Dialog` | `unpublish`   | `unpublishPackage` | `["publish"]` | Unpublish package | "Existing subscribers keep their copy; no new organisations can subscribe."                              | Unpublish / Unpublishing / Unpublished | Package `<name>` unpublished. |
| `archive-group.tsx`     | `SkillPackageBuilder_ArchiveGroup_Dialog`     | `archive`     | `archiveGroup`     | `["update"]`  | Archive group     | "Archived groups and their skills are hidden. You can restore the group later."                          | Archive / Archiving / Archived         | Group `<name>` archived.      |
| `restore-group.tsx`     | `SkillPackageBuilder_RestoreGroup_Dialog`     | `restore`     | `restoreGroup`     | `["update"]`  | Restore group     | "The group and its skills return to Active."                                                             | Restore / Restoring / Restored         | Group `<name>` restored.      |
| `archive-skill.tsx`     | `SkillPackageBuilder_ArchiveSkill_Dialog`     | `archive`     | `archiveSkill`     | `["update"]`  | Archive skill     | "Archived skills are hidden and no longer assigned in new skill checks. You can restore it later."       | Archive / Archiving / Archived         | Skill `<name>` archived.      |
| `restore-skill.tsx`     | `SkillPackageBuilder_RestoreSkill_Dialog`     | `restore`     | `restoreSkill`     | `["update"]`  | Restore skill     | "The skill returns to Active."                                                                           | Restore / Restoring / Restored         | Skill `<name>` restored.      |

- Entity prop: `{ skillPackage }` / `{ skillGroup }` / `{ skill }`; mutation input key: `skillPackageId` / `skillGroupId` / `skillId` (+ `organizationId`).
- `onError` toast: `Failed to <idle.toLowerCase()> <entity>: ${error.message}` + `console.error`.
- All eight: `Dialog` (not `AlertDialog`), `onCloseAutoFocus={(e) => e.preventDefault()}` on `DialogContent`, reset the mutation in the open-triggered effect, `onSuccess` = toast + `handleDialogOpenChange(false)` (no navigation).

### File inventory

**Create:** the eight files above.

**Modify:**

- `src/components/skill-package-builder/package-menu.tsx` — delete the four `useMutation` calls (`archiveMutation`, `publishMutation`, `restoreMutation`, `unpublishMutation`), the four `handleX` functions, and the now-unused `toast` / `useMutation` / `skillPackageBuilderEffects` imports. Widen `useQueryState("action", …["delete"])` → `["delete", "archive", "restore", "publish", "unpublish"] as const`. Each `<DropdownMenuItem onClick={handleX}>` → `onClick={() => setAction("<verb>", { history: "push" })}`; drop `disabled={… || xMutation.isPending}` (the dialog owns pending state), keep `disabled={!allowed}`; keep the `skillPackage.status` / `skillPackage.published` conditionals that decide which items show. Render all four new package dialogs next to the existing `<SkillPackageBuilder_DeletePackage_Dialog>` (each self-gates on its verb; mount unconditionally).
- `src/components/skill-package-builder/group-menu.tsx` — same shape; widen to `["delete", "archive", "restore"]`; delete `archiveMutation` / `restoreMutation` + `handleArchive` / `handleRestore`; render `<SkillPackageBuilder_ArchiveGroup_Dialog>` + `<SkillPackageBuilder_RestoreGroup_Dialog>`.
- `src/components/skill-package-builder/skill-menu.tsx` — same; widen to `["delete", "archive", "restore"]`; delete the two mutations + handlers; render `<SkillPackageBuilder_ArchiveSkill_Dialog>` + `<SkillPackageBuilder_RestoreSkill_Dialog>`. **Leave the `move` `useState` alone** — phase 12.

### Design notes

- **One `action` param, multiple parsers on the same page.** A package detail page renders `package-menu` (its `setAction` parses `["delete","archive","restore","publish","unpublish"]`) plus four dialogs each parsing one verb. No collision — each dialog checks its own verb; `?action=delete` opens only the delete dialog.
- **Menu vs. dialog literal sets:** the menu's `setAction` and each dialog's `useQueryState` all point at the `action` key. The dialogs own single exact verbs; the menu's set is their union plus `delete`. nuqs supports two components parsing the same key with different literal sets.
- **`onSuccess` stays on the page** — `handleDialogOpenChange(false)` only, no navigation (an archived package's detail page still exists; the menu item set just re-renders Archive→Restore etc. off the updated `status` / `published`).
- **Permissions:** archive/restore = `skillPackageBuilder: ["update"]`; publish/unpublish = `skillPackageBuilder: ["publish"]`. Gating stays on the `<Protect>`-wrapped menu item (the only trigger); the dialog relies on the tRPC procedure as the real guard.

### Tasks

- [ ] **Branch** from `master`.
- [ ] **`archive-package.tsx`** — write from the Recipe D template + the table row. Manual browser check. Commit.
- [ ] **`restore-package.tsx`**, **`publish-package.tsx`**, **`unpublish-package.tsx`** — one commit each (or one commit for all four package dialogs — they are mechanical variants).
- [ ] **`archive-group.tsx`** + **`restore-group.tsx`** — one commit.
- [ ] **`archive-skill.tsx`** + **`restore-skill.tsx`** — one commit.
- [ ] **`package-menu.tsx`** — strip the four mutations + handlers, widen the literal set, wire menu items to `setAction`, render the four dialogs. Commit.
- [ ] **`group-menu.tsx`** — same for archive/restore. Commit.
- [ ] **`skill-menu.tsx`** — same for archive/restore; leave `move`. Commit.
- [ ] **Verify:** `npx tsc --noEmit`, `npm run test:run`, `npm run lint`. Grep for any remaining `toast.promise(` in the three menu files — expect none.
- [ ] **Manual verification** for every verb × entity:
  - open from the menu item — page stays, `?action=<verb>` in URL, focus does not jump to `<body>` on close (`onCloseAutoFocus`);
  - direct-load `?action=archive` on a package detail — dialog opens;
  - confirm — correct toast copy, the menu item set flips (Archive→Restore, Publish→Unpublish), no navigation;
  - a failed transition (e.g. publish a package with validation errors, if reachable) — error toast, button returns to idle, dialog stays open;
  - Back after open→close.
- [ ] Open PR `mutation-dialogs/spb-state-transitions` → `master`.

---

## Phase 12: `skill-package-builder` — move-skill, reorder-skills, reorder-groups

**Branch:** `mutation-dialogs/spb-ordering`

### File inventory

**Modify:**

- `src/components/skill-package-builder/skill-menu.tsx` — delete `const [moveDialogOpen, setMoveDialogOpen] = useState(false)`; widen `useQueryState("action", …)` to include `"move"`; the Move `<DropdownMenuItem onClick={() => setMoveDialogOpen(true)}>` → `onClick={() => setAction("move", { history: "push" })}`; render `<SkillPackageBuilder_MoveSkill_Dialog skill={skill} open={action === "move"} onOpenChange={(open) => setAction(open ? "move" : null, { history: open ? "push" : "replace" })} />`.
  - **This also fixes issue #66** — `move-skill` currently mounts unconditionally (`open={moveDialogOpen}` always rendered) and dereferences `originPackage!` / `originGroup!` on cold load. Once it renders only when `action === "move"`, the crash path is gone — but still apply the guard below.
- `src/components/skill-package-builder/move-skill.tsx` — Recipe B (keep `DialogProps`). Additionally:
  - **Guard the non-null assertions (issue #66):** replace `const originPackage = skillPackages.find(...)!` / `originGroup = ...!` with un-asserted `find(...)`, and early-return the skeleton dialog body when `!skillPackagesReady || !skillGroupsReady || !originPackage || !originGroup` — do **not** rely on `<Show>` to gate access (it evaluates children eagerly). Keep the `<Show>` removed or make every access optional.
  - Collapse `handleOpenChange` to delegate to `props.onOpenChange`; move the `setDestinationPackageId` / `setDestinationGroupId` reset into an open-triggered effect keyed on `props.open` (seed `destinationPackageId` from `skill.skillPackageId`, `destinationGroupId` to `null`).
  - `onSuccess` already does `handleOpenChange(false)` then `router.replace(...)` — this **violates** the no-param-clear-with-navigation rule. Since `handleOpenChange` now only delegates to `props.onOpenChange` (which the host turns into a `replace` param-clear), and `router.replace` navigates: keep **only** `router.replace(...)` in `onSuccess`; drop `handleOpenChange(false)`. The navigation unmounts the dialog.
  - `onCloseAutoFocus={(e) => e.preventDefault()}` on the `DialogContent` (menu-item trigger).
- `src/components/skill-package-builder/reorder-skills.tsx` — Recipe B (keep `DialogProps`). Its `<Suspense>` inner body already remounts per open and seeds `order` fresh, so there is little internal state to reset. Collapse the internal `handleOpenChange` if present; the `onSaved={() => props.onOpenChange?.(false)}` callback stays. Add `onCloseAutoFocus` only if the toolbar trigger loses focus on close (verify).
- `src/components/skill-package-builder/reorder-groups.tsx` — same as reorder-skills.
- `src/components/skill-package-builder/group-contents.tsx` — **host, Recipe C single-instance.** Delete `const [reorderDialogOpen, setReorderDialogOpen] = useState(false)`; add `useQueryState("action", parseAsStringLiteral(["reorder-skills"] as const))`; toolbar `<Button onClick={() => setReorderDialogOpen(true)}>` → `onClick={() => setAction("reorder-skills", { history: "push" })}`; `<SkillPackageBuilder_ReorderSkills_Dialog … open={action === "reorder-skills"} onOpenChange={…} />`. Keep the separate `showArchived` `useState` (not dialog state).
- `src/components/skill-package-builder/package-contents.tsx` — same, `["reorder-groups"]`.

### Design notes

- Each host page hosts exactly one reorder dialog → `["reorder-skills"]` on a group page, `["reorder-groups"]` on a package page. A skill detail page hosts `skill-menu` with `["delete", "archive", "restore", "move"]` (phases 11 + 12 combined once both land) — no collision.
- `move-skill` keeps its `onMutate` optimistic update and `onSettled` invalidation exactly as they are — mutation wiring is out of scope.

### Tasks

- [ ] **Branch** from `master` (after phase 11 lands, so `skill-menu.tsx`'s widened literal set is a clean merge — or rebase phase 12 onto master once 11 merges).
- [ ] **`move-skill.tsx`** — Recipe B + the #66 guard (un-assert `find`, early-return skeleton) + `onSuccess` = `router.replace` only + `onCloseAutoFocus`. Commit.
- [ ] **`skill-menu.tsx`** — swap `moveDialogOpen` `useState` for the `"move"` verb on the `action` param. Commit.
- [ ] **`reorder-skills.tsx` + `group-contents.tsx`** — Recipe B on the dialog, Recipe C on the host. Commit as a pair.
- [ ] **`reorder-groups.tsx` + `package-contents.tsx`** — same. Commit as a pair.
- [ ] **Verify:** `npx tsc --noEmit`, `npm run test:run`, `npm run lint`.
- [ ] **Manual verification:**
  - **move-skill:** open from the skill menu; **hard-reload a skill detail page** (issue #66 repro) — no crash, page renders; direct-load `?action=move`; pick a destination group, Move — toast, navigates to the moved skill's detail, dialog gone; cancel — param cleared, focus back;
  - **reorder-skills:** open from the group toolbar; reorder via the sortable list; Save — toast, list reflects new order, dialog closes; direct-load `?action=reorder-skills`; Back button;
  - **reorder-groups:** same on a package page.
- [ ] Open PR `mutation-dialogs/spb-ordering` → `master`.
- [ ] **Close issue #66** with a reference to this PR (the guard + conditional mount both address it).

---

## Cross-phase self-review checklist

Run before opening each PR:

1. **`action` literal set** — does every `useQueryState` in a touched file parse only verbs that component/page owns? Any two dialogs on the same route that both want the same verb? (None expected — verified per phase above.)
2. **Second param cleared on close** — for phases 7 & 8, does `closeXAction()` clear **both** `action` and the id param with `{ history: "replace" }`?
3. **Navigation rule** — grep each touched `onSuccess` for a `setAction(null)` / `handleDialogOpenChange(false)` **and** a `router.*` in the same handler. Exactly one of them should remain (see Global Constraints).
4. **Reset effect** — every converted create/update/confirm dialog has the open-triggered `form.reset()` + `mutation.reset()` effect; no `form.reset()` left in a close branch.
5. **`onCloseAutoFocus`** — present on every dialog whose only trigger is a `DropdownMenuItem` or an unmounting table-row button; it is `(e) => e.preventDefault()` and nothing more.
6. **No stray `toast.promise`** — phases 11/12 remove all `toast.promise(mutateAsync(...))` from the three menu files.
7. **Manual cache** — only phase 9 touches `skills-effects.ts`; no other `*-effects.ts` or tRPC file is modified.
8. **`_Dialog` naming** — every exported dialog component ends in `_Dialog`.

## Risks

- **Second-param cold-load (phase 7/8):** if the host resolves the row from a non-suspense `useQuery`, `activeVariant` is `null` on first render of a direct load and the dialog never opens. Both hosts here use `useSuspenseQuery` / `useSuspenseQueries` — confirm that stays true; if a host uses plain `useQuery`, gate the dialog on `isSuccess` and accept a one-frame delay, or switch that query to suspense.
- **Phase 9 `write` typing:** `getPackage`'s cached shape must include `subscription` + `subscriptionCount`, and `subscribeToPackage`'s response must carry the subscription object. If either fails to typecheck, fall back to `invalidate(getPackage.queryFilter(...))` — accepts a refetch, still correct.
- **Phase 11 — many dialogs sharing the `action` param on one page:** a package detail page mounts 5 dialogs (delete + 4 transitions), each parsing one verb, plus the menu whose `setAction` parses the union. Supported by nuqs, but verify: `?action=delete` opens only the delete dialog; opening one transition dialog and hitting Back closes it cleanly; no two dialogs ever both think they are open.
- **Phase 12 `move-skill` #66:** the conditional mount alone fixes the _reported_ crash, but a warm cache + a genuinely-missing origin package/group would still hit the `!` — the un-assert + early-return is the real fix. Do both.
- **`onCloseAutoFocus` over-application:** wave 1 added it to files where the trigger was a mounted button and it was pointless (later trimmed). Add it only where the trigger actually unmounts (menu item, conditionally-rendered row button).
- **Phase ordering:** phases 7–11 are independent and branch from `master`. Phase 12 touches `skill-menu.tsx` which phase 11 also edits — branch 12 from `master` after 11 merges, or rebase.
