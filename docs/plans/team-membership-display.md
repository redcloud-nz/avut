# Implementation plan: Team membership display

Implements [`docs/specs/team-membership-display.md`](../specs/team-membership-display.md).

**Branch:** worktree `team-membership-display` (branch
`worktree-team-membership-display`), based on `worktree-d4h-linking`.

**DB:** no migration. The D4H sidecar models (`TeamMembership_D4H`, `Team_D4H`,
membership `status`) all already exist on the base branch. This work is code-only
— shared `avut` is fine, no `db:branch`.

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

## Commit breakdown

1. `feat(teams): listTeamMemberships returns d4h snapshot, email, ordered by name` (Step 1 + tests)
2. `feat(d4h): formatD4HMemberStatus + status badge` (Step 2)
3. `feat(teams): membership source badge` (Step 3)
4. `feat(teams): rebuild team roster on Kaga with D4H columns` (Step 4)
5. `feat(teams): richer team memberships card on the person page` (Step 5)

Steps 2–3 can fold into 4 if kept small. Keep 1 separate — it is the only change
touching the API surface and its tests.
