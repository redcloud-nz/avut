# Skill Track → standard detail-page data-fetching pattern

**Goal:** Bring every `skill-track` page that shows a single entity (package,
person report, session, and the six session sub-pages) in line with
`docs/patterns/detail-page-data-fetching.md`: thin server `page.tsx` shells
that `prefetch`, `"use client"` content components that own `useSuspenseQuery`
and `Std.Navbar`/`Std.ScrollContainer`, content components relocated to
`src/components/skill-track/`. Applies the precedent already established for
`admin/teams` and `skill-package-builder`.

**Non-goal:** the index/list pages (`skill-track/page.tsx`,
`catalogue/page.tsx`, `checks/page.tsx`, `reports/page.tsx`,
`reports/person/page.tsx`, `sessions/page.tsx`) already match the pattern —
thin server shell delegating to a list component that owns its own query. Not
touched by this work, beyond one relocation noted below.

---

## Router change

Add `skills.getPackage` to `skills-router.ts` (alphabetically, immediately
before `getSession`), single-entity, permission-gated
`skillPackageSubscription: ["view"]`, mirroring one entry's shape from the
existing `listPackages`:

```ts
getPackage: organizationProcedure({ skillPackageSubscription: ["view"] })
    .input(z.object({ skillPackageId: SkillPackageId.schema }))
    .output(
        SkillPackage.schema.extend({
            organization: z.object({ id: z.string(), name: z.string() }),
            subscription: SkillPackageSubscription.schema.nullable(),
            skillCount: z.number(),
            subscriptionCount: z.number(),
        }),
    )
    .query(...) // throws NOT_FOUND if the package isn't published or doesn't exist
```

Replaces the `catalogue/[package_id]` page's current `listPackages` +
`.find()` anti-pattern. `subscribe-package.tsx` / `unsubscribe-package.tsx`
mutations gain a `setQueryData` write on the new `getPackage` key (alongside
their existing `listPackages` invalidation) so the detail page reflects
subscribe/unsubscribe without a refetch.

Gets a router test mirroring the `skill-package-builder-router` precedent
(found package, NOT_FOUND for unpublished/other-org package).

---

## Page-by-page plan

All content components move to `src/components/skill-track/`, flat, named
`<page>-content.tsx`.

| Page                              | New content component                                                          | `generateMetadata`                                                                             | Notes                                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalogue/[package_id]`          | `catalogue-package-content.tsx`                                                | Yes — package name                                                                             | Was fully `"use client"`, no server shell at all. Now uses `getPackage`.                                                                                           |
| `reports/person/[person_id]`      | _(unchanged location)_ `reports/person-competency-report.tsx`                  | No — static title already (`"Personnel Competency"`), matches the doc's static-title exception | Add `prefetch(getCompetencyMatrix)`; move `Std.Navbar` into the content component for consistency; switch `person_id as PersonId` cast to `PersonId.schema.parse`. |
| `sessions/[session_id]`           | `session-content.tsx` (moved out of the route folder, replacing `content.tsx`) | Yes — session name (already has this)                                                          | Drop the `resolveSession` shared-helper/prop-drilling shape; content component reads `getSession` itself via `useSuspenseQuery` instead of receiving it as a prop. |
| `sessions/[session_id]/skills`    | `session-skills-content.tsx`                                                   | Yes — session name                                                                             |                                                                                                                                                                    |
| `sessions/[session_id]/personnel` | `session-personnel-content.tsx`                                                | Yes — session name                                                                             |                                                                                                                                                                    |
| `sessions/[session_id]/checks`    | `session-checks-content.tsx`                                                   | Yes — session name                                                                             |                                                                                                                                                                    |
| `sessions/[session_id]/review`    | `session-review-content.tsx`                                                   | Yes — session name                                                                             |                                                                                                                                                                    |
| `sessions/[session_id]/by-skill`  | `session-by-skill-content.tsx`                                                 | Yes — session name                                                                             |                                                                                                                                                                    |
| `sessions/[session_id]/by-person` | `session-by-person-content.tsx`                                                | Yes — session name                                                                             |                                                                                                                                                                    |

Every `page.tsx` becomes an async server shell: `requireOrganization`, parse
the id(s) with the relevant branded schema, `prefetch(...)` everything the
content component needs (see redundancy table below), render:

```tsx
<HydrateClient>
  <Std.SidebarInset>
    <Content ... />
  </Std.SidebarInset>
</HydrateClient>
```

No `<Suspense>` wrapper — `Std.SidebarInset` already provides one.

---

## Redundant prefetch

The parent `sessions/[session_id]` page's content
(`SkillsModule_Session_Contents_Card` in `session-contents.tsx`) already
fetches, in addition to `getSession`:

- `skillChecks.listSkillChecks({ organizationId, sessionId })` — no `scope`,
  no `ownChecksOnly`
- `skills.listSessionAssessees({ organizationId, sessionId, scope: "assigned" })`
- `skills.listSessionSkills({ organizationId, sessionId, scope: "assigned" })`

A sub-page's server `prefetch` is redundant only when its query key matches
one of these **exactly** (procedure + all params, since `scope` /
`ownChecksOnly` are part of the key). Verified per sub-page:

| Sub-page      | Prefetch (new)                                                                                                                                         | Skip (already warm from parent)                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **skills**    | `listAssessableSkills`                                                                                                                                 | `listSessionSkills(scope: "assigned")`                          |
| **personnel** | `teams.listTeams`, `teams.listTeamMemberships`                                                                                                         | `listSessionAssessees(scope: "assigned")`                       |
| **checks**    | `listSessionAssessees(scope: "all")`, `listSessionAssessors(scope: "all")`, `listSessionSkills(scope: "all")`                                          | `listSkillChecks({ sessionId })`                                |
| **review**    | same three `scope: "all"` queries as checks                                                                                                            | `listSkillChecks({ sessionId })`                                |
| **by-skill**  | `personnel.getPersonSelf`, `listAssessableSkills`, `listSkillChecks({ sessionId, ownChecksOnly: true })` (different key from parent's — not redundant) | `listSessionAssessees(assigned)`, `listSessionSkills(assigned)` |
| **by-person** | same as by-skill                                                                                                                                       | same as by-skill                                                |

`getSession` is fetched once per page via `generateMetadata` (needed for the
dynamic title) and reused for free by the body `prefetch` call (same
request-scoped query client, cache hit) — no special-casing needed.

Content components still call `useSuspenseQuery` for the "skip" queries —
they're simply not server-prefetched. On direct URL load (no parent visit),
they fall back to a real client fetch instead of SSR-hydrated data; accepted
tradeoff.

---

## Testing / validation

- New: router test for `skills.getPackage` (found + NOT_FOUND cases),
  following the `skill-package-builder-router.test.ts` shape.
- No other new business logic — this is a structural move. Validate with
  `npx tsc --noEmit`, `npm run lint`, and a manual smoke pass per page once
  the user's dev server is confirmed running: page loads, tab title correct,
  breadcrumb correct, mutations (subscribe/unsubscribe, session update,
  approve session, etc.) update the page in place without a full reload.

---

## Out of scope

- Any visual/spacing changes (already done in a prior session).
- The list-style pages already on-pattern.
- `assessment-row.tsx` and other shared display components — unchanged.
