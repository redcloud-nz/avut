# Spec: D4H linking & team synchronisation

**Status:** Draft — approved for implementation of Phase 1 (manual sync).
**Supersedes:** `importTeamFromD4H` / `syncronizeD4HTeam` in `teams-router.ts`, the
`properties.d4h*` blobs on `Team` / `Person` / `TeamMembership`, and the unused
`TeamType` enum.

This spec covers how AVUT records the relationship between its own
organisations, teams, personnel and team memberships and the corresponding
entities in a D4H Team Manager instance, and how a linked team's membership is
reconciled against D4H on demand.

---

## 1. Background

### 1.1 The two entity models

**D4H side** (read through `openapi-fetch`; Zod schemas in `src/lib/schemas/d4h/`):

| D4H entity     | Identity     | Notes                                                                                       |
| -------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `Organisation` | `id: number` | `title`, `timezone`, `currency`, `reportingStartDay`, `reportingStartMonth`. Owns teams.    |
| `Team`         | `id: number` | `title`; `owner` → Organisation (**optional** in the API — see §5). Detail adds `timezone`. |
| `Member`       | `id: number` | `name`, `email`, `position`, `ref`, `role`, `status`; `owner` → Team.                       |

A D4H `Member` is **not a person** — it is a person _in one team_. D4H has no
cross-team person identity, so the same human on two D4H teams is two `Member`
records with two ids.

Access is per `D4hAccessToken` — either **personal** (`userId` set) or
**organisation** (`userId: null`) — each carrying a `serverCode` of `ap` / `eu` /
`us`. A token's `whoami` lists one `Member` per team the token can see, and a
single token _may_ span more than one D4H organisation.

**AVUT side:**

| AVUT entity      | Current D4H link                                               |
| ---------------- | -------------------------------------------------------------- |
| `Organization`   | none                                                           |
| `Team`           | `Team_D4H` sidecar (declared, **never written by any code**)   |
| `Person`         | `properties.d4hId` JSON blob (a team-scoped member id — wrong) |
| `TeamMembership` | `properties.d4hMemberId` JSON blob                             |

### 1.2 Problems with the current implementation

- **`Team_D4H` is dead.** `importTeamFromD4H` (`@deprecated`) writes
  `properties.d4hTeamId` / `d4hServer` / `d4hLastSync` and never creates the
  `Team_D4H` row, so `syncronizeD4HTeam`'s `if (team.d4h == null)` guard can
  never pass. The sync procedure is unreachable.
- **Mixed sources of truth.** `syncronizeD4HTeam` reads `team.d4h.d4hTeamId`
  (relation) but `team.properties.d4hLastSync` and
  `member.properties.d4hMemberId` (blobs) in the same function.
- **No update path.** Sync only adds and removes memberships; a member whose
  `status` / `position` / `name` changed in D4H is left stale.
- **`d4hId` on the wrong entity.** A D4H member id is team-scoped; storing it on
  `Person` breaks the moment someone is on two D4H teams.
- **Convention drift.** The sync loop issues bare `await`s instead of
  `$transaction([write, logEvent])` pairs.
- **`teams.type` column drift.** Migration `20260404022916_add_team_type` added a
  `type` column (`TeamType`, default `General`); the `Team` model no longer
  declares it. Only the orphaned enum + column remain.

---

## 2. Principles

1. **A sidecar relation table for every link** — anything sync reads, writes, or
   filters on. `properties` JSON is for free-form user annotation only. (Pattern
   already used by `Team_D4H`, `I3Template_D4H`, `I3TemplateVariant_D4H`.)
2. **One AVUT organisation links to at most one D4H organisation.**
3. **D4H is authoritative for membership existence and its own snapshot fields.
   AVUT is authoritative for everything else**, including a `Person`'s `name` and
   `email` once the person exists.
4. **Manual, preview-then-apply sync first.** Scheduled sync is Phase 2 (§9).

---

## 3. Link model

### 3.1 `Organization_D4H` (new — 0..1 per AVUT organisation)

The resolved D4H-organisation identity for an AVUT org, plus a cache of that
org's D4H attributes. **Distinct from `integrations.d4h` settings**, which hold
_policy_ (`enabled`, `teamSync`); this holds _resolved foreign identity + fetched
data_, which does not belong in a JSON config blob.

| Field                    | Type        | Notes                                                               |
| ------------------------ | ----------- | ------------------------------------------------------------------- |
| `organizationId`         | `String`    | `@unique`, FK → `Organization`, `onDelete: Cascade`                 |
| `serverCode`             | `String`    | `ap` / `eu` / `us`. Fixed on first link.                            |
| `d4hOrganisationId`      | `Int?`      | Nullable for schema safety; in practice always set (see §5).        |
| `d4hOrganisationName`    | `String?`   | Cache                                                               |
| `d4hTimezone`            | `String?`   | Cache                                                               |
| `d4hCurrency`            | `String?`   | Cache                                                               |
| `d4hReportingStartDay`   | `Int?`      | Cache                                                               |
| `d4hReportingStartMonth` | `Int?`      | Cache                                                               |
| `syncTokenId`            | `String?`   | FK → `D4hAccessToken` (an org token), `onDelete: SetNull`. Phase 2. |
| `orgSyncedAt`            | `DateTime?` | Last refresh of the cached attributes above                         |

Created lazily on the first `linkTeamToD4H`. **Sticky** — `d4hOrganisationId` is
cleared only by an explicit `unlinkOrganizationFromD4H` admin action, which
refuses while any `Team_D4H` rows remain in the org.

### 3.2 `Team_D4H` (exists — extend)

| Field               | Type        | Change                                                                                           |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `teamId`            | `String`    | `@unique`, FK → `Team`, `onDelete: Cascade` (unchanged)                                          |
| `d4hTeamId`         | `Int`       | unchanged                                                                                        |
| `d4hTeamName`       | `String`    | unchanged; refreshed each sync                                                                   |
| `d4hServerCode`     | `String`    | **renamed** from `d4hServer`                                                                     |
| `d4hOrganisationId` | `Int?`      | **new** — the team's D4H org; null only if org-less                                              |
| `d4hTimezone`       | `String?`   | **new**                                                                                          |
| `linkTokenId`       | `String?`   | **new**, informational — token that created the link; FK → `D4hAccessToken`, `onDelete: SetNull` |
| `d4hLastSyncedAt`   | `DateTime?` | exists; currently never written — sync writes it                                                 |

### 3.3 `TeamMembership_D4H` (new — replaces `properties.d4hMemberId`)

| Field              | Type       | Notes                                                                     |
| ------------------ | ---------- | ------------------------------------------------------------------------- |
| `teamMembershipId` | `String`   | `@unique`, FK → `TeamMembership`, `onDelete: Cascade`                     |
| `d4hMemberId`      | `Int`      | `@index`. The D4H `Member` id — team-scoped, so this is its correct home. |
| `d4hStatus`        | `String`   | `OPERATIONAL` / `NON_OPERATIONAL` / `OBSERVER` / `RETIRED`                |
| `d4hPosition`      | `String?`  | Snapshot                                                                  |
| `d4hRef`           | `String?`  | Snapshot                                                                  |
| `d4hRoleId`        | `Int?`     | Snapshot                                                                  |
| `d4hLastSyncedAt`  | `DateTime` | Snapshot                                                                  |

Presence of this row is the marker that a membership is D4H-managed. Memberships
without it were added manually and are never touched by sync.

### 3.4 No `Person_D4H`

D4H has no cross-team person, so there is nothing stable to link a `Person` to.
`Person` identity is `@@unique([organizationId, email])`, and email is the match
key for sync. The `properties.d4hId` currently stamped by `createPerson` in the
sync path is removed.

---

## 4. Invariants (enforced at link time)

`linkTeamToD4H` resolves the D4H team through the acting token, reads its
`owner` (D4H organisation, or none), and then:

1. **Server consistency.** The token's `serverCode` must equal
   `Organization_D4H.serverCode` if that row already exists; otherwise it is set
   from the token now.
2. **D4H team has organisation `O`:**
   - `Organization_D4H` missing → create it with `d4hOrganisationId = O`, fetch
     and cache `O`'s attributes.
   - `d4hOrganisationId == O` → OK.
   - `d4hOrganisationId == null` → set it to `O` and cache attributes. (Only
     reachable if org-less teams were linked first — see §5.)
   - `d4hOrganisationId == O'`, `O' != O` → **reject**:
     _"This organization is linked to D4H organisation ‹O'›; that team belongs to ‹O›."_
3. **D4H team has no organisation** → reject in Phase 1:
   _"This D4H team is not owned by a D4H organisation, which is not supported."_
   The column stays nullable so this can be relaxed later without a migration.
4. **Visibility.** The token must be able to see the D4H team
   (`getD4HTokenMetadata` check, kept from today's `getD4HTeam`).
5. **One D4H team per AVUT team and vice versa** — `Team_D4H.teamId` is unique;
   add `@@unique` on `[organizationId-scoped]` `d4hTeamId` is enforced in
   application code against the org's teams (a D4H team is linked at most once
   per AVUT org).

Net effect: every organisation-bearing `Team_D4H` in one AVUT org necessarily
shares one D4H organisation. A multi-org token is handled for free — it may
_see_ other D4H orgs; their teams simply cannot be linked into this AVUT org.

---

## 5. Org-less D4H teams

The D4H API models `Team.owner` as optional, so org-less teams may exist. We
have none today and Phase 1 **rejects** linking them (§4.3). The schema keeps
`d4hOrganisationId` nullable on both `Organization_D4H` and `Team_D4H` so support
can be added later as pure application logic:

- an org-less D4H team links without touching `Organization_D4H.d4hOrganisationId`;
- the "single D4H org per AVUT org" rule then applies only to org-bearing teams.

---

## 6. Operations

All are `organizationProcedure` in `teams-router.ts`. New `operationKey`s
(`d4h-team-link`) are added to the `Operations` registry in `src/lib/operations.ts`.

### 6.1 `linkTeamToD4H({ teamId, d4hTeamId })`

`{ team: ["update"] }`. Links an **existing** AVUT team.

1. Load the team; reject if already linked.
2. Resolve `d4hTeamId` through `getPersonalD4HAccessTokenForUser` +
   `getD4HTokenMetadata`; run §4 invariants.
3. Open a `LogBatch` (`operationKey: "d4h-team-link"`).
4. `upsert` `Organization_D4H` (create + cache attrs, or verify).
5. `$transaction`: create `Team_D4H`, `logEvent` `Update` on `Team`.
6. Run the sync (§7) for the first membership pull, within the same batch.

### 6.2 `createTeamFromD4H({ d4hTeamId, name? })`

`{ team: ["create"] }`. Convenience for the current import UI: create the AVUT
team, then link, then first sync — one batch. `name` defaults to the D4H team
title.

> If team management moves off better-auth (Appendix A), this becomes a single
> `$transaction` for the create + `Team_D4H` + first `logEvent`. Until then it
> carries the same orphan-batch trade-off already documented on
> `importTeamFromD4H` (`auth.api.createTeam` is not a Prisma op).

### 6.3 `unlinkTeamFromD4H({ teamId })`

`{ team: ["update"] }`. Deletes the `Team_D4H` row; `TeamMembership_D4H` rows
cascade away but the `TeamMembership` rows themselves stay (they become
manually-managed). `logEvent` `Update` on `Team`.
`Organization_D4H.d4hOrganisationId` is **not** cleared (sticky, §3.1).

### 6.4 `unlinkOrganizationFromD4H()`

`{ organization: ["update"] }` (or admin). Deletes `Organization_D4H`. Refuses
with `PRECONDITION_FAILED` while any `Team_D4H` row exists in the org.

### 6.5 `planD4HTeamSync({ teamId }) → SyncPlan` and `applyD4HTeamSync({ teamId, planToken })`

The two-step preview/apply flow — see §7.

### 6.6 Retirements

- `importTeamFromD4H` — delete; repoint `import-team-from-d4h.tsx` at
  `createTeamFromD4H`.
- `syncronizeD4HTeam` — delete; replaced by §6.5.

---

## 7. Synchronisation

### 7.1 Shape

```
planD4HTeamSync(teamId)            // pure read → SyncPlan
applyD4HTeamSync(teamId, planToken) // re-plans, then writes
```

- **`buildSyncPlan(d4hMembers, avutMemberships)` is a pure function** —
  deterministic, unit-testable with no Prisma.
- `planD4HTeamSync` fetches both sides and returns the plan plus a `planToken`
  (a hash of the D4H input + a `generatedAt`).
- `applyD4HTeamSync` **re-fetches and re-plans server-side**, then applies the
  fresh plan. If the fresh plan differs from `planToken`'s hash it still
  applies, but the response flags `stalePreview: true` so the UI can tell the
  user what changed. The previewed plan is advisory; the applied plan is always
  freshly computed. (No server-side plan persistence.)

### 7.2 Reconciliation — keyed by `d4hMemberId`

| Case                                                            | Action                                                                                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| in D4H, no AVUT membership                                      | resolve `Person` by `(orgId, email)` — **reuse if it exists** (join them to the team), else `createPerson`. Create `TeamMembership` + `TeamMembership_D4H`.                           |
| in both                                                         | diff the `TeamMembership_D4H` snapshot fields (`d4hStatus`, `d4hPosition`, `d4hRef`, `d4hRoleId`). Write + `logEvent` `Update` **only if the diff is non-empty**. `Person` untouched. |
| AVUT membership **with** a `TeamMembership_D4H` row, not in D4H | **hard delete** the `TeamMembership` (`_D4H` cascades) + `logEvent` `Delete`.                                                                                                         |
| AVUT membership **without** a `TeamMembership_D4H` row          | never touched.                                                                                                                                                                        |

After reconciliation, refresh `Team_D4H` (`d4hTeamName`, `d4hOrganisationId`,
`d4hTimezone`, `d4hLastSyncedAt`) and, for an org-bearing team, the
`Organization_D4H` cached attributes + `orgSyncedAt`.

### 7.3 `SyncPlan` shape (for the confirm dialog)

```ts
type SyncPlan = {
  teamId: string;
  generatedAt: string;
  planToken: string;
  additions: {
    d4hMemberId: number;
    name: string;
    email: string;
    personMatch: "existing" | "new";
    status: D4HMemberStatus;
  }[];
  updates: {
    teamMembershipId: string;
    personName: string;
    changes: Change[]; /* from diffObject */
  }[];
  removals: { teamMembershipId: string; personName: string }[];
  teamMetadataChanges: Change[];
  counts: { additions: number; updates: number; removals: number };
};
```

An empty plan (`counts` all zero, no metadata changes) is still valid — the UI
shows "already in sync".

### 7.4 Writes & logging

- Every write is paired with its `logEvent` inside `$transaction([...])` (fixes
  the current bare-`await` drift). One `$transaction` per member is acceptable —
  they are independently meaningful events (per `operations.ts` guidance) and the
  loop is bounded by team size.
- One `LogBatch` per apply, `operationKey: "d4h-team-sync"`, `userId = ctx.userId`.
- `logEvent` entries carry `refs` to `Person` and `Team` as `context`, matching
  the existing pattern in `importTeamFromD4H`.

### 7.5 Authority

- **D4H authoritative:** whether a membership exists; `d4hStatus`, `d4hPosition`,
  `d4hRef`, `d4hRoleId`; team `title` / `timezone` / owning org.
- **AVUT authoritative:** `Person.name`, `Person.email` (once the person
  exists), `Person.tags` / `properties`; `TeamMembership.tags` / `properties`;
  all skill-tracking data; manually-added memberships.

---

## 8. UI

- **Team detail page** gains a "D4H" card (behind `integrations.d4h.enabled` and
  `Protect team:["update"]`):
  - unlinked → "Link to D4H…" opens a dialog listing token-visible D4H teams
    (`d4hApi.listTeamsAccessibleToUser`), applying §4 rejections inline.
  - linked → shows `d4hTeamName`, D4H org, `d4hLastSyncedAt`, a "Sync…" button
    and an "Unlink" menu item.
- **Sync dialog** (`?action=sync`, per `mutation-dialog.md`): calls
  `planD4HTeamSync` on open, renders `additions` / `updates` / `removals` as
  three grouped lists, "Apply" calls `applyD4HTeamSync`. If the response comes
  back `stalePreview`, show a non-blocking notice and the recomputed counts.
- **Create-from-D4H** replaces the current import dialog wiring, calling
  `createTeamFromD4H`.

---

## 9. Phase 2 — scheduled sync (deferred)

Not built now. When it lands:

- `integrations.d4h` keeps a single **`teamSync: "Never" | "Daily" | "Weekly"`**
  setting (drop `teamMemberSync`; the one sync reconciles both metadata and
  membership).
- `integrations.d4h.syncToken` becomes / is replaced by
  `Organization_D4H.syncTokenId`, referencing an **organisation** access token.
- A Vercel cron entrypoint iterates orgs where `enabled && teamSync != "Never"`
  and the interval is due, resolves `syncTokenId`, and runs `applyD4HTeamSync`
  for each `Team_D4H` with **`actor = null`, `batchId` set**
  (`recordLogEntry` permits a null actor alongside a batch),
  `operationKey: "d4h-team-sync-scheduled"`.
- Missing / expired sync token → skip the org, write one `scope: "system"` log
  entry.

---

## 10. Migration & cleanup checklist

| #   | Change                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | New models `Organization_D4H`, `TeamMembership_D4H`; extend `Team_D4H` (`d4hServer` → `d4hServerCode`, add `d4hOrganisationId`, `d4hTimezone`, `linkTokenId`).                                                                                                                                                           |
| 2   | Backfill migration: for any team currently carrying `properties.d4hTeamId` (prod check first), synthesise `Team_D4H` + `Organization_D4H`; for memberships with `properties.d4hMemberId`, synthesise `TeamMembership_D4H`. Then strip the `d4h*` keys from all three `properties` columns and `Person.properties.d4hId`. |
| 3   | Drop `enum TeamType` and the orphaned `teams.type` column. "Is a D4H team" = `Team_D4H != null`.                                                                                                                                                                                                                         |
| 4   | `src/lib/schemas/team.ts` — `TeamData.d4h` gains `d4hOrganisationId`, `d4hTimezone`; rename `d4hServer` → `d4hServerCode`. New `TeamMembershipData` D4H sub-object.                                                                                                                                                      |
| 5   | `src/lib/operations.ts` — add `d4h-team-link`; rename `d4h-team-import` away (or keep as a historical key — batches referencing it still exist). Keep `d4h-team-sync`.                                                                                                                                                   |
| 6   | Delete `importTeamFromD4H`, `syncronizeD4HTeam`; add `linkTeamToD4H`, `createTeamFromD4H`, `unlinkTeamFromD4H`, `unlinkOrganizationFromD4H`, `planD4HTeamSync`, `applyD4HTeamSync` (alphabetical order in the router).                                                                                                   |
| 7   | `src/lib/schemas/d4h/organisation.ts` / `team.ts` — ensure the org-detail fetch and its cache mapping are covered; add `D4HMemberStatus` export if not present.                                                                                                                                                          |
| 8   | UI: team-detail D4H card, sync dialog, repoint `import-team-from-d4h.tsx`.                                                                                                                                                                                                                                               |
| 9   | Tests: `buildSyncPlan` unit tests (pure); router tests for link invariants (§4) and apply reconciliation (§7.2) with `createMockPrisma`.                                                                                                                                                                                 |

This work adds migrations → its own branch + `npm run db:branch <slug>` before
any `migrate dev`, `npm run db:unbranch` on merge.

---

## Appendix A — team management off better-auth (recommendation, not scoped here)

AVUT uses better-auth's organization-plugin team mechanism (`auth.api.createTeam`
/ `removeTeam`, the `TeamUser` join, `Team.memberCount` and
`TeamUser.membershipKey` maintained with `input: false`). In practice AVUT does
its own team membership through `Person` + `TeamMembership` and gets little from
the plugin's team layer beyond friction:

- `createTeam` / `removeTeam` are not Prisma ops, so they cannot join a
  `$transaction` with the `logEvent` — every team mutation carries an
  orphan-row / partial-failure caveat (see `createTeam`, `deleteTeam`,
  `importTeamFromD4H`).
- `TeamUser` / `memberCount` / `membershipKey` duplicate state AVUT does not read.

**Recommendation:** manage `Team` directly through Prisma (`create` / `update` /
`delete` in a `$transaction` with `logEvent`), drop `TeamUser` and the
`input: false` columns, and keep `Team` purely as an AVUT-owned record. This
removes every orphan-batch caveat, including from `createTeamFromD4H`.

Track as a separate change; this spec does not depend on it but is cleaner with
it.

---

## Appendix B — resolved decisions

| Question                           | Decision                                             |
| ---------------------------------- | ---------------------------------------------------- |
| `Person` name/email after creation | AVUT authoritative — sync never overwrites           |
| Removed memberships                | hard delete                                          |
| `TeamType` enum                    | remove; infer from `Team_D4H`                        |
| Multi-org tokens                   | assume possible; handled by the single-org-slot rule |
| `importTeamFromD4H`                | retire                                               |
| AVUT org ↔ D4H org                 | at most 1:1, sticky until explicit removal           |
| Org-less D4H teams                 | hypothetical; reject on link, schema stays nullable  |
| `teamSync` vs `teamMemberSync`     | single `teamSync` setting                            |
| Email collision on create          | reuse the existing `Person`                          |
| Sync UX                            | preview `SyncPlan` → user applies                    |
| Scheduled sync                     | Phase 2, deferred                                    |
