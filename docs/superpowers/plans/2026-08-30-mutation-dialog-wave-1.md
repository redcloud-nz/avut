# Mutation Dialog Migration — Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every wave-1 create/update/delete mutation dialog (teams, sessions, skill-package-builder, i3 templates, users, invitations) from local `useState` (or the PR #58 route groups, for teams) to the `?action=` search-param pattern.

**Architecture:** Each dialog component swaps its open/close `useState` for `useQueryState("action", parseAsStringLiteral([...]))` from nuqs, keeping its own trigger where it has one. `history: "push"` on open, `"replace"` on close. `onSuccess` either navigates (create/delete) or clears the param (update) — never both. No routes, route groups, layouts, `page.tsx`, or `generateMetadata` are touched (teams phase 1 _removes_ the route-group scaffolding it added in PR #58). The mutation wiring (`meta.effects` / manual `invalidateQueries` / `authClient`) is left exactly as it is.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, nuqs 2, `@tanstack/react-query` 5, react-hook-form + zod 4, shadcn/ui (`Dialog` / `AlertDialog`).

**Spec:** [`docs/superpowers/specs/2026-08-30-mutation-dialog-migration-design.md`](../specs/2026-08-30-mutation-dialog-migration-design.md)
**Pattern doc:** [`docs/patterns/mutation-dialog.md`](../../patterns/mutation-dialog.md)
**Reference implementation:** `admin/personnel` — branch `pilot/nuqs-mutation-dialogs`, commits `4bc6d59` (pilot) + `edbc559` (param rename).

## Global Constraints

- **nuqs is already installed** (`nuqs@^2.10.1`) and `NuqsAdapter` already wraps the app in `src/components/providers.tsx`. Do not re-add either.
- **Param name is `action`.** Never `dialog`.
- **Param values are lowercase verbs:** `create`, `update`, `delete`. One `useQueryState` call per dialog component, parsing only its own value(s) via `parseAsStringLiteral([...] as const)`.
- **`history` option is mandatory on every `setAction` call:** `{ history: "push" }` when opening, `{ history: "replace" }` when closing/clearing.
- **Never pair a param-clear with `router.push` in the same `onSuccess`.** create → `router.push` only; update → `handleDialogOpenChange(false)` only; delete → `router.push` only (delete `onSuccess` must NOT call `props.onOpenChange?.(false)` or `mutation.reset()`).
- **`form.handleSubmit(onValid, onInvalid)`** — always pass the second arg; it logs to `console.error`.
- **No changes to tRPC procedures or `src/client/*-effects.ts`.** If a dialog currently uses manual `queryClient.invalidateQueries` or `authClient` directly, leave that untouched.
- **Keep the component's exported name ending in `_Dialog`.** Teams' two `_DialogContent` components are renamed back to `_Dialog` in phase 1; no other renames.
- **Menu-triggered dialogs** (delete opened from a `DropdownMenuItem`): add `onCloseAutoFocus={(e) => { e.preventDefault(); triggerRef.current?.focus(); }}` to the dialog content, with a `ref` on the menu's trigger `<Button>`. This is a real requirement, not optional — the menu item unmounts before the dialog closes so focus otherwise drops to `<body>`.
- **Each phase is its own branch and PR**, branched from `master`, named `mutation-dialogs/<area>` (e.g. `mutation-dialogs/teams`). Phase 1 (teams) merges first; later phases branch from `master` after it lands.
- **Verification per phase, before opening the PR:**
  ```
  npx tsc --noEmit
  npm run test:run
  npx eslint <the files you touched>
  ```
  then the browser click-through in that phase's "Manual verification" step. `npx next typegen` is only needed in phase 1 (which deletes routes).
- **Commit granularity:** one commit per dialog (or per tightly-coupled pair), plus a final commit for trigger/menu cleanup. Show the message and wait for yes/no before `git commit` (per AGENTS.md).

## The per-dialog recipe (applies to every task below)

**Non-destructive dialog (`create` / `update`, renders `<Dialog>` + a form):**

Before:

```tsx
import { useState } from "react";
// ...
const [dialogOpen, setDialogOpen] = useState(false);
// ...
function handleDialogOpenChange(nextOpen: boolean) {
  if (!nextOpen) {
    form.reset();
    mutation.reset();
  }
  setDialogOpen(nextOpen); // or onOpenChange(nextOpen) for a controlled one
}
```

After:

```tsx
import { parseAsStringLiteral, useQueryState } from "nuqs";
// ...
const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
const dialogOpen = action === "update";
// ...
function handleDialogOpenChange(open: boolean) {
  if (open) {
    void setAction("update", { history: "push" });
  } else {
    form.reset();
    mutation.reset();
    void setAction(null, { history: "replace" });
  }
}
```

- Keep the existing `<DialogTrigger asChild><Button>…</Button></DialogTrigger>` if the component has one.
- If the component was a controlled `_DialogContent` with no trigger (teams), add a `<DialogTrigger asChild>` with the button that used to be a `<Link>` at the call site, and drop the `open` / `onOpenChange` props from the signature.
- `create` `onSuccess`: leave the existing `router.push(route(".../[id]", { ... created.id }))` as the only close action.
- `update` `onSuccess`: replace any `router.push` / `onOpenChange(false)` with `handleDialogOpenChange(false)`.

**Destructive dialog (`delete`, renders `<AlertDialog>`, already controlled via `AlertDialogProps` / `ComponentProps<typeof AlertDialog>`):**

- **Do not** add `useQueryState` inside the delete component — it stays prop-driven (`{...props}` onto `<AlertDialog>`).
- In its `onSuccess`: keep only `toast.*` + `router.push(route(".../list", { slug }))`. **Delete** any `props.onOpenChange?.(false)`, `mutation.reset()`, and move any `await queryClient.invalidateQueries(...)` to run _before_ the `router.push` (or leave it after — but it must not be gated behind the removed `onOpenChange`).
- The component that renders it (a `*-menu.tsx` or a detail page) gets the `useQueryState` and passes `open` / `onOpenChange`:
  ```tsx
  const [action, setAction] = useQueryState("action", parseAsStringLiteral(["delete"] as const));
  // menu item:
  onClick={() => setAction("delete", { history: "push" })}
  // dialog:
  <XDelete_Dialog
      x={x}
      open={action === "delete"}
      onOpenChange={(open) => setAction(open ? "delete" : null, { history: open ? "push" : "replace" })}
      onCloseAutoFocus={(e) => { e.preventDefault(); menuTriggerRef.current?.focus(); }}
  />
  ```

**Trigger call sites** (buttons/menu items that used to flip `useState` or link to a `--*` route):

- Header "New X" button → `<Button onClick={() => setAction("create", { history: "push" })}>` — but only if that button lives in the same client component as the dialog. In practice the create dialog keeps its own `<DialogTrigger>`, so the header just renders `<X_CreatePicker_Dialog />` unchanged.
- Card-action edit pencil that is currently a `<Link href={route(".../--update")}>` (teams) → back to the dialog's own `<DialogTrigger asChild><Button variant="ghost" size="icon"><ObjectIcons.Edit /></Button></DialogTrigger>`, i.e. render `<X_Update_Dialog x={x} />` in the `CardAction` with no props.
- Menu `<DropdownMenuItem asChild><Link href={route(".../--delete")}>` (teams) → `<DropdownMenuItem onClick={() => setAction("delete", { history: "push" })}>`.

---

## Phase 1: `admin/teams` — remove route groups, adopt `?action=`

**Branch:** `mutation-dialogs/teams`

This phase both _removes_ the PR #58 route-group scaffolding and converts the three dialogs. Biggest phase; do it first as the second reference alongside personnel.

### File inventory

**Delete:**

- `src/app/(authenticated)/orgs/[slug]/admin/teams/(list)/layout.tsx`
- `src/app/(authenticated)/orgs/[slug]/admin/teams/(list)/page.tsx`
- `src/app/(authenticated)/orgs/[slug]/admin/teams/(list)/--create/page.tsx`
- `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/(detail)/layout.tsx`
- `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/(detail)/page.tsx`
- `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/(detail)/--update/page.tsx`
- `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/(detail)/--delete/page.tsx`
- the now-empty `(list)/` and `(detail)/` directories

**Create:**

- `src/app/(authenticated)/orgs/[slug]/admin/teams/page.tsx` — the list page (from `(list)/layout.tsx`)
- `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/page.tsx` — the detail page (from `[team_id]/(detail)/layout.tsx`)

**Modify:**

- `src/components/admin/teams/create-team.tsx` — `_DialogContent` → `_Dialog`, add param + `<DialogTrigger>`, drop `open`/`onOpenChange` props
- `src/components/admin/teams/update-team.tsx` — same
- `src/components/admin/teams/delete-team.tsx` — `AlertDialogProps` stays; fix `onSuccess`; (no `useQueryState` here)
- `src/components/admin/teams/team-content.tsx` — CardAction edit `<Link>` → `<AdminModule_UpdateTeam_Dialog team={team} />`
- `src/components/admin/teams/team-menu.tsx` — Delete `<Link>` → `onClick={() => setAction("delete", …)}`; render `<AdminModule_DeleteTeam_Dialog>` here with param-driven `open`/`onOpenChange` + `onCloseAutoFocus`; add `useQueryState`
- `src/components/admin/teams/teams-list.tsx` — add `Saratoga.Header` + `Saratoga.Actions` + `<Protect permissions={{ team: ["create"] }}><AdminModule_CreateTeam_Dialog /></Protect>` (moved out of the deleted `(list)/layout.tsx`)

**Leave untouched:** `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/personnel/page.tsx` (its parent dir loses the `(detail)` sibling group, no file change).

### Interfaces

- `AdminModule_CreateTeam_Dialog()` — no props; renders its own trigger + `<Dialog>`. Reads `?action=create`.
- `AdminModule_UpdateTeam_Dialog({ team }: { team: TeamData })` — renders its own edit-pencil trigger + `<Dialog>`. Reads `?action=update`.
- `AdminModule_DeleteTeam_Dialog({ team, ...props }: AlertDialogProps & { team: TeamData })` — unchanged signature.

- [ ] **Step 1: Branch**

```bash
git checkout master && git pull && git checkout -b mutation-dialogs/teams
```

- [ ] **Step 2: Recreate `teams/page.tsx` (list)**

Create `src/app/(authenticated)/orgs/[slug]/admin/teams/page.tsx`. Copy the body of the current `(list)/layout.tsx` but: it is a `page.tsx` (no `children`), export default `async function AdminModule_TeamsList_Page(props: PageProps<"/orgs/[slug]/admin/teams">)`, keep `export const metadata = { title: "Teams" }`, keep `requireOrganization`, keep `prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }))` + `<HydrateClient>`, keep the `<Std.SidebarInset>` / `<Std.Navbar breadcrumbs={[…]}>` / `<Std.ScrollContainer>` shell. Replace the `<Saratoga.Root><Saratoga.Header>…<Link href={route(".../--create")}>…</Saratoga.Header><AdminModule_TeamsList /></Saratoga.Root>` block with just `<AdminModule_TeamsList />` (the header moves into the list component in Step 8).

- [ ] **Step 3: Recreate `teams/[team_id]/page.tsx` (detail)**

Create `src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/page.tsx` from the current `[team_id]/(detail)/layout.tsx`: keep `generateMetadata` verbatim (change its `Props` type to `PageProps<"/orgs/[slug]/admin/teams/[team_id]">` with no `children`), keep `prefetch(trpc.teams.getTeam.queryOptions(...))` + `<HydrateClient>`, render `<Std.SidebarInset><AdminModule_Team_Content teamId={teamId} />{/* no children */}</Std.SidebarInset>`. Default export `async function AdminModule_Team_Page(props: PageProps<"/orgs/[slug]/admin/teams/[team_id]">)`.

- [ ] **Step 4: Delete the route-group files**

```bash
git rm "src/app/(authenticated)/orgs/[slug]/admin/teams/(list)/layout.tsx" \
       "src/app/(authenticated)/orgs/[slug]/admin/teams/(list)/page.tsx" \
       "src/app/(authenticated)/orgs/[slug]/admin/teams/(list)/--create/page.tsx" \
       "src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/(detail)/layout.tsx" \
       "src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/(detail)/page.tsx" \
       "src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/(detail)/--update/page.tsx" \
       "src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/(detail)/--delete/page.tsx"
```

- [ ] **Step 5: `npx next typegen` and confirm the deleted route patterns are gone**

Run `npx next typegen`. Then `grep -rn 'teams/--\|teams/\[team_id\]/--' src/` — expect no matches except ones you will fix in later steps (there are none outside the deleted files).

- [ ] **Step 6: Convert `create-team.tsx`**

Rename export `AdminModule_CreateTeam_DialogContent` → `AdminModule_CreateTeam_Dialog`. Remove the `{ open, onOpenChange }` params. Add:

```tsx
import { parseAsStringLiteral, useQueryState } from "nuqs";
// ...
const [action, setAction] = useQueryState("action", parseAsStringLiteral(["create"] as const));
const dialogOpen = action === "create";
```

Rewrite `handleDialogOpenChange` per the recipe (open→push, close→`form.reset()`+`mutation.reset()`+`setAction(null, replace)`). In the JSX, `<Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>` and add back the trigger:

```tsx
<DialogTrigger asChild>
  <Button variant="outline">
    <ObjectIcons.Create /> <span className="hidden md:inline">New Team</span>
  </Button>
</DialogTrigger>
```

(add `DialogTrigger` to the `@/components/ui/dialog` import and `Button` + `ObjectIcons`.) Leave `onSuccess` (`router.push` to the new team) as-is.

- [ ] **Step 7: Convert `update-team.tsx`**

Rename `AdminModule_UpdateTeam_DialogContent` → `AdminModule_UpdateTeam_Dialog`. Keep the `{ team }` param, drop `{ open, onOpenChange }`. Add the `useQueryState(["update"])` + `dialogOpen`. Rewrite `handleDialogOpenChange`. Add the trigger:

```tsx
<DialogTrigger asChild>
  <Button variant="ghost" size="icon">
    <ObjectIcons.Edit />
  </Button>
</DialogTrigger>
```

In `onSuccess`, replace `router.push(route(".../[team_id]", …))` with `handleDialogOpenChange(false)`. Remove the now-unused `useRouter` / `route` imports if nothing else uses them.

- [ ] **Step 8: Move the create trigger into `teams-list.tsx`**

Wrap the returned `<div>` in `<Saratoga.Root><Saratoga.Header><Saratoga.Title>Teams</Saratoga.Title><Saratoga.Actions><Protect permissions={{ team: ["create"] }}><AdminModule_CreateTeam_Dialog /></Protect></Saratoga.Actions></Saratoga.Header>{…the existing table div…}</Saratoga.Root>`. Add imports for `Saratoga`, `Protect`, `AdminModule_CreateTeam_Dialog`.

- [ ] **Step 9: Convert `delete-team.tsx` `onSuccess`**

It already takes `AlertDialogProps` and spreads `{...props}` — keep that. In `onSuccess`: keep `toast.success(...)`, keep `await queryClient.invalidateQueries(trpc.teams.listTeams.queryFilter({ organizationId: organization.id }))`, keep `router.push(route("/orgs/[slug]/admin/teams", { slug: organization.slug }))`. It currently has no `onOpenChange(false)` / `mutation.reset()` — confirm and leave. (Order: invalidate then push, or push then invalidate — either is fine; match current.)

- [ ] **Step 10: Wire `team-menu.tsx`**

Add `useQueryState(["delete"])`. Add a `ref` to the `DropdownMenuTrigger`'s `<Button>` (`const menuTriggerRef = useRef<HTMLButtonElement>(null);`). Replace the Delete `<DropdownMenuItem asChild><Link href={route(".../--delete")}>…</Link></DropdownMenuItem>` with:

```tsx
<DropdownMenuItem
  onClick={() => setAction("delete", { history: "push" })}
  disabled={!allowed}
  className="text-destructive"
>
  <ObjectIcons.Delete /> Delete
</DropdownMenuItem>
```

After `</DropdownMenu>`, render:

```tsx
<AdminModule_DeleteTeam_Dialog
  team={team}
  open={action === "delete"}
  onOpenChange={(open) => setAction(open ? "delete" : null, { history: open ? "push" : "replace" })}
/>
```

Add `onCloseAutoFocus` to `AlertDialogContent` inside `delete-team.tsx` accepting an optional handler — simplest: pass it through `{...props}` (AlertDialog forwards content props? no). Instead, in `delete-team.tsx` add `onCloseAutoFocus` to the `AlertDialogContent` directly:

```tsx
<AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
```

and in `team-menu.tsx` after the dialog closes, `menuTriggerRef.current?.focus()` is called from the `onOpenChange` when `open === false`. Wire `menuTriggerRef` onto `<Button ref={menuTriggerRef} variant="ghost" size="icon">` in the trigger.

- [ ] **Step 11: Fix the CardAction edit trigger in `team-content.tsx`**

Replace:

```tsx
<Protect permissions={{ team: ["update"] }}>
    <Button variant="ghost" asChild>
        <Link href={route("/orgs/[slug]/admin/teams/[team_id]/--update", { … })}><ObjectIcons.Edit /></Link>
    </Button>
</Protect>
```

with:

```tsx
<Protect permissions={{ team: ["update"] }}>
  <AdminModule_UpdateTeam_Dialog team={team} />
</Protect>
```

Add the import; remove the now-unused `Link` / `route` / `Button` imports if nothing else in the file uses them (the D4H card still has a `<Button>` — check).

- [ ] **Step 12: Typecheck, lint, test**

```bash
npx next typegen && npx tsc --noEmit && npx eslint src/components/admin/teams "src/app/(authenticated)/orgs/[slug]/admin/teams" && npm run test:run
```

Expected: all pass. Fix any `route()` / import errors.

- [ ] **Step 13: Manual verification** (dev server running; `test-in-browser` skill)

On `christchurch-cdem` (or any org with teams):

1. `/orgs/<slug>/admin/teams` → click **New Team** → URL becomes `?action=create`, list visible behind the dialog. Fill name → **Create** → lands on `/orgs/<slug>/admin/teams/<newId>`, no `?action`. Delete that test team afterwards (step 3 below) or via Prisma Studio.
2. Direct-load `/orgs/<slug>/admin/teams?action=create` → dialog opens.
3. On a team detail page → edit pencil → `?action=update`, form prefilled → edit → **Update** → toast "Team updated", dialog closes, stays on detail, name refreshed. Back button → does not reopen the dialog.
4. Team menu → **Delete** → `?action=delete`, `AlertDialog` over the detail page → **Delete** → toast, redirect to `/orgs/<slug>/admin/teams`, list no longer shows it. Direct-load `…/<id>?action=delete` also opens it.
5. `/orgs/<slug>/admin/teams/<id>/personnel` still loads (sibling route intact).

- [ ] **Step 14: Commit + PR**

Commits (show each message, wait for yes/no):

- `teams: recreate list/detail pages, drop the --create/--update/--delete route groups`
- `teams: drive create/update/delete dialogs from the ?action= param`
  Open PR `mutation-dialogs/teams` against `master`.

---

## Phase 2: `skill-track/sessions`

**Branch:** `mutation-dialogs/sessions` (from `master` after phase 1 merges)

### File inventory

**Modify:**

- `src/components/skill-track/create-session.tsx` — `useState` → `useQueryState(["create"])`; keeps its own `<DialogTrigger>`. `onSuccess` already `router.push`es to the new session — leave.
- `src/components/skill-track/update-session.tsx` — **currently typed `({ session, ...props }: DialogProps & { session })`** and rendered uncontrolled (no `open`/`onOpenChange` passed by `session-content.tsx`), with a passthrough `props.onOpenChange?.(open)` in its `handleOpenChange`. Change the signature to `({ session }: { session: SkillCheckSession })`, drop the `DialogProps` spread, add `useQueryState(["update"])` + `dialogOpen`, and make `handleOpenChange` do the push/replace (no more `props.onOpenChange?.`). Keep its `<DialogTrigger>`. In `onSuccess`: `handleDialogOpenChange(false)` then keep the existing `router.refresh()` (it re-renders in place, not a navigation — not a race).
- `src/components/skill-track/delete-session.tsx` — controlled; fix `onSuccess` (keep `router.push` to `/orgs/[slug]/skill-track/sessions`, drop any `onOpenChange(false)` / `mutation.reset()`).
- `src/components/skill-track/session-menu.tsx` — `useState` → `useQueryState(["delete"])`; menu item `onClick`; render `<SkillsModule_DeleteSession_Dialog open={action==="delete"} onOpenChange={…} />` + `onCloseAutoFocus` / `menuTriggerRef`.
- `src/components/skill-track/session-content.tsx` — the `<SkillsModule_UpdateSession_Dialog session={session} />` in the CardAction stays as-is (it already renders its own trigger).

**Leave untouched:** `sessions/page.tsx`, `sessions/[session_id]/page.tsx`, all six `sessions/[session_id]/*` sibling subpages, `sessions-list.tsx` (already renders `<SkillTrack_CreateSession_Dialog />` in its header).

### Tasks

- [ ] **Step 1:** Branch `mutation-dialogs/sessions`.
- [ ] **Step 2:** `create-session.tsx` — apply the non-destructive recipe with `parseAsStringLiteral(["create"] as const)`. Keep `<DialogTrigger>` and the `onSuccess` `router.push(route("/orgs/[slug]/skill-track/sessions/[session_id]", { slug, session_id: created.id }))`. Commit: `sessions: drive create dialog from ?action=`.
- [ ] **Step 3:** `update-session.tsx` — recipe with `["update"]`; `onSuccess` → `handleDialogOpenChange(false)` + keep the `toast.success`. Commit: `sessions: drive update dialog from ?action=`.
- [ ] **Step 4:** `delete-session.tsx` — trim `onSuccess` to `toast` + `router.push(route("/orgs/[slug]/skill-track/sessions", { slug }))`. `session-menu.tsx` — add `useQueryState(["delete"])`, `menuTriggerRef`, menu item `onClick={() => setAction("delete", { history: "push" })}`, render the dialog with param-driven props + `onCloseAutoFocus`. Commit: `sessions: drive delete dialog from ?action=`.
- [ ] **Step 5:** `npx tsc --noEmit && npm run test:run && npx eslint src/components/skill-track`.
- [ ] **Step 6: Manual verification** — on an org with the skill-track module: create (list → `?action=create` → submit → new session page), update (session detail card pencil → `?action=update` → submit → toast, stays), delete (session menu → `?action=delete` → confirm → redirect to `/skill-track/sessions`), direct-load each `?action=` URL, Back button after close, and one sibling subpage (`…/sessions/<id>/checks`) still loads.
- [ ] **Step 7:** PR `mutation-dialogs/sessions`.

---

## Phase 3: `skill-package-builder` — packages, groups, skills

**Branch:** `mutation-dialogs/skill-package-builder` (split into two PRs — `…-packages` then `…-groups-skills` — if the combined diff exceeds ~400 lines)

Nine dialogs, three entities, identical shape. `create-*` and `update-*` have their own `<DialogTrigger>` + `useState`. `delete-*` are controlled (`AlertDialogProps`) and rendered from the `*-menu.tsx` files with `useState`.

### File inventory

**Modify — create/update (non-destructive recipe, keep own trigger):**

- `src/components/skill-package-builder/create-package.tsx` — `["create"]`; `onSuccess` `router.push` to `/orgs/[slug]/skill-package-builder/packages/[package_id]` stays.
- `src/components/skill-package-builder/update-package.tsx` — `["update"]`; `onSuccess` → `handleDialogOpenChange(false)`.
- `src/components/skill-package-builder/create-group.tsx` — `["create"]`; takes `{ skillPackage }`; keeps trigger. **`onSuccess` currently calls BOTH `handleOpenChange(false)` AND `router.push(...)` — remove the `handleOpenChange(false)`**, keep only `router.push(route("/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]", { slug: organization.slug, package_id: skillPackage.id, group_id: created.id }))`.
- `src/components/skill-package-builder/update-group.tsx` — `["update"]`; `onSuccess` → `handleDialogOpenChange(false)`.
- `src/components/skill-package-builder/create-skill.tsx` — `["create"]`; takes `{ skillGroup }`; keeps trigger. **Same fix as create-group**: remove `handleOpenChange(false)` from `onSuccess`, keep only `router.push(route("/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]", { slug: organization.slug, package_id: skillGroup.skillPackageId, skill_id: created.id }))`.
- `src/components/skill-package-builder/update-skill.tsx` — `["update"]`; `onSuccess` → `handleDialogOpenChange(false)`.

**Modify — delete (trim `onSuccess`, keep controlled):**

- `src/components/skill-package-builder/delete-package.tsx` — `onSuccess` keeps `router.push(route("/orgs/[slug]/skill-package-builder", { slug }))` only.
- `src/components/skill-package-builder/delete-group.tsx` — keeps `router.push(route("/orgs/[slug]/skill-package-builder/packages/[package_id]", { slug, package_id }))` only.
- `src/components/skill-package-builder/delete-skill.tsx` — keeps its list/parent redirect only.

**Modify — menus (add `useQueryState(["delete"])`, `menuTriggerRef`, param-driven dialog props, `onCloseAutoFocus`):**

- `src/components/skill-package-builder/package-menu.tsx`
- `src/components/skill-package-builder/group-menu.tsx`
- `src/components/skill-package-builder/skill-menu.tsx`

**Leave untouched:** `packages-list.tsx` (renders `<SkillPackageBuilder_CreatePackage_Dialog />`), `package-content.tsx` / `group-content.tsx` / `skill-content.tsx` (render `<…Update…_Dialog x={x} />` in CardActions — trigger is internal), `package-contents.tsx` / `group-contents.tsx` (render `<…Create…_Dialog x={x} />` + the wave-2 reorder dialogs — leave the reorder `useState` alone), all `page.tsx` and route files, `move-skill.tsx` / `reorder-*.tsx` (wave 2).

**⚠ `skill-menu.tsx` also has a `moveDialogOpen` `useState`** for `<SkillPackageBuilder_MoveSkill_Dialog>` — that is wave 2. Leave it. Only convert the `deleteDialogOpen` one.

### Tasks

- [ ] **Step 1:** Branch.
- [ ] **Step 2:** `create-package.tsx` + `update-package.tsx` + `delete-package.tsx` + `package-menu.tsx` per recipe. Commit: `skill-package-builder: drive package dialogs from ?action=`.
- [ ] **Step 3:** `create-group.tsx` + `update-group.tsx` + `delete-group.tsx` + `group-menu.tsx`. Commit: `skill-package-builder: drive group dialogs from ?action=`.
- [ ] **Step 4:** `create-skill.tsx` + `update-skill.tsx` + `delete-skill.tsx` + `skill-menu.tsx` (delete only — leave `moveDialogOpen`). Commit: `skill-package-builder: drive skill dialogs from ?action=`.
- [ ] **Step 5:** `npx tsc --noEmit && npm run test:run && npx eslint src/components/skill-package-builder`.
- [ ] **Step 6: Manual verification** — on an org with the skill-package-builder module: for each of package / group / skill: create (from the list or `…-contents` "add" button → `?action=create` → submit), update (content CardAction pencil → `?action=update` → submit → toast, stays), delete (`…-menu` → `?action=delete` → confirm → redirect to parent). Direct-load a `?action=` URL at each of the three nesting depths. Confirm the **Move** menu item on a skill still opens its (unchanged, `useState`-driven) dialog. Confirm archive/restore/publish menu items still fire (wave 2 — unchanged).
- [ ] **Step 7:** PR(s).

---

## Phase 4: `i3/templates` — template create/update/delete

**Branch:** `mutation-dialogs/i3-templates`

Dialogs are co-located under `src/app/(authenticated)/orgs/[slug]/i3/templates/`. `create-template.tsx` and `[template_id]/update-template.tsx` have their own `<DialogTrigger>` + `useState`. `[template_id]/delete-template.tsx` is controlled (`AlertDialogProps`). The list page and the client detail page are **not** modified (spec: no extraction).

### File inventory

**Modify:**

- `src/app/(authenticated)/orgs/[slug]/i3/templates/create-template.tsx` — `useState` → `useQueryState(["create"])`; keep trigger; `onSuccess` `router.push` to `/orgs/[slug]/i3/templates/[template_id]` stays; leave the manual `queryClient.invalidateQueries` untouched.
- `src/app/(authenticated)/orgs/[slug]/i3/templates/[template_id]/update-template.tsx` — `useState` → `useQueryState(["update"])`; keep `{ template }` + trigger; `onSuccess` → `handleDialogOpenChange(false)` (keep the `queryClient.invalidateQueries` and the `toast`).
- `src/app/(authenticated)/orgs/[slug]/i3/templates/[template_id]/delete-template.tsx` — controlled; `onSuccess` keeps `router.push(route("/orgs/[slug]/i3/templates", { slug }))` only.
- `src/app/(authenticated)/orgs/[slug]/i3/templates/[template_id]/template-menu.tsx` — `useState` → `useQueryState(["delete"])`; menu item `onClick`; param-driven dialog props + `onCloseAutoFocus` + `menuTriggerRef`.

**Leave untouched:** `templates/page.tsx` (renders `<I3Module_CreateTemplate_Dialog />` in its header), `templates-list.tsx`, `[template_id]/page.tsx` (client, `useI3Template` — the param hook lives in the dialog components, not the page), `[template_id]/template-variants.tsx` + `add-variant.tsx` / `update-variant.tsx` / `delete-variant.tsx` (wave 2).

### Tasks

- [ ] **Step 1:** Branch.
- [ ] **Step 2:** `create-template.tsx` per recipe. Commit: `i3/templates: drive create dialog from ?action=`.
- [ ] **Step 3:** `update-template.tsx` per recipe; `onSuccess` → `handleDialogOpenChange(false)`. Commit: `i3/templates: drive update dialog from ?action=`.
- [ ] **Step 4:** `delete-template.tsx` `onSuccess` trim + `template-menu.tsx` wiring. Commit: `i3/templates: drive delete dialog from ?action=`.
- [ ] **Step 5:** `npx tsc --noEmit && npm run test:run && npx eslint "src/app/(authenticated)/orgs/[slug]/i3/templates"`.
- [ ] **Step 6: Manual verification** — on an org with the i3 module: create (templates list → `?action=create` → submit → new template page), update (template detail card pencil → `?action=update` → submit → toast, stays), delete (template menu → `?action=delete` → confirm → redirect to `/i3/templates`), direct-load each, Back button. Confirm the variants section (Add/edit/delete variant) still works via its existing `useState` dialogs (wave 2, unchanged).
- [ ] **Step 7:** PR.

---

## Phase 5: `admin/users` — update, delete (link/unlink are wave 2)

**Branch:** `mutation-dialogs/users`

The detail page `[user_id]/page.tsx` is a client component with three `useState` flags: `deleteDialogOpen`, `linkPersonDialogOpen`, `unlinkPersonDialogOpen`. Convert **only `deleteDialogOpen`** and the internal `useState` in `update-user.tsx`. Leave `linkPersonDialogOpen` / `unlinkPersonDialogOpen` as `useState` (wave 2 phase 10). Mixed `useState` + `?action=` on one page is fine.

### File inventory

**Modify:**

- `src/components/admin/users/update-user.tsx` — `useState` → `useQueryState(["update"])`; keeps `{ organizationUser }` (check its exact prop name) + its own `<DialogTrigger>`; it uses `authClient` + manual invalidate — leave that; `onSuccess` → `handleDialogOpenChange(false)`.
- `src/components/admin/users/delete-user.tsx` — controlled (`AlertDialogProps & { organizationUser, onSuccess? }`); in `onSuccess`, **remove** `props.onOpenChange?.(false)` and `mutation.reset()`; keep `toast`, keep `router.push(route("/orgs/[slug]/admin/users", { slug }))`, keep `await queryClient.invalidateQueries({ queryKey: ["auth", "organization-users", organization.id] })`.
- `src/app/(authenticated)/orgs/[slug]/admin/users/[user_id]/page.tsx` — remove `const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)`; add `const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update", "delete"] as const))` (this page hosts both the update trigger indirectly and the delete dialog — but `update-user` owns its own `["update"]` hook, so the page only needs `["delete"]`; use `parseAsStringLiteral(["delete"] as const)`). The menu/button that set `setDeleteDialogOpen(true)` → `setAction("delete", { history: "push" })`. `<AdminModule_DeleteUser_Dialog open={action === "delete"} onOpenChange={(open) => setAction(open ? "delete" : null, { history: open ? "push" : "replace" })} … />` + `onCloseAutoFocus` on a stable element (the dropdown trigger button — add a `ref`).

**Leave untouched:** `users/page.tsx`, `users-list.tsx`, `link-person.tsx`, `unlink-person.tsx`, and their `useState` in the detail page.

### Tasks

- [ ] **Step 1:** Branch. Read `[user_id]/page.tsx` in full first — it is ~240 lines and hosts the dropdown menu inline; note where `setDeleteDialogOpen` is called and what element should receive focus on close.
- [ ] **Step 2:** `update-user.tsx` per recipe (`["update"]`). `onSuccess` → `handleDialogOpenChange(false)`. Commit: `users: drive update dialog from ?action=`.
- [ ] **Step 3:** `delete-user.tsx` `onSuccess` trim + `[user_id]/page.tsx` wiring (`["delete"]` param, menu `onClick`, dialog props, `onCloseAutoFocus` + trigger `ref`). Keep `linkPerson` / `unlinkPerson` `useState` exactly as they are. Commit: `users: drive delete dialog from ?action=`.
- [ ] **Step 4:** `npx tsc --noEmit && npm run test:run && npx eslint src/components/admin/users "src/app/(authenticated)/orgs/[slug]/admin/users"`.
- [ ] **Step 5: Manual verification** — on an org: user detail page → edit → `?action=update` → submit → toast, stays; user menu → **Delete** → `?action=delete` → confirm → redirect to `/admin/users`, user gone; direct-load `…/<userId>?action=update` and `?action=delete`; Back button after close. Confirm **Link person** / **Unlink person** still open via their `useState` (unchanged).
- [ ] **Step 6:** PR.

---

## Phase 6: `admin/invitations` — create invitation

**Branch:** `mutation-dialogs/invitations`

Smallest phase. One dialog, list-only, no detail page. `create-invitation.tsx` uses `authClient.organization.inviteMember` + manual `queryClient.invalidateQueries` — leave that. It has its own `<DialogTrigger>`.

### File inventory

**Modify:**

- `src/components/admin/invitations/create-invitation.tsx` — `const [open, setOpen] = useState(false)` → `const [action, setAction] = useQueryState("action", parseAsStringLiteral(["create"] as const))` + `const open = action === "create"`. `handleOpenChange`: open → `setAction("create", { history: "push" })`; close → `form.reset()` + `setAction(null, { history: "replace" })` (this component has no `mutation.reset()` today — add it for consistency, or leave; keeping parity with the file, add `mutation.reset()`). `onSuccess` currently calls `handleOpenChange(false)` after a successful invite — that stays (no navigation, so no race). Keep the `<DialogTrigger>`.

**Leave untouched:** `invitations/page.tsx`, `invitations-list.tsx` (renders `<AdminModule_CreateInvitation_Dialog />` in its header; the `InvitationActions` resend/revoke menu items are direct mutations, not dialogs — out of scope).

### Tasks

- [ ] **Step 1:** Branch.
- [ ] **Step 2:** Convert `create-invitation.tsx` per the non-destructive recipe. Note: `onSuccess` keeps `handleOpenChange(false)` (an invite does not navigate). Commit: `invitations: drive create dialog from ?action=`.
- [ ] **Step 3:** `npx tsc --noEmit && npm run test:run && npx eslint src/components/admin/invitations`.
- [ ] **Step 4: Manual verification** — `/orgs/<slug>/admin/invitations` → **New Invitation** → `?action=create` → fill email + role → **Send Invitation** → toast, dialog closes (param cleared), invitation appears in the list. Direct-load `…/invitations?action=create` → opens. Cancel → param cleared, focus back on the New Invitation button. Back button after close does not reopen.
- [ ] **Step 5:** PR.

---

## Self-review notes

- **Spec coverage:** wave-1 rows (teams re-convert, sessions, spb packages/groups/skills, i3 templates, users update/delete, invitations) each map to a phase above. Wave-2 rows are explicitly deferred and out of this plan.
- **`onCloseAutoFocus` mechanism:** the plan uses two variants — (a) `onCloseAutoFocus={(e) => e.preventDefault()}` on the dialog content + an explicit `ref.current?.focus()` in the menu's `onOpenChange(false)` branch, or (b) passing a handler down. Phase 1 Step 10 picks (a); reuse (a) for every menu-triggered delete. If a `*-menu` component's trigger button is not easily ref-able, falling back to `onCloseAutoFocus={(e) => e.preventDefault()}` alone (focus goes nowhere, but does not crash) is acceptable and noted as a known minor gap in the PR.
- **`create-*` `onSuccess` navigation targets** (all read from source): teams → `/orgs/[slug]/admin/teams/[team_id]`; sessions → `/orgs/[slug]/skill-track/sessions/[session_id]`; package → `/orgs/[slug]/skill-package-builder/packages/[package_id]`; group → `/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]`; skill → `/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]`; template → `/orgs/[slug]/i3/templates/[template_id]`.
- **Race bug already present in `create-group` / `create-skill`** (`handleOpenChange(false)` + `router.push` in one `onSuccess`) — the plan fixes these as part of the conversion. Every other `create-*` already does `router.push` only.
- **No new types or shared helpers** are introduced; every task is a local transform of one or two files following `mutation-dialog.md`.
