# Spec: Team membership display

**Date:** 2026-09-10
**Status:** Draft
**Supersedes:** the ad-hoc membership rendering in
`src/components/admin/teams/team-personnel-content.tsx` and
`src/components/admin/personnel/team-memberships.tsx`.

How AVUT presents team membership.

- **Phase 1 (§§3–7)** — the two list surfaces: the **team roster page**
  (`/orgs/[slug]/admin/teams/[team_id]/personnel`) and the **Teams card** on the
  person detail page (`/orgs/[slug]/admin/personnel/[person_id]`).
- **Phase 2 (§8)** — a dedicated **team-membership detail page** for one
  person's membership of one team, at
  `/orgs/[slug]/admin/teams/[team_id]/personnel/[person_id]`.

This spec is about display. It does **not** add a native "role within team"
concept — the only role/position/status data shown is D4H's, surfaced read-only
and only when the team (or the specific membership) is D4H-linked.

**Dependency:** this builds on `docs/specs/d4h-linking.md` landing first. It
assumes:

- `TeamMembership_D4H` exists (spec §3.3): `d4hMemberId`, `d4hStatus`,
  `d4hPosition`, `d4hRef`, `d4hRoleId`, `d4hLastSyncedAt`. Its **presence marks a
  membership as D4H-managed**; its absence means the membership was added
  manually and sync never touches it.
- `TeamData.d4h` is non-null exactly when the team is D4H-linked (`Team_D4H`
  row present).
- `TeamMembershipData` has gained a nullable `d4h` sub-object (d4h-linking spec
  §10 item 4).

---

## 1. Problems with what exists today

### 1.1 Team roster page (`team-personnel-content.tsx`)

- A hand-rolled `<Table>` with two columns: person name and a remove button.
  No use of the `Kaga` data-table block that every other roster/list in the app
  uses — so no column sorting, no text filter, no pagination, no empty state.
- Sorted client-side in render (`teamMembers.sort(...)` — mutates the query
  cache array in place, a latent bug).
- Nothing about the membership itself is shown: not when the person joined, not
  their D4H position/status on a linked team, not whether the row is D4H-managed
  or manual.
- A dead `SyncD4HTeamDialog` is parked at the bottom of the file
  (`eslint-disable no-unused-vars`).

### 1.2 Teams card (`team-memberships.tsx`)

- A bare list of team-name links. No secondary information, no membership
  status, no indication that a membership comes from D4H.
- No empty state — a person on no teams renders an empty card with just the
  "Teams" title.
- `Card` + `Item` layout is fine; the content is the gap.

### 1.3 Shared API gap

`teams.listTeamMemberships` returns `team` and `person` as `{ id, name }` only.
Both consumers need more (email on the roster, D4H snapshot on both), and both
re-derive sort order. The query should return display-ready, ordered rows.

---

## 2. Principles

1. **`Kaga` for the roster, `Card`/`Item` for the card.** Match the rest of
   admin: rosters are data tables, sidebar cards are item lists.
2. **D4H columns/fields appear only when they can carry data.** On a non-linked
   team, the roster shows no Position/Status/Source columns at all — not empty
   ones. On the person card, a membership shows a D4H status line only when that
   membership has a `d4h` sub-object.
3. **Manual vs D4H-managed is always legible on a linked team.** An admin
   looking at a linked team's roster must be able to tell, per row, which
   memberships the next sync will reconcile and which it will leave alone.
4. **Display-only for D4H fields.** Position and status are never editable in
   AVUT; they are snapshots refreshed by sync. The only membership mutations
   remain add-member and remove-member.
5. **Server sorts; the client renders.** `listTeamMemberships` returns rows in a
   stable order; no consumer calls `.sort()` on the result.

---

## 3. API changes — `teams.listTeamMemberships`

Extend the output row (additive; existing consumers keep working):

```ts
TeamMembershipData.schema.extend({
  team: TeamData.schema.pick({ id: true, name: true }),
  person: PersonData.schema.pick({ id: true, name: true, email: true }),
  d4h: z
    .object({
      d4hMemberId: z.number(),
      status: D4HMemberStatus.schema, // see §4
      position: z.string().nullable(),
      ref: z.string().nullable(),
      lastSyncedAt: z.iso.datetime(),
    })
    .nullable(),
});
```

- `person.email` added to the `select`.
- `d4h` is mapped from the `TeamMembership_D4H` relation (`include: { d4h: true }`
  on the `teamMembership.findMany`), `null` when absent.
- **Ordering:** `orderBy: { person: { name: "asc" } }` in the Prisma query.
  Remove the `.sort()` calls in `team-personnel-content.tsx` and
  `add-team-member.tsx` (the latter can keep its own sort or drop it — the
  server order is already what it wants).
- `team-links.tsx` (count only) and `session-personnel-content.tsx` are
  unaffected. The `getTeamMembershipsCollection` schema
  (`src/lib/collections/team-memberships.ts`) omits `id`/`organizationId`; it
  should also `.omit({ d4h: true })` or widen its schema — pick whichever keeps
  its `react-db` typing happy, since it does not use the field.

No permission change — still `{ team: ["view"] }`.

---

## 4. D4H status vocabulary & formatting

D4H `Member.status` is `OPERATIONAL | NON_OPERATIONAL | OBSERVER | RETIRED`
(`src/lib/schemas/d4h/member.ts`). Add a small display module —
`src/lib/schemas/d4h/member-status.ts` (or fold into `member.ts`):

| D4H value         | Label           | Badge variant             |
| ----------------- | --------------- | ------------------------- |
| `OPERATIONAL`     | Operational     | `default` / success-toned |
| `NON_OPERATIONAL` | Non-operational | `secondary`               |
| `OBSERVER`        | Observer        | `outline`                 |
| `RETIRED`         | Retired         | `outline` muted           |

Exports:

- `D4HMemberStatus` — a zod enum + `values` array (reused by the API schema in
  §3 and by a Kaga faceted filter).
- `formatD4HMemberStatus(status)` → label string.
- `<D4HMemberStatusBadge status={...} />` — a thin wrapper over
  `components/ui/badge`.

This replaces the commented-out `toTeamMembershipStatus` /`MemberStatusType`
sketch in `member.ts`.

---

## 5. Membership source indicator

A shared presentational component —
`src/components/admin/teams/membership-source-badge.tsx`:

```tsx
<MembershipSourceBadge membership={row} />
```

- `row.d4h != null` → a small badge/icon reading **"D4H"** with a tooltip:
  _"Managed by D4H sync — last synced ‹relative time›."_
- `row.d4h == null` **and the team is D4H-linked** → a muted **"Manual"** badge,
  tooltip: _"Added in AVUT — not affected by D4H sync."_
- team **not** D4H-linked → renders nothing (every membership is manual; the
  distinction carries no information).

Used by both surfaces (§6, §7).

---

## 6. Team roster page

Rewrite `team-personnel-content.tsx` to use the `Kaga` block, matching the
personnel index and other rosters.

### 6.1 Layout

`Saratoga.Root` → `Saratoga.Header` (title `Members of {team.name}`,
`Saratoga.Actions` with the gated `AdminModule_AddTeamMember_Dialog`) →
`Kaga.TableToolbar` / `Kaga.Table` / `Kaga.TablePagination`.

### 6.2 Columns (`Kaga.defineColumns`)

| Column       | Shown when         | Content                                                                                        |
| ------------ | ------------------ | ---------------------------------------------------------------------------------------------- |
| Name         | always             | `person.name`, linking to the person detail page; `person.email` as a muted sub-line           |
| D4H Position | team is D4H-linked | the D4H position, or an em dash when blank                                                     |
| D4H Status   | team is D4H-linked | `<D4HMemberStatusBadge>`, or an em dash for a manual row                                       |
| Source       | team is D4H-linked | `<MembershipSourceBadge>`                                                                      |
| Status       | team is D4H-linked | `TeamMembership.status` (`Active` / `Archived`) — the record status other tables call "Status" |
| _(actions)_  | always             | `Protect team:["update"]` → remove-member button (unchanged behaviour)                         |

The D4H columns are built into the array conditionally on `team.d4h != null` so
they are absent, not blank, on a plain team.

**Terminology.** The bare word "Status" means the same thing it does in the other
admin tables — the record's `RecordStatus`. The D4H member-status snapshot is
always qualified as "D4H Status" (and likewise "D4H Position"), so the two are
never confused on a linked team.

**No "Joined" column.** `TeamMembership.createdAt` is when the row was added in
AVUT, which is not the person's D4H join date and would be read as one. Left off
entirely rather than shown with a caveat.

Default sort: Name ascending (server already returns this order; Kaga's initial
sort state mirrors it). Name and D4H Position are sortable.

### 6.3 Toolbar

- Text filter over name + email (`Kaga.filterFns` global filter).
- On a D4H-linked team: a faceted "D4H Status" filter (`D4HMemberStatus.values`)
  and a "Status" filter (`Active` / `Archived`), defaulting to `Active`.

### 6.4 Pagination

Standard `Kaga.TablePagination`, `Kaga.DEFAULT_PAGE_SIZE`. Most teams are well
under that; this keeps a large team usable.

### 6.5 Empty state

`Kaga.Table` renders its own "No results found" row, which is enough for v1. No
bespoke empty-state component and no "run a D4H sync" hint for now.

### 6.6 Cleanup

The parked `SyncD4HTeamDialog` was already removed on the base branch — nothing
to do here.

---

## 7. Teams card (person detail page)

Rewrite `team-memberships.tsx`. Still a `Card` titled "Teams", still `Item`
rows, still a link per team to the team detail page.

### 7.1 Row content

Per membership:

- **Primary:** `membership.team.name`.
- **Secondary line** (only when `membership.d4h != null`):
  `formatD4HMemberStatus(status)` + `· {position}` when position is set, muted.
- **Trailing:** `<MembershipSourceBadge>` (renders only for D4H rows here —
  there is no team context to say "Manual" against, so the badge component's
  team-not-linked branch is used by passing no "linked" flag; on the person
  card we only ever show the positive "D4H" badge). Then the existing
  `ItemLinkActionIcon`.

### 7.2 Ordering

Server returns rows ordered by `person.name`; for this card re-key by team name.
Since a single person's memberships are few, sort in the component by
`team.name` (this is not the query-cache array — it is already this person's
slice — but still copy before sorting: `[...memberships].sort(...)`).

### 7.3 Header count + empty state

- `CardTitle` gains a count: "Teams" + a muted `({n})` when `n > 0`.
- `n === 0` → card body shows _"Not a member of any team."_ (muted, small),
  not an empty card.

### 7.4 Out of scope (noted for a follow-up)

Adding a person to a team **from** this card (an "Add to team…" action mirroring
`AdminModule_AddTeamMember_Dialog`, gated `team:["update"]`) is a natural
extension but is a mutation-dialog task, not display. Left for a separate change
so this spec stays display-only.

---

## 8. Team-membership detail page

A dedicated page for **one person's membership of one team** — the record that
`listTeamMemberships` returns a row of. Added in a **second phase** (this spec's
§§3–7 ship first); captured here because it shares the data and the D4H model.

### 8.1 Why

Four motivations, all real:

1. **A home for editable membership metadata.** `updateTeamMembership` already
   exists (`tags`, `properties`) with **zero UI** — `getTeamMembershipsCollection`
   even wires an `onUpdate` to it. This page is the vehicle to finally ship it.
2. **A deep-link target.** `logEvent` writes `objectType: "TeamMembership"` on
   create / delete / every D4H sync add-archive-update, and today those entries
   point at nothing.
3. **D4H drill-down.** The full snapshot (`d4hRef`, `d4hRoleId`, team last-synced)
   plus a jump to `/d4h-views/members/[team_id]/[member_id]`.
4. **A membership activity timeline** — joined → D4H archived it → sync
   re-activated → tag added. **This one has a prerequisite** (§8.5).

### 8.2 Route

**`/orgs/[slug]/admin/teams/[team_id]/personnel/[person_id]`** — under the team,
matching the i3 module's `teams/[team_id]/members/[member_id]`. The membership is
resolved by `(teamId, personId)` (`@@unique([teamId, personId])`); no membership
id in the URL.

`page.tsx` + `team-membership-content.tsx` split per
`docs/patterns/detail-page-data-fetching.md`. Run `npx next typegen` after adding
the page.

Breadcrumbs: Admin › Teams › _{team}_ › Personnel › _{person}_.

### 8.3 Navigation wiring

- **Roster row** (`team-personnel-content.tsx`) — the Name cell keeps linking to
  the **person** page (the more common intent). Reaching the membership page is a
  new affordance: either a row `⋯` menu ("View membership", "Remove from team") or
  a dedicated trailing link cell. _(Decision open — see §8.6.)_
- **Person page Teams card** (`team-memberships.tsx`) — the row keeps linking to
  the **team** page. Optionally the D4H secondary line / badge becomes the link
  to the membership page. _(Decision open.)_

### 8.4 API — `teams.getTeamMembership` (new)

`organizationProcedure({ team: ["view"] })`, input `{ teamId, personId }`,
output one `listTeamMemberships`-shaped row (membership + `team {id,name}` +
`person {id,name,email}` + `d4h` sub-object) extended with the D4H fields the
roster omits (`d4hRef`, `d4hRoleId`) and the team's `d4h.lastSyncedAt`.
`NOT_FOUND` when the pair has no membership.

### 8.5 Page sections

| Section  | Content                                                                                            | Notes                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Details  | joined (`createdAt`), record status (`Active` / `Archived`), **tags**, **properties**              | `Protect team:["update"]` → an edit dialog on `updateTeamMembership`, per `docs/patterns/mutation-dialog.md` (`?action=edit`) |
| D4H      | member id, D4H status badge, position, ref, role id, team last-synced; link to the D4H member view | read-only; card hidden when `d4h == null`                                                                                     |
| Related  | → person page, → team page, → team roster                                                          | `Saratoga.Column slot="secondary"`                                                                                            |
| Activity | membership log entries, newest first                                                               | **§8.5.1**                                                                                                                    |
| Actions  | Remove from team                                                                                   | reuse `AdminModule_RemoveTeamMember_Dialog`; on success, redirect to the roster                                               |

#### 8.5.1 Activity — the prerequisite

There is **no log-entry read path anywhere in the app** (`personnel/[id]/history`
is `NotImplemented`; no `logEntries` router). The activity card needs, at minimum:

- `logEntries.listForObject({ objectType, objectId })` (or a `teams`-router
  procedure) — `organizationProcedure`, returns entries where
  `objectId == <membershipId>`, newest first, with actor + `changes`.
- A presentational `<LogEntryList>` / `<ActivityFeed>` — actor, action verb,
  humanised `changes` diff, relative timestamp. `Eagle` (JSON diff block) may
  help for the `changes` payload.

**Options:** (a) build this minimal membership-scoped slice now, as the first
consumer of the audit log; (b) ship the page with the Activity card stubbed
("Coming soon" / omitted) and add it when a general log viewer is built.

### 8.6 Open decisions

| Question                        | Options                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------- |
| How the roster reaches the page | row `⋯` menu · trailing link cell · make a non-Name cell the link               |
| Person card → membership link   | keep row → team only · add membership link on the D4H line                      |
| Activity card scope             | build the minimal log-entry read path now · stub until a general viewer exists  |
| Editable `properties`           | free-form key/value editor · defer, edit `tags` only for v1                     |
| Where "Remove from team" lives  | membership page only · membership page **and** roster · roster only (unchanged) |

---

## 9. Team detail "Related" card — unchanged

`team-links.tsx` keeps showing the `"{n} Personnel"` count link. Replacing that
count with a member preview is explicitly **out of scope** for this spec (the
roster page is one click away and now carries all the detail). Flagged here only
so a reader knows it was considered.

---

## 10. Files touched

| File                                                             | Change                                                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/trpc/routers/teams-router.ts`                               | `listTeamMemberships` — `include d4h`, select `person.email`, `orderBy person.name`, widen the `person` pick (§3) |
| `src/lib/schemas/d4h/member.ts`                                  | `formatD4HMemberStatus` next to the existing `D4HMemberStatus`; drop the stale commented-out member interface     |
| `src/components/admin/teams/d4h-member-status-badge.tsx` _(new)_ | `<D4HMemberStatusBadge>` (§4)                                                                                     |
| `src/components/admin/teams/membership-source-badge.tsx` _(new)_ | `<MembershipSourceBadge>` (§5)                                                                                    |
| `src/components/admin/teams/team-personnel-content.tsx`          | rewrite on `Kaga` (§6)                                                                                            |
| `src/components/admin/personnel/team-memberships.tsx`            | richer rows, count, empty state (§7)                                                                              |
| `src/trpc/routers/teams-router.test.ts`                          | cover the new `listTeamMemberships` shape + ordering                                                              |

No migration. No permission changes. No new tRPC procedures.

---

## 11. Decisions

| Question                          | Decision                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native "role within team" field?  | **No.** Display D4H `position`/`status` read-only; nothing editable added.                                                                                         |
| Roster table implementation       | `Kaga` data table, replacing the hand-rolled `<Table>`.                                                                                                            |
| D4H columns on a non-linked team  | Absent entirely, not shown empty.                                                                                                                                  |
| Column terminology                | Bare "Status" = `RecordStatus`, matching other admin tables. D4H snapshot fields are qualified: "D4H Status", "D4H Position".                                      |
| No "Joined" column                | `createdAt` is the AVUT row-creation time, easily misread as a D4H join date — omitted.                                                                            |
| Manual vs D4H-managed distinction | `<MembershipSourceBadge>` — "D4H" / "Manual" (linked teams only), driven by `TeamMembership_D4H` presence.                                                         |
| Where sorting happens             | Server (`orderBy person.name`); consumers stop calling `.sort()`.                                                                                                  |
| Person card: add-to-team action   | Out of scope — display-only spec; separate mutation-dialog change.                                                                                                 |
| Team detail "Related" count card  | Unchanged — out of scope.                                                                                                                                          |
| Team-membership detail page       | Phase 2 (§8). Route A: `teams/[team_id]/personnel/[person_id]`. Covers all four motivations; the Activity card carries a prerequisite (first log-entry read path). |
| Dependency                        | Assumes `docs/specs/d4h-linking.md` (`TeamMembership_D4H`, `TeamMembershipData.d4h`) lands first.                                                                  |
