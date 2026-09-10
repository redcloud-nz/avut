# Implementation plan: Team membership display

Implements [`docs/specs/team-membership-display.md`](../specs/team-membership-display.md).

**Branch:** worktree `team-membership-display` (branch
`worktree-team-membership-display`), based on `worktree-d4h-linking`.

**DB:** no migration. The D4H sidecar models (`TeamMembership_D4H`, `Team_D4H`,
membership `status`) all already exist on the base branch. This work is code-only
— shared `avut` is fine, no `db:branch`.

**Two phases:**

- **Phase 1 (Steps 1–6)** — the list surfaces (roster page + person Teams card).
  **Implemented** (commits `765577c` … `50d63aa`). The step text below is the
  original plan; "Post-review adjustments" records where the build diverged.
- **Phase 2 (Steps 7–12)** — the team-membership detail page (spec §8). **Not
  started.**

---

## What the base branch already gives us (spec deltas)

Checked against `worktree-d4h-linking` HEAD — several spec assumptions are already
real, and a few are slightly different:

- **`D4HMemberStatus` enum already exists** — `src/lib/schemas/d4h/member.ts`
  (`D4HMemberStatus.values` / `.schema`). Only the formatter + badge are new.
- **A `d4h` sub-object on `TeamMembershipData` already exists** —
  `{ d4hMemberId, d4hStatus: z.string(), d4hPosition, d4hRef, d4hRoleId }`.
  Note `d4hStatus` is a raw string, and there is **no per-membership
  `lastSyncedAt`**.
- **`listTeamMemberships` output already types `d4h`** — the schema spreads
  `TeamMembershipData.schema`, so `d4h` is in the type; but the query does not
  `include: { d4h: true }`, so it is always `null` at runtime.
- **Source-badge "last synced" time is team-level** — use `team.d4h.lastSyncedAt`
  (`Team_D4H.lastSyncedAt`); there is no membership-level sync timestamp.
- **`TeamMembership.status` is now real** — `RecordStatus`
  (`Active` / `Archived` / `Deleted`). D4H sync **archives** a membership when the
  member drops out of the `OPERATIONAL` / `NON_OPERATIONAL` fetch set, so the
  roster must account for archived rows.

Net: the model/schema layer is mostly done. The work is the query tweak, two
small display helpers, and the two UI rewrites.

---

## Post-review adjustments (applied)

Terminology / columns feedback folded into the roster after the first build:

- **Column headers:** "Position" → **"D4H Position"**, "Status" → **"D4H
  Status"** (the D4H snapshot fields are always qualified). The
  `TeamMembership.status` column, first labelled "Membership", is now **"Status"**
  — bare "Status" matches every other admin table's `RecordStatus` column.
- **No "Joined" column.** `createdAt` is the AVUT row-creation time and reads as
  a D4H join date — dropped, along with the `formatDateTime`/`formatRelativeDateTime`
  imports.
- The actions column is `enableHiding: false` so its empty header doesn't show as
  a blank row in the column-visibility menu.
- D4H position renders `—` for empty-string values, not only `null`.

---

## Step 1 — `teams.listTeamMemberships` (query only)

`src/trpc/routers/teams-router.ts`, `listTeamMemberships`:

1. Add `d4h: true` to the `include`.
2. Add `email: true` to the `person` `select`.
3. Add `orderBy: { person: { name: "asc" } }`.
4. Output schema: change `person` pick from `{ id, name }` to
   `{ id, name, email }`. `d4h` is already covered by the `TeamMembershipData.schema`
   spread — but double-check `TeamMembershipData.fromRecord` maps it (it does, when
   `record.d4h` is present).
5. Leave the `d4hStatus: z.string()` shape as-is. Do **not** tighten to the enum —
   sync stores the raw D4H value verbatim and a future D4H status would blow up the
   parse. The formatter (Step 2) tolerates unknown values.

No permission change (`{ team: ["view"] }`).

**Downstream `.sort()` removal:**

- `src/components/admin/teams/team-personnel-content.tsx` — `.sort()` goes away in
  the rewrite (Step 4).
- `src/components/admin/teams/add-team-member.tsx` line ~58 — drop
  `.sort((a, b) => a.name.localeCompare(b.name))` on the personnel list? That is
  `listPersonnel`, not memberships — **leave it**. The membership list there
  (`teamMemberships`) is only used for `assignedIds`; order irrelevant. No change.
- `src/components/admin/teams/team-links.tsx` — uses `.length` only. No change.
- `src/lib/collections/team-memberships.ts` — schema is
  `TeamMembershipData.schema.omit({ id, organizationId })`, which already includes
  `d4h`. No change; it does not read the field.

**Tests** — `src/trpc/routers/teams-router.test.ts`:

- `listTeamMemberships` returns rows ordered by person name.
- a membership with a `TeamMembership_D4H` row comes back with a populated `d4h`;
  one without comes back `d4h: null`.
- `person.email` is present.

---

## Step 2 — D4H member-status formatting

`src/lib/schemas/d4h/member.ts` — add next to `D4HMemberStatus`:

```ts
export function formatD4HMemberStatus(status: string): string {
  switch (status) {
    case "OPERATIONAL":
      return "Operational";
    case "NON_OPERATIONAL":
      return "Non-operational";
    case "OBSERVER":
      return "Observer";
    case "RETIRED":
      return "Retired";
    default:
      return status; // tolerate an unknown future D4H value
  }
}
```

Remove the commented-out `toTeamMembershipStatus` / `MemberStatusType` block
above `D4HMember` while here.

`src/components/admin/teams/d4h-member-status-badge.tsx` _(new)_ — thin wrapper
over `components/ui/badge`:

```tsx
export function D4HMemberStatusBadge({ status }: { status: string }) {
  // OPERATIONAL → default/success · NON_OPERATIONAL → secondary
  // OBSERVER → outline · RETIRED → outline muted · unknown → outline
}
```

Check `components/ui/badge.tsx` for the available `variant`s; if there is no
success-toned variant, use `default` for `OPERATIONAL` and a `className` tint.

---

## Step 3 — `<MembershipSourceBadge>`

`src/components/admin/teams/membership-source-badge.tsx` _(new)_.

Props: `{ membership: TeamMembershipRow; teamIsD4HLinked: boolean; lastSyncedAt?: string | null }`
where `TeamMembershipRow` is the `listTeamMemberships` element type (export it
from the router or a shared type — see if `teams-router` already exports a row
type; if not, add `export type TeamMembershipListItem = ...`).

- `membership.d4h != null` → `<Badge variant="outline">D4H</Badge>` with a
  `title` / tooltip: `"Managed by D4H sync"` + (`lastSyncedAt` ? `" — last synced ${formatRelativeDateTime(lastSyncedAt)}"` : `""`).
- `membership.d4h == null && teamIsD4HLinked` → `<Badge variant="outline">Manual</Badge>`,
  tooltip `"Added in AVUT — not affected by D4H sync"`.
- else → `return null`.

Use the app's existing tooltip primitive (`components/ui/tooltip`) if these lists
already use it; otherwise a plain `title` attr is acceptable for v1 — match what
`team-links.tsx` / neighbouring cards do.

---

## Step 4 — Team roster page rewrite

`src/components/admin/teams/team-personnel-content.tsx` — rewrite on `Kaga`,
following `src/components/admin/personnel/personnel-list.tsx` as the reference
pattern (`useReactTable`, `Kaga.defineColumns`, `Kaga.filterFns.oneOf`,
`Kaga.TableToolbar/Table/TablePagination`, `Kaga.DEFAULT_PAGE_SIZE`).

Keep: the `Std.Navbar` breadcrumbs, `useSuspenseQueries` for `getTeam` +
`listTeamMemberships`, the `?action=remove-member` / `?memberId=` nuqs wiring, and
`AdminModule_RemoveTeamMember_Dialog` / `AdminModule_AddTeamMember_Dialog`.

**Delete:** the parked `SyncD4HTeamDialog` at the bottom of the file and its
now-unused imports (`useMutation`, `Dialog*`, `MutationButton`, `toast`,
`ComponentProps`).

### Row type

```ts
type RowData = (typeof teamMembers)[number]; // listTeamMemberships element
const teamIsD4HLinked = team.d4h != null;
```

### Columns (built conditionally)

```ts
const columns = useMemo(() => Kaga.defineColumns<RowData>((col) => [
  // Name — link to person page, email as muted sub-line
  col.accessor((r) => r.person.name, {
    id: "name", header: "Name",
    cell: (ctx) => (
      <Link href={route("/orgs/[slug]/admin/personnel/[person_id]", {
        slug: organization.slug, person_id: ctx.row.original.person.id })}>
        <div>{ctx.row.original.person.name}</div>
        <div className="text-muted-foreground text-xs">{ctx.row.original.person.email}</div>
      </Link>
    ),
    enableGlobalFilter: true, enableSorting: true, enableColumnFilter: false,
  }),

  ...(teamIsD4HLinked ? [
    col.accessor((r) => r.d4h?.d4hPosition ?? "", {
      id: "position", header: "Position",
      cell: (ctx) => ctx.row.original.d4h?.d4hPosition ?? "—",
      enableSorting: true, enableColumnFilter: false, enableGlobalFilter: false,
    }),
    col.accessor((r) => r.d4h?.d4hStatus ?? "", {
      id: "status", header: "Status",
      cell: (ctx) => ctx.row.original.d4h
        ? <D4HMemberStatusBadge status={ctx.row.original.d4h.d4hStatus} /> : "—",
      enableColumnFilter: true, enableSorting: false, enableGlobalFilter: false,
      filterFn: Kaga.filterFns.oneOf,
      meta: { columnOptions: D4HMemberStatus.values.map((v) => ({
        label: formatD4HMemberStatus(v), value: v })) },
    }),
    col.display({
      id: "source", header: "Source",
      cell: (ctx) => <MembershipSourceBadge membership={ctx.row.original}
        teamIsD4HLinked lastSyncedAt={team.d4h?.lastSyncedAt} />,
    }),
  ] : []),

  // Membership status (Active / Archived) — only meaningful on a D4H team,
  // but harmless everywhere. Show it only when linked (sync is the only writer).
  ...(teamIsD4HLinked ? [
    col.accessor("status", {
      id: "recordStatus", header: "Membership",
      cell: (ctx) => ctx.getValue(),
      enableColumnFilter: true, enableSorting: false, enableGlobalFilter: false,
      filterFn: Kaga.filterFns.oneOf,
      meta: { columnOptions: [
        { label: "Active", value: "Active" }, { label: "Archived", value: "Archived" }] },
    }),
  ] : []),

  // Joined
  col.accessor("createdAt", {
    header: "Joined",
    cell: (ctx) => <span title={formatDateTime(ctx.getValue())}>
      {formatRelativeDateTime(ctx.getValue())}</span>,
    enableSorting: true, enableColumnFilter: false, enableGlobalFilter: false,
  }),

  // Actions — unchanged remove button
  col.display({
    id: "actions",
    cell: (ctx) => (
      <Protect permissions={{ team: ["update"] }}>
        <Button variant="ghost" size="icon"
          onClick={() => openRemoveMember(ctx.row.original.personId)}>
          <ObjectIcons.Delete />
        </Button>
      </Protect>
    ),
  }),
]), [organization.slug, teamIsD4HLinked, team.d4h?.lastSyncedAt]);
```

### Table state

```ts
initialState: {
  columnFilters: teamIsD4HLinked ? [{ id: "recordStatus", value: ["Active"] }] : [],
  pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
  sorting: [{ id: "name", desc: false }],
}
```

### Empty state

`Kaga.Table` — check whether it renders its own "no rows" state (personnel-list
relies on it). If it does, that is enough for v1. If a custom message is wanted:
`team.d4h != null && teamMembers.length === 0` → hint text pointing at the D4H
card's Sync action on the team detail page; otherwise a plain "No one is on this
team yet." with the New Member button. Keep this minimal — do not build a bespoke
empty-state component if Kaga already covers it.

---

## Step 5 — Person page "Teams" card

`src/components/admin/personnel/team-memberships.tsx` — keep the `Card` + `Item`
structure and the per-team `Link` to the team page. Changes:

1. **Sort** by team name: `[...teamMemberships].sort((a, b) => a.team.name.localeCompare(b.team.name))`
   (copy first — even though this is already this person's slice, `useSuspenseQuery`
   data must not be mutated).
2. **Header count:** `CardTitle` → `Teams{n > 0 ? ` (${n})` : ""}` (muted count).
3. **Secondary line** per row, only when `membership.d4h != null`:
   `<ItemDescription>{formatD4HMemberStatus(membership.d4h.d4hStatus)}{membership.d4h.d4hPosition ? ` · ${membership.d4h.d4hPosition}` : ""}</ItemDescription>`.
4. **Source badge:** render `<MembershipSourceBadge membership={membership} teamIsD4HLinked={false} />`
   in `ItemActions` before the `ItemLinkActionIcon`. Passing `teamIsD4HLinked={false}`
   means only the positive "D4H" badge shows here (no "Manual" — there is no team
   context on this card to contrast against). It needs the team's `lastSyncedAt`;
   `listTeamMemberships` does not return `team.d4h`, so either:
   - drop the "last synced" clause on this surface (pass no `lastSyncedAt`), **or**
   - widen the `team` pick in `listTeamMemberships` to include a `d4hLastSyncedAt`.

   Prefer the first — the person card does not need sync timing.

5. **Empty state:** `n === 0` → `<CardContent>` shows a muted small
   "Not a member of any team." instead of an empty card body.

---

## Step 6 — verification

- `npx tsc --noEmit` clean.
- `npm run lint` clean (watch for unused imports after the `SyncD4HTeamDialog` deletion).
- `npm run test:run src/trpc/routers/teams-router.test.ts`.
- Browser (`test-in-browser` skill, dev server on `:3100`):
  - **Non-D4H team roster** — no Position/Status/Source/Membership columns; name +
    email + Joined only; add/remove still work.
  - **D4H-linked team roster** — D4H columns present; status badges; Manual badge
    on a manually-added member; Archived members hidden until the Membership filter
    is changed; status faceted filter works.
  - **Person page** — team list sorted by team name; count in the title; D4H
    secondary line + badge on a synced membership; empty state for a person on no
    teams.
- `npx eslint` note: `personnel-list.tsx` carries a
  `react-hooks/incompatible-library` disable on `useReactTable` — reuse the same
  comment in the roster rewrite.

---

## Commit breakdown (Phase 1)

1. `feat(teams): listTeamMemberships returns d4h snapshot, email, ordered by name` (Step 1 + tests)
2. `feat(d4h): formatD4HMemberStatus + status badge` (Step 2)
3. `feat(teams): membership source badge` (Step 3)
4. `feat(teams): rebuild team roster on Kaga with D4H columns` (Step 4)
5. `feat(teams): richer team memberships card on the person page` (Step 5)

Steps 2–3 can fold into 4 if kept small. Keep 1 separate — it is the only change
touching the API surface and its tests.

---

# Phase 2 — Team-membership detail page

Implements spec §8. Route `A`:
`/orgs/[slug]/admin/teams/[team_id]/personnel/[person_id]`. v1 scope: D4H
drill-down, a deep-link target, and the Remove action. **Deferred:** editable
`tags` / `properties`, and the Activity feed (no log-entry read path exists yet).

## What the base branch already gives us

- `TeamMembershipData.d4h` **already carries `d4hRef` and `d4hRoleId`** — the
  roster just doesn't render them. So the membership page needs **no schema
  change** for the D4H card; `getTeamMembership` returns the same row shape as a
  `listTeamMemberships` element.
- `AdminModule_RemoveTeamMember_Dialog`
  (`src/components/admin/teams/remove-team-member.tsx`) already takes
  `{ organizationId, team, person, ...AlertDialog }` and fires
  `deleteTeamMembership` with `teamsEffects.deleteTeamMembership`. Reused as-is —
  just mounted on a different page.
- `AdminModule_TeamMenu` (`src/components/admin/teams/team-menu.tsx`) and
  `AdminModule_PersonMenu` are the pattern for the `⋯` actions menu.

## Step 7 — `teams.getTeamMembership` (new query)

`src/trpc/routers/teams-router.ts`, alphabetical — directly after `getTeam`.

- `organizationProcedure({ team: ["view"] })`, input `{ teamId, personId }`.
- `findUnique` on `teamId_personId`, scoped to `organizationId`, with the same
  `include` as `listTeamMemberships` (`d4h`, `team {id,name}`, `person
{id,name,email}`).
- Output: the `listTeamMemberships` row schema (reuse it — extract a shared
  `const teamMembershipRowSchema` in the router if it isn't one already).
- `throw new TRPCError({ code: "NOT_FOUND", message: Messages.teamMembershipNotFound({ teamId, personId }) })`
  when absent (that message helper already exists — it's used by
  `deleteTeamMembership`).

The team's `lastSyncedAt` for the D4H card comes from a parallel `getTeam` query
on the page (same as the roster), **not** from this procedure.

**Tests** (`teams-router.test.ts`, new `describe`): returns the row with `d4h`
populated / `null`; `NOT_FOUND` for a non-member pair; org-scoped (a membership in
another org is `NOT_FOUND`).

## Step 8 — the page

`src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/personnel/[person_id]/page.tsx`
\+ `src/components/admin/teams/team-membership-content.tsx`, per
`docs/patterns/detail-page-data-fetching.md`.

- `page.tsx` — `requireOrganization`, parse `TeamId` / `PersonId`, `prefetch`
  `getTeam` + `getTeamMembership`, `generateMetadata` titled
  `{person.name} — {team.name}`.
- **Run `npx next typegen`** after creating the file — `route()` for the new path
  won't typecheck until then (and `rm -rf .next/dev/types && npx next typegen` if
  the dev server's types went stale, per AGENTS).
- `team-membership-content.tsx` — `useSuspenseQueries([getTeam, getTeamMembership])`,
  `Std.Navbar` breadcrumbs (Admin › Teams › _team_ › Personnel › _person_),
  `Saratoga.Root` / `Saratoga.Header` (title `person.name`, `Saratoga.Actions` →
  `<AdminModule_TeamMembershipMenu>`), `Saratoga.Columns`:

  | Card              | Slot        | Content                                                                                                                                                                                         |
  | ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Details           | `main`      | `DL`: joined (`createdAt` via `DLDateDetails`), Status (`membership.status`)                                                                                                                    |
  | D4H integration   | `main`      | shown when `membership.d4h`: member id, `<D4HMemberStatusBadge>`, position, ref, role id, team `lastSyncedAt`; `Item`/link → `route("/orgs/[slug]/d4h-views/members/[team_id]/[member_id]", …)` |
  | Related           | `secondary` | `Item` links → person page, → team page, → team roster                                                                                                                                          |
  | created / updated | `secondary` | `DLDateDetails` for `createdAt` / `updatedAt` — copy from `person-content.tsx`                                                                                                                  |

## Step 9 — `AdminModule_TeamMembershipMenu` + relocate Remove

`src/components/admin/teams/team-membership-menu.tsx` _(new)_ — model on
`team-menu.tsx`:

- `DropdownMenu` with a `DropdownMenuTriggerIcon` trigger.
- One item for now: **Remove from team**, wrapped in
  `<Protect permissions={{ team: ["update"] }}>`, `onSelect` opens
  `?action=remove` (nuqs `parseAsStringLiteral(["remove"])`, `history: "push"`).

In `team-membership-content.tsx`: the `?action` state, and mount
`AdminModule_RemoveTeamMember_Dialog` with `person={membership.person}`,
`team={team}`, `open={action === "remove"}`. `onSuccess` (add an `onOpenChange`
that, on close-after-success, does) `router.push(route("/orgs/[slug]/admin/teams/[team_id]/personnel", …))` —
the membership no longer exists, so stay is not an option. Simplest: pass an
`onRemoved` callback into the dialog, or watch the mutation status. Check how
`remove-team-member.tsx`'s `onSuccess` is structured — it currently calls
`props.onOpenChange?.(false)`; add the redirect in the page's `onOpenChange`
handler when it was a successful close, or give the dialog an explicit
`onRemoved` prop (cleaner — one-line change to the dialog).

## Step 10 — roster actions column → chevron link

`src/components/admin/teams/team-personnel-content.tsx`:

- Replace the `actions` display column cell (currently the `Protect` + ghost
  delete `Button`) with a right-chevron **link**:

  ```tsx
  col.display({
    id: "actions",
    header: "",
    cell: (ctx) => (
      <Link
        href={route("/orgs/[slug]/admin/teams/[team_id]/personnel/[person_id]", {
          slug: organization.slug,
          team_id: teamId,
          person_id: ctx.row.original.person.id,
        })}
        className="flex justify-center text-muted-foreground hover:text-foreground"
        aria-label="View membership"
      >
        <ChevronRightIcon className="size-4" />
      </Link>
    ),
    enableHiding: false,
    meta: { cellProps: { className: "w-9 p-0" } },
  }),
  ```

  (`ChevronRightIcon` from `lucide-react`; check `@/components/icons` first for a
  named export.)

- **Delete** from this file: the `?action` / `?memberId` `useQueryState` calls,
  `activeMember`, `openRemoveMember`, `closeRemoveMember`, the
  `<AdminModule_RemoveTeamMember_Dialog>` mount, and the
  `AdminModule_RemoveTeamMember_Dialog` / `parseAsString` / `parseAsStringLiteral`
  / `ObjectIcons` / `Button` imports if now unused. `useMemo` deps for `columns`
  lose `openRemoveMember` (drop the `exhaustive-deps` disable if it's no longer
  needed).
- `AdminModule_AddTeamMember_Dialog` stays.

## Step 11 — person card retargets to the membership page

`src/components/admin/personnel/team-memberships.tsx` — the row `<Link href>`
changes from
`route("/orgs/[slug]/admin/teams/[team_id]", { slug, team_id })` to
`route("/orgs/[slug]/admin/teams/[team_id]/personnel/[person_id]", { slug, team_id: membership.teamId, person_id: personId })`
(`personId` is the component prop). Everything else on the card is unchanged.

## Step 12 — verification

- `npx next typegen`, `npx tsc --noEmit`, `npm run lint`, `npm run test:run`.
- Browser (`test-in-browser`, dev server against `avut_d4h_linking`):
  - roster chevron → membership page; breadcrumbs correct.
  - membership page on a **D4H-linked** team — D4H card with ref / role id / last
    synced, link to the D4H member view resolves.
  - membership page on a **plain** team — no D4H card.
  - **Remove from team** from the `⋯` menu → confirms → redirects to the roster,
    row gone.
  - person page Teams card row → membership page (not the team page).
  - as a `member` (no `team:["update"]`): page loads, chevron works, `⋯` menu
    has no Remove item.

## Commit breakdown (Phase 2)

6. `feat(teams): getTeamMembership query` (Step 7 + tests)
7. `feat(teams): team-membership detail page` (Steps 8–9)
8. `refactor(teams): roster row links to the membership page; move Remove there` (Steps 10–11)
