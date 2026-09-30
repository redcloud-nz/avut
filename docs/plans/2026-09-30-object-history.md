# Plan: per-object History pages

**Date:** 2026-09-30
**Issue:** [#48](https://github.com/redcloud-nz/avut/issues/48)
**Branch:** `feat/object-history`
**Worktree:** `.claude/worktrees/object-history` (dev server port 3110, `npm run dev`)
**DB:** no migration. `log_entry_objects` already has `@@index([objectType, objectId])`, and
reads only. Shared `avut` is fine, and no `db:branch` is needed.
**D4H:** the D4H access-token history page reads the audit log only, never the D4H API, so a
missing or broken token doesn't affect it.
**Written against:** integration @ 89eb45a2

The audit log (`LogEntry` + the `LogEntryObject` fan-out, written only through `ctx.logEvent` →
`recordLogEntry` in `src/server/log-entry.ts`) is write-only today. The only readers are the
Rubbish bin's and account deletion's "deleted at" lookups. This adds a History page to five
detail pages, reached from each page's menu or header, which lists every log entry about the
object: who did what, when, and the field-level changes.

## Decisions

- **Dedicated `/history` pages, not a card on the detail page.** One per object type, at
  `<detail route>/history`. Two stubs already exist and get filled in:
  `admin/personnel/[person_id]/history` (a client page rendering `<NotImplemented />`) and
  `skill-package-builder/packages/[package_id]/history` (a server page +
  `package-history-content.tsx`, with a **disabled** History item in `package-menu.tsx`). The
  other three are new: `admin/teams/[team_id]/history`,
  `admin/d4h-access-tokens/[token_id]/history`, `skill-track/sessions/[session_id]/history`.
- **Who can see it: whoever can view the object.** A single registry,
  `HistoryObjects` in `src/lib/schemas/object-history.ts`, maps each supported
  `LogObjectType` to the permission its detail page's getter already requires:

  | objectType          | permission                    | from                                         |
  | ------------------- | ----------------------------- | -------------------------------------------- |
  | `Person`            | `person: ["view"]`            | `personnel.getPerson`                        |
  | `Team`              | `team: ["view"]`              | `teams.getTeam`                              |
  | `D4HAccessToken`    | `organization: ["update"]`    | `d4hAccessTokens.getOrganizationAccessToken` |
  | `SkillPackage`      | `skillPackage: ["view"]`      | `skillPackageBuilder.getPackage`             |
  | `SkillCheckSession` | `skillCheckSession: ["view"]` | `skillCheckSessions.getSession`              |

  The History menu item needs no `<Protect>`: anyone on the detail page already holds the
  permission.

- **Related entries are filtered by their own type's permission.** The page permission only
  covers entries about the object itself. A related entry is shown only if the caller also
  holds the view permission for the entry's own `objectType`, from a second map,
  `RelatedEntryPermissions: Partial<Record<LogObjectType, Permissions>>`, in the same file.
  A registry type (one in `HistoryObjects`) missing from that map falls back to its
  `HistoryObjects` permission, so it fails closed; only a type in neither map passes through.
  A type with its own view permission must be listed in one of the two before its entries
  carry refs.

  | entry objectType         | permission         | what would otherwise leak                                                                                     |
  | ------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------- |
  | `OrganizationMembership` | `member: ["view"]` | person ↔ user link entries (user id in the description) to `skills-assessor`/`skills-admin`/`skills-reporter` |
  | `TeamMembership`         | `team: ["view"]`   | team names and `TeamLink`s to `i3-editor`                                                                     |
  | `Person`                 | `person: ["view"]` | person names on a Team's history (defensive; every role with `team:view` has `person:view` today)             |
  | `Team`                   | `team: ["view"]`   | (defensive, same reasoning)                                                                                   |

  The router works out the allowed related types and passes them to the service as
  `relatedTypes`. Primary entries always pass. `ctx.hasPermission` throws on denial, so the
  router uses a small non-throwing wrapper (`canView(ctx, permissions)` in the router file,
  catching only the `FORBIDDEN` `TRPCError`). Name resolution for `Person`/`Team` refs is gated
  the same way: a ref whose type the caller can't view comes back unresolved.

- **One generic procedure, permission checked at runtime.** `history.listObjectHistory`
  takes `{ objectType, objectId, cursor?, limit? }`, with `objectType` restricted to the
  registry's keys (`HistoryObjectType.schema`). It's declared as `organizationProcedure()`
  (`organization: ["view"]`), then awaits
  `ctx.hasPermission(input.organizationId, HistoryObjects[input.objectType].permissions)`
  before reading. That keeps one registry to extend rather than five near-identical
  procedures. It's a new `history-router.ts` because no existing domain router owns the log.
- **Related entries are included, via the fan-out table.** The service matches
  `objects: { some: { objectType, objectId } }`, so a `TeamMembership` entry (which carries
  `Person` and `Team` `context` refs) appears on both the Person's and the Team's history.
  Each returned entry says whether it is **about** this object (`primary`) or **related**, and
  lists its other refs. `Person` and `Team` refs are resolved to names (one `findMany` each
  per page, org-scoped), so a Person's history can read "Team membership created — Rescue 1"
  and link with `TeamLink`/`PersonLink`. Any other ref type is shown by type only.
- **Always org-scoped.** Every query filters `organizationId: ctx.organizationId`. That matters
  for `SkillPackage`, which is shared across orgs through subscriptions: an org's history page
  never shows another org's entries about the same package.
- **Actor shows as a name, never an email.** `actorLabel` is `"Name <email>"`
  (`formatActorLabel`) or an operation label. The service returns `actorName`:
  `user.name` when the user still exists, otherwise `actorLabel` with a trailing
  ` <…>` stripped. If the entry has `impersonatorId`, it also returns `impersonatorName`. If
  it has a `batchId`, it returns the batch's operation label, from `Operations[key].label`
  (`src/lib/operations.ts`). The UI renders an actor-less batch entry as that label ("D4H team
  sync").
- **`userId` can be null on read** (`onDelete: SetNull`). Per the header comment in
  `log-entry.ts`, the service tolerates it and falls back to `actorLabel`, and does not
  re-assert write-time invariants. Nothing read from a stored row is parsed strictly:
  `changes` is parsed with `z.array(DiffChange.schema).catch([])`, and the output schema types
  `action`, `objectType` and ref `role` as plain strings (the UI maps known values to labels
  and shows unknown ones verbatim). So one malformed or retired-value historical row renders
  plainly instead of failing the page.
- **Ordering and paging by `sequence`, newest first.** `timestamp` is identical for entries
  from one transaction. Paging is keyset on `sequence` (`where: { sequence: { lt: cursor } }`,
  `take: limit + 1`), with page size 50 by default and 100 max. The schema comment warns that
  `sequence` isn't a safe _sync_ cursor. For "Load more" on a human-read page, a rare
  concurrently committed lower row being missed from an older page is acceptable, and the
  service's JSDoc says so.
- **Client uses `useSuspenseInfiniteQuery`** with
  `trpc.history.listObjectHistory.infiniteQueryOptions(…, { getNextPageParam })`. This is the
  first infinite query in the app. The server-side `prefetch()` in `src/trpc/server.tsx` only
  accepts `FetchQueryOptions`, so a sibling `prefetchInfinite()` is added next to it (same
  shape: un-awaited `getServerQueryClient().prefetchInfiniteQuery(...)`). The history pages
  prefetch the entity getter (for the title and breadcrumbs) and the first history page. The
  server prefetch and the client call pass identical input (both omit `limit`), so the query
  keys match. The client query keeps the default `staleTime` (a lower one would be clamped to
  1s under Suspense anyway). No mutation effect invalidates history; freshness comes from the
  page's RSC `prefetchInfinite` rerunning on each navigation, whose newer data hydration
  writes over the cache.
- **Change rendering is a pure formatter in `src/lib/`**, with no JSX, so it's unit-testable.
  `describeChange(change, labels?)` maps each `DiffChange` variant to a
  `{ field, kind, prev?, curr? }` descriptor. The component turns that into markup. Field names
  are humanised generically (camelCase → words, path segments joined with " › "; for example,
  `["properties", "callSign"]` → "Properties › Call sign"). An optional override map,
  `FieldLabels: Partial<Record<LogObjectType, Record<string, string>>>`, is keyed by the
  **entry's own** `objectType`, not the page's, because a related `TeamMembership` entry
  carries `TeamMembership` fields on a Person page. Values: `null`/`""` → "(empty)",
  booleans → "Yes"/"No", arrays → comma list, ISO datetime strings → `formatDateTime` with
  the viewer's display preferences. `obj_mask` → "changed (hidden)", `arr_ord` →
  "reordered". Object types get a display label from `objectTypeLabel(type)` (humanised,
  `"TeamMembership"` → "Team membership", with overrides where that reads badly, e.g.
  `Session` → "Sign-in session"; acronym runs like `D4H` already humanise correctly). Unknown values fall back to the raw string.
- **Layout** (revised at the visual checkpoint): `Saratoga.Root` with a flat, borderless
  list of entries (a timeline, not a `Kaga` table), not in a card. Every entry is collapsed by
  default. Its header is a plain-text sentence with no links or pills ("Added to team Erehwon
  Logistics by Demo Owner"), with the past-tense action (`actionPastTenseLabel`) and, for
  related entries, a page-aware phrase (`relatedActionPhrase`). The relative time sits at the
  end. Below a `@2xl` container width, the header drops to the bare action ("Added to team").
  The body holds the full timestamp, the actor, the linked refs, the description, then the
  change list. A "Load more" button at the bottom while `hasNextPage`. The empty state is
  "No history recorded yet."

## Tasks

- [x] **1. Diff change formatter** — `feat(history): add diff change formatter` + `fix(history): accept offset ISO datetimes and keep empty creates as set`
  - **Files:** `src/lib/diff-format.ts` (new), `src/lib/diff-format.test.ts` (new).
  - **Do:** Export `describeChange(change: DiffChange, options?: { labels?: Record<string,
string>; prefs?: DisplayPreferences })` returning `{ field: string; kind: "set" |
"cleared" | "changed" | "added" | "removed" | "masked" | "reordered"; prev?: string;
curr?: string }`, plus the helpers it uses (`formatFieldPath(path, labels?)`,
    `formatDiffValue(value, prefs?)`), and `objectTypeLabel(type: string)` (see Decisions).
    Mapping: `obj_add` → `set` (an empty `curr` renders as `set` "(empty)", never `cleared`: creates are logged as `diffObject({}, record)`, so empty optional fields arrive as `obj_add`), `obj_del` → `cleared`,
    `obj_mod` → `changed`, `arr_add` → `added`, `arr_del` → `removed`, `obj_mask` → `masked`,
    `arr_ord` → `reordered`. `labels` is keyed by the joined path (`"properties.callSign"`)
    and wins over humanising. Use `formatDateTime(value, prefs)` from `src/lib/datetime.ts` for
    ISO datetime strings (a full-string match of an ISO datetime with optional fractional seconds and a `Z` or `±hh:mm` offset — `DatePicker` emits `formatISO` without milliseconds — so a plain string that merely starts with digits isn't reformatted). The component passes
    `usePreferences().display` as `prefs`. Types come from `DiffChange` in `src/lib/diff.ts`.
    Don't add anything to `diff.ts` itself. `FieldLabels` lives here too, starting empty
    unless a real field reads badly.
  - **Done when:** tests cover every `DiffChange` variant, label override vs humanising,
    nested paths, each value kind (null, empty string, boolean, number, array, ISO date,
    non-date string), prefs being honoured, and `objectTypeLabel` for a known, an overridden
    and an unknown type; `npm run check` passes.

- [x] **2. History registry, output schema and read service** — `feat(history): add object history registry and read service` + `test(history): cover unresolved ref types and use log entry id factories`
  - **Files:** `src/lib/schemas/object-history.ts` (new), `src/server/services/object-history.ts`
    (new), `src/server/services/object-history.test.ts` (new).
  - **Do:** In the schema file: `HistoryObjects` (the registry in Decisions: `permissions:
Permissions`), `RelatedEntryPermissions` (the second map in Decisions),
    `HistoryObjectType` (`{ values, schema }`, the registry's keys as a `z.enum`, in the same
    shape as `LogObjectType` in `src/lib/schemas/log-entry.ts`), and
    `ObjectHistoryEntry.schema`: `{ id, sequence, action: string, objectType: string,
objectId, relation: "primary" | "related", actorName: string | null, impersonatorName:
string | null, operationLabel: string | null, description: string | null, timestamp:
Date, changes: DiffChange[], refs: ObjectHistoryRef[] }`. `ObjectHistoryRef` is a
    discriminated union on `objectType`: `{ objectType: "Person", role: string, person:
PersonRef | null }`, `{ objectType: "Team", role: string, team: TeamRef | null }`
    (`PersonRef`/`TeamRef` from their schema files, so the refs go straight into
    `PersonLink`/`TeamLink` with no casts), and a fallback `{ objectType: string (not
Person/Team), role: string, objectId: string }`. A `null` person/team means it was purged
    or isn't viewable, and renders as plain text, not a link. Also `ObjectHistoryPage.schema`
    `{ entries, nextCursor: number | null }`. In the service (`import "server-only"`, a
    context of `Pick<OrgServiceContext, "prisma" | "organizationId">`, following
    `src/server/services/CLAUDE.md`): `list(ctx, { objectType, objectId, relatedTypes,
cursor?, limit })` → one `logEntry.findMany` (filter `organizationId`, `objects: { some:
… }`, and `OR: [{ objectType, objectId }, { objectType: { in: relatedTypes } }]` plus
    unmapped types, so only allowed related entries come back; `sequence < cursor` when given,
    `orderBy: { sequence: "desc" }`, `take: limit + 1`, `select` user/impersonator `name`,
    batch `operationKey`, `objects`). Express "unmapped types pass" as
    `relatedTypes = allowed mapped types ∪ LogObjectType.values not in RelatedEntryPermissions`,
    computed by the router, so the service just takes a list. Then resolve `Person`/`Team`
    ref names in at most two `findMany`s scoped to the org, only for types in `relatedTypes`
    (`Person`/`Team` are mapped, so a caller without `team:view` gets `team: null`),
    excluding the page's own object. Derive `relation` from whether the entry's own
    `objectType`/`objectId` is the object asked for; `refs` excludes the asked-for object and
    the entry's own primary row. Put the actor/label fallbacks, the lenient parsing and the
    `sequence` paging caveat in JSDoc. Use prisma-mock per `.claude/rules/testing.md`.
  - **Done when:** tests cover primary vs related entries, a related entry of a type not in
    `relatedTypes` being excluded, the org filter being present, the cursor/`nextCursor`
    boundary (exactly `limit`, `limit + 1` rows), a null `userId` falling back to the stripped
    `actorLabel`, the impersonator and batch label, ref name resolution (resolved, purged →
    null, not viewable → null), and malformed `changes` → `[]`; `npm run check` passes.

- [x] **3. `history.listObjectHistory` procedure** — `feat(history): add history.listObjectHistory procedure` + `fix(history): gate related registry types by their page permission`
  - **Files:** `src/trpc/routers/history-router.ts` (new), `src/trpc/routers/history-router.test.ts`
    (new), `src/trpc/routers/_app.ts`.
  - **Do:** `historyRouter` with `listObjectHistory: organizationProcedure()` → input
    `{ objectType: HistoryObjectType.schema, objectId: z.string().min(1), cursor:
z.number().int().optional(), limit: z.number().int().min(1).max(100).default(50) }`, output
    `ObjectHistoryPage.schema`. It awaits
    `ctx.hasPermission(input.organizationId, HistoryObjects[input.objectType].permissions)`
    (precedent: `organizations-router.ts`, the `member: ["owner"]` check). Then it computes
    `relatedTypes` with a file-local `canView` (a `hasPermission` wrapper that returns
    `false` on a `FORBIDDEN` `TRPCError` and rethrows anything else), checked once per
    `RelatedEntryPermissions` entry, run in parallel. Then it calls `ObjectHistory.list`.
    Register as `history` in `_app.ts`, in alphabetical order with the rest. Follow
    `src/trpc/CLAUDE.md`. The input must be named `cursor` for `infiniteQueryOptions` to work.
  - **Done when:** router tests (`createCaller` contexts per `.claude/rules/testing.md`) show
    a `member` can read `Person` history but is refused `D4HAccessToken` history, an admin
    can read both, an off-registry `objectType` is rejected by input validation, a caller with
    `person:view` but not `member:view` (e.g. `skills-assessor`) passes a `relatedTypes`
    without `OrganizationMembership`, and one without `team:view` (`i3-editor`) passes one
    without `TeamMembership`/`Team`; `npm run check` passes.

- [x] **4. `ObjectHistory` component and the Person history page** — `feat(history): add ObjectHistory component and the Person history page` + `fix(history): address review of the ObjectHistory component` · `visual`
  - **Files:** `src/components/history/object-history.tsx` (new), `src/trpc/server.tsx`
    (add `prefetchInfinite`), `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/personnel/[person_id]/history/page.tsx`
    (rewrite), `src/components/admin/personnel/person-history-content.tsx` (new),
    `src/components/admin/personnel/person-menu.tsx`.
  - **Do:** `<ObjectHistory objectType objectId />`, a client component using
    `useSuspenseInfiniteQuery(trpc.history.listObjectHistory.infiniteQueryOptions({ organizationId,
objectType, objectId }, { getNextPageParam: (p) => p.nextCursor ?? undefined }))`,
    rendering the layout in Decisions, with changes rendered through `describeChange` (passing
    `FieldLabels[entry.objectType]` and `usePreferences().display`).
    Resolved `Person`/`Team` refs render as `PersonLink`/`TeamLink` (`docs/patterns/entity-link.md`).
    `prefetchInfinite` mirrors `prefetch`. Rewrite the person history page into the
    server `page.tsx` + client `…-content.tsx` split per
    `docs/patterns/detail-page-data-fetching.md` (`generateMetadata` title
    `"<name> History ⋅ Personnel"`, prefetch `getPerson` + the first history page with the
    same input the client uses), with the same breadcrumbs the stub has.
    `AdminModule_PersonMenu` already has a History item in `EntityActionMenu`'s `before` slot,
    marked `disabled`; remove `disabled`.
  - **Done when:** `npm run check` passes; in the browser, a person with create + update +
    membership history shows all three, newest first, with readable changes, and no "Load
    more" button (the `limit`/`limit + 1` boundary itself is covered by task 2's test).

- [x] **5. Team and D4H access token history pages** — `feat(history): add Team and D4H access token history pages` · `visual`
  - **Files:** `…/orgs/[slug]/admin/teams/[team_id]/history/page.tsx` (new),
    `src/components/admin/teams/team-history-content.tsx` (new),
    `src/components/admin/teams/team-menu.tsx`,
    `…/orgs/[slug]/admin/d4h-access-tokens/[token_id]/history/page.tsx` (new),
    `src/components/admin/d4h-access-tokens/access-token-history-content.tsx` (new, in a new
    folder, where
    `detail-page-data-fetching.md` puts content components; the existing
    `access-token-content.tsx` beside its route is drift, left alone here),
    `…/admin/d4h-access-tokens/[token_id]/access-token-content.tsx`.
  - **Do:** Same page/content shape as task 4, with breadcrumbs extending the detail page's
    own. The token pages keep `requireOrganizationWith(slug, { organization: ["update"] })`
    like their siblings. Team: a History item in `AdminModule_Team_Menu`, through
    `EntityActionMenu`'s `before` prop (the menu already uses `after` for D4H actions), copied
    from `person-menu.tsx`'s item without `disabled`. Token (no menu): a
    ghost icon `Button asChild` wrapping a `Link` with `ObjectIcons.History` and an accessible
    label "History", in `Saratoga.Actions` before the refresh button, inside the same
    `<Protect permissions={{ organization: ["update"] }}>`. Run `npx next typegen` after adding
    the pages.
  - **Done when:** `npm run check` passes; both pages render their entries in the browser, and
    a Team's history shows membership entries from the fan-out.

- [x] **6. Skill package and skill check session history pages** — `feat(history): add skill package and skill check session history pages` + `refactor(history): build the session menu on EntityActionMenu` · `visual`
  - **Files:** `src/components/skill-package-builder/package-history-content.tsx`,
    `…/skill-package-builder/packages/[package_id]/history/page.tsx`,
    `src/components/skill-package-builder/package-menu.tsx`,
    `…/skill-track/sessions/[session_id]/history/page.tsx` (new),
    `src/components/skill-track/session-history-content.tsx` (new),
    `src/components/skill-track/session-menu.tsx`.
  - **Do:** Replace `<NotImplemented />` in `package-history-content.tsx` with `<ObjectHistory
objectType="SkillPackage" …>`, add the history prefetch to its page, and remove `disabled`
    from the package menu's History item. Session: a new page + content like task 4, and a History
    item in `SkillsModule_SessionMenu` (it doesn't use `EntityActionMenu`, so add a
    `DropdownMenuItem asChild` + `Link` group above its existing items, matching
    `package-menu.tsx`). Run `npx next typegen`
    after adding the session page.
  - **Done when:** `npm run check` passes; both pages render in the browser, and the package
    menu's History item is enabled and navigates.

## Out of scope

- **Write-side gaps.** `Skill`/`SkillGroup` entries don't carry a `context` ref to their
  `SkillPackage`, so a package's history shows package-level events only, not edits to its
  skills. Adding those refs (and any other missing ones) belongs to #47; existing rows
  wouldn't gain them anyway. #46 (logging `SkillCheck`/`FormInstance`) likewise.
- An org-wide activity feed (`/orgs/[slug]/admin/activity`), and the user-scope and
  system-scope logs. `objectTypesForModule` in `log-entry.ts` is ready for a module feed later.
- History for other detail pages (i3 templates, team memberships, users, skill groups/skills).
  Adding one is a registry entry plus a page.
- Filtering or searching within a history page.
- End-user docs (`content/docs/**`) for the History pages.
