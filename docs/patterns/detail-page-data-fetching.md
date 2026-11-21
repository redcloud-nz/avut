# Pattern: entity detail pages (id-keyed, dynamic title)

How `/orgs/[slug]/admin/teams/[team_id]` and `/orgs/[slug]/admin/personnel/[person_id]`
fetch and render data. Use this for any route that shows a single record by id, needs
that record's name in `generateMetadata`, and has update mutations that should be
reflected on screen without a full navigation.

---

## Problem this replaces

The original shape had `page.tsx` `fetchQuery` the entity once, share it between
`generateMetadata` and the page body via a helper, and pass it down to `content.tsx` as
a prop. That works for the title, but it means the rendered page is a server snapshot:
a mutation's `onSuccess` had to both write the query cache (for anything reading via
`useQuery`/`useSuspenseQuery` elsewhere) _and_ call `router.refresh()` to get the
server-rendered prop to update — two invalidation paths doing the same job.

The pattern below fetches the title-critical data once (in `generateMetadata`), and
lets the client own the query for everything the page renders, including that same
entity. A mutation only needs to write/invalidate the query cache; the render updates
on its own.

---

## File layout

```
src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/teams/[team_id]/page.tsx   # route shell only
src/modules/org-admin/components/teams/team-content.tsx                         # "use client", all rendering
```

The route folder holds only `page.tsx`. The content component lives in its module, under
`src/modules/<module-id>/components/<domain>/` (AGENTS.md → Modules), named
`<entity>-content.tsx`, alongside the other components for that domain (menus, dialogs,
cards) — not in the route folder. This mirrors where every other page-specific
component for a domain already lives, and means the route folder stays a thin routing
artifact.

---

## `page.tsx`

```tsx
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, team_id } = await props.params;
  const organization = await getOrganizationBySlug(slug);

  const teamId = TeamId.schema.parse(team_id);
  const team = await fetchQuery(
    trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
  );

  return { title: `${team.name} ${TITLE_SEPARATOR} Teams` };
}

export default async function AdminModule_Team_Page(props: Props) {
  const { slug, team_id } = await props.params;
  const organization = await getOrganizationBySlug(slug);

  const teamId = TeamId.schema.parse(team_id);

  prefetch(trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }));

  return (
    <HydrateClient>
      <Std.ScrollContainer>
        <AdminModule_Team_Content teamId={teamId} />
      </Std.ScrollContainer>
    </HydrateClient>
  );
}
```

Key points:

- **Both `trpc` calls here are the `@/trpc/server` one** — it calls the router
  in-process, preserving the request's session; the `@/trpc/client` one exists for
  Client Components only. On the server it fails every call rather than fetch without the
  session, so a client component's `useSuspenseQuery` only renders on the server from
  data prefetched here.
- **No permission check in `page.tsx`.** `getOrganizationBySlug` only resolves the org's
  id; `teams.getTeam` checks the caller. See
  [`route-access-control.md`](route-access-control.md) for why, and for the one case
  (a read outside tRPC) that needs a check here.
- **`generateMetadata` and the page body each resolve independently.** No shared
  `resolveX` helper. `generateMetadata` uses `fetchQuery` (awaited) because it needs
  the value synchronously to build the title. The page body only needs the parsed id —
  it never reads the fetched entity itself.
- **The page body only ever calls `prefetch`, never `fetchQuery`,** for data the
  content component will read via `useSuspenseQuery`. This includes re-`prefetch`ing
  the _same_ query `generateMetadata` already resolved — cheap, since both calls share
  the same request-scoped query client (`getServerQueryClient`, `React.cache`d), so
  it's a cache hit rather than a second round trip. `prefetch` is fire-and-forget and
  never throws (see `src/trpc/server.tsx`); `fetchQuery` awaits and translates
  `TRPCError` codes into Next's `notFound()`/`forbidden()` interrupts — that's still
  worth having run once, via the metadata call.
- **Secondary data the content component needs but that isn't title-critical** (e.g.
  `personnel.getLinkedUser`, `teams.listTeamMemberships`) is `prefetch`-only, never
  awaited in `page.tsx` at all.
- **`page.tsx` renders `Std.ScrollContainer`, and nothing else of the shell.** The
  authenticated layout already renders `Std.SidebarInset` and the one navbar
  (`AppNavbar`), so a page renders neither, and there's no page-level navbar or
  breadcrumb strip: the trail is part of the page body (see
  [Page shell](#page-shell-scrollcontainer-and-the-trail)).
- **No `<Suspense>` wrapper here.** `Std.ScrollContainer` wraps its children in its own
  `<Suspense>` (a spinner inside the scroll area), so when the content component suspends,
  the navbar and page background are already up and only the scroll area waits. Behind
  it, `Std.SidebarInset`'s `<Suspense fallback={<PageLoadingSpinner />}>` catches anything
  that suspends outside a `ScrollContainer` (see `src/components/blocks/std.tsx`). Don't
  add a third.

### Variant: full-height pages (`Glorious` reports and matrices)

The skill-track reports (`skill-track/reports/*`) and the I3 bundle matrix render a
`Glorious.Root`, which fills the page column and scrolls inside its own
`Glorious.ScrollFrame`. They render **no `Std.ScrollContainer`**: the component goes
straight under `HydrateClient`. The reports wrap it in their own
`<Suspense fallback={<PageLoadingSpinner />}>` so the full-height layout gets a
full-height fallback; keep it where it's already there.

```tsx
<HydrateClient>
  <Suspense fallback={<PageLoadingSpinner />}>
    <SkillTrack_SkillMatrixReport
      syntheticChecksEnabled={syntheticChecksEnabled}
      breadcrumbs={[
        { label: "Reports", href: route("/orgs/[slug]/skill-track/reports", { slug }) },
      ]}
    />
  </Suspense>
</HydrateClient>
```

The reports' trail is static (their scope comes from a `?…=` search param, not a path
segment), so `page.tsx` passes it as a `breadcrumbs` prop and the report renders it with
`Glorious.Breadcrumbs`, first in `Glorious.Header`, in **every** branch that renders a
header (the scope picker and the matrix). A Glorious component that reads the record its
trail names (the I3 bundle matrix names its bundle) builds the trail itself instead.

---

## `<entity>-content.tsx`

```tsx
"use client";

export function AdminModule_Team_Content({ teamId }: { teamId: TeamId }) {
  const organization = useOrganization();

  const { data: team } = useSuspenseQuery(
    trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
  );

  return (
    <Saratoga.Root>
      <Saratoga.Breadcrumbs
        items={[
          { label: "Teams", href: route("/orgs/[slug]/admin/teams", { slug: organization.slug }) },
        ]}
      />
      <Saratoga.Header>
        <Saratoga.Title>{team.name}</Saratoga.Title>
        {/* ... */}
      </Saratoga.Header>
      {/* ... */}
    </Saratoga.Root>
  );
}
```

Key points:

- **Reads everything via `useSuspenseQuery`** (or `useSuspenseQueries` for more than
  one — see the personnel page, which combines `getPerson` and `getLinkedUser`). No
  props carry entity data in; only the id(s) needed to build the query key.
- **Renders only the page body**, starting at `Saratoga.Root`: no `Std.ScrollContainer`
  (that's `page.tsx`'s) and no navbar (that's the layout's).
- **Owns the trail.** `Saratoga.Breadcrumbs` comes first inside `Saratoga.Root`. When the
  trail names a fetched record (the record's name on its History page), it's read from
  the same `useSuspenseQuery` call as everything else on the page, so a cache write
  updates it along with the rest of the content. The suspense point is at the top of this
  component, before any JSX is produced, so the whole body, trail included, suspends
  together, and `Std.ScrollContainer`'s boundary in `page.tsx` catches it.
- Organization id and slug come from `useOrganization()`, not from props — `page.tsx`
  only passes the route param(s) it can't get any other way (e.g. `teamId`).

---

## Page shell: `ScrollContainer` and the trail

How a page that rendered its own navbar (the old `Navbar` member of `Std`, since removed,
written `<Navbar …>` in the "before" snippets below) was converted to the current shape.
Every page is converted now; the steps stay as a reference for the shape.
Apply it to the page **and** to the content, list and Glorious components it renders.

1. **Delete the navbar.** Remove the navbar element, wherever it's rendered (`page.tsx`
   or a component), and any `<>…</>` fragment it leaves around a single child.
2. **Build the trail from its `breadcrumbs`.** The trail is the record hierarchy above
   the page: today's `breadcrumbs` **minus the first entry** (the module, such as
   "Admin", "Skill Track", "D4H" or "System Admin", which the sidebar already shows)
   **and minus the last** (the page itself, which its `<h1>` already names). So a person
   shows `Personnel`, a person's History `Personnel › Aaron Gray`, a session's By Person
   page `Sessions › Session #2`. Every crumb is a link, so for each remaining entry that
   is a bare string or has no `href`:
   - "User Settings" (`d4h-access-token-content.tsx`, `organization-content.tsx`): drop
     it. There's no `/user/settings` page.
   - "Access Tokens": drop it. It would link to `/user/settings/d4h`, the same page as
     the `D4H` crumb before it.
   - Skill Package Builder "Groups" and "Skills" (the group and skill pages and their
     History pages): drop them. Neither has an index page.
   - Any other: drop it, and list it in your commit body.

   If nothing is left, the page is at its module's top level (a module root, or a module
   list like Personnel, Sessions or Teams) and has no trail: render no `Breadcrumbs`
   and pass no prop.

   **Retitle to fit the trail.** The trail names the parent records, so the `<h1>` says
   what this page is, not which record it belongs to:
   - A History page is titled "`<Record type>` History" ("Team History", "Person
     History", "Session History"), not "`<name>` — History".
   - A page that's one of a record's related items (a team membership) takes that item's
     own name (the person's name), not its type ("Team Membership").

   Exceptions are decided case by case and listed in the app-frame plan
   (`docs/plans/2026-11-21-app-frame.md` → Decisions). So far there is one: a note keeps
   its "Notes" crumb, the way back to the list on phones, where Hermes hides the list
   pane.

3. **Place the trail** by the page's shape (table below).
4. **Move `Std.ScrollContainer` into `page.tsx`**, around the component that rendered it,
   and delete it from the component. A `page.tsx` that renders its own `Std.SidebarInset`
   (the playground pages) drops that too: the layout renders it. Glorious and Hermes
   pages render no `ScrollContainer`, before or after.
5. **Tidy imports:** `Std` (unused in the component now, newly needed in `page.tsx`),
   `route` (often unused in an index or single-crumb `page.tsx` now), and
   `type SaratogaBreadcrumb` from `@/components/blocks/saratoga` where you add a prop.

| Page shape                                                               | Trail                                                                                                                                                                                                                             | `Std.ScrollContainer`                                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Content component owns `Saratoga.Root`                                   | `<Saratoga.Breadcrumbs items={[…]} />` first inside `Saratoga.Root`, in the content component                                                                                                                                     | `page.tsx`                                                              |
| List component owns `Saratoga.Root`; the trail is static                 | None for a top-level list. Otherwise the list component takes `breadcrumbs?: SaratogaBreadcrumb[]` and renders `{breadcrumbs && <Saratoga.Breadcrumbs items={breadcrumbs} />}` first inside `Saratoga.Root`; `page.tsx` passes it |
| List component owns `Saratoga.Root` and reads the record its trail names | `<Saratoga.Breadcrumbs items={[…]} />` first inside `Saratoga.Root`, in the list component, as for a content component                                                                                                            | `page.tsx`                                                              |
| History page                                                             | The `breadcrumbs` prop on `ObjectHistory`, ending with the record                                                                                                                                                                 | `page.tsx`                                                              |
| `Glorious`                                                               | `<Glorious.Breadcrumbs items={…} />` first inside `Glorious.Header`, in every branch with a header; a static trail arrives as a `breadcrumbs` prop from `page.tsx`                                                                | none                                                                    |
| `Hermes` (notes)                                                         | Detail pane only, from `notesBreadcrumbs()` (`src/components/notes/notes-breadcrumbs.ts`); none on the list pane or the index route                                                                                               | none                                                                    |
| `Std.IndexPage`                                                          | None                                                                                                                                                                                                                              | `page.tsx` (unchanged)                                                  |
| No Saratoga or Glorious header (a bare `Card`)                           | `<Saratoga.Breadcrumbs items={…} className="mb-2" />` directly above the content                                                                                                                                                  | `page.tsx`                                                              |
| Playground                                                               | None                                                                                                                                                                                                                              | `page.tsx`                                                              |
| The `ScrollContainer` `className` depends on the data                    | As for the page's shape                                                                                                                                                                                                           | `page.tsx`, plain; the content renders an inner wrapper for that branch |

### Before/after: content component owns `Saratoga.Root`

Before (`person-content.tsx`):

```tsx
return (
  <>
    <Navbar
      breadcrumbs={[
        { label: "Admin", href: route("/orgs/[slug]/admin", { slug: organization.slug }) },
        {
          label: "Personnel",
          href: route("/orgs/[slug]/admin/personnel", { slug: organization.slug }),
        },
        person.name,
      ]}
    />
    <Std.ScrollContainer>
      <Saratoga.Root>
        <Saratoga.Header>
          <Saratoga.Title>{person.name}</Saratoga.Title>
        </Saratoga.Header>
        {/* ... */}
      </Saratoga.Root>
    </Std.ScrollContainer>
  </>
);
```

After:

```tsx
return (
  <Saratoga.Root>
    <Saratoga.Breadcrumbs
      items={[
        {
          label: "Personnel",
          href: route("/orgs/[slug]/admin/personnel", { slug: organization.slug }),
        },
      ]}
    />
    <Saratoga.Header>
      <Saratoga.Title>{person.name}</Saratoga.Title>
    </Saratoga.Header>
    {/* ... */}
  </Saratoga.Root>
);
```

and `page.tsx` goes from
`<HydrateClient><AdminModule_Person_Content personId={personId} /></HydrateClient>` to:

```tsx
<HydrateClient>
  <Std.ScrollContainer>
    <AdminModule_Person_Content personId={personId} />
  </Std.ScrollContainer>
</HydrateClient>
```

### Before/after: a list component

Before (`admin/personnel/page.tsx`):

```tsx
<HydrateClient>
  <>
    <Navbar
      breadcrumbs={[
        { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
        { label: "Personnel", href: route("/orgs/[slug]/admin/personnel", { slug }) },
      ]}
    />
    <Std.ScrollContainer>
      <AdminModule_Personnel_List organization={organization} />
    </Std.ScrollContainer>
  </>
</HydrateClient>
```

After: Personnel is at the Admin module's top level, so once "Admin" (the module) and
"Personnel" (the page) go, nothing is left. The page has no trail, the list takes no
prop, and `route` drops out of `page.tsx`:

```tsx
<HydrateClient>
  <Std.ScrollContainer>
    <AdminModule_Personnel_List organization={organization} />
  </Std.ScrollContainer>
</HydrateClient>
```

A list **below** its module's top level does have a trail. When the trail is static,
the list component takes it as a prop, and `page.tsx` passes it:

```tsx
import { Saratoga, type SaratogaBreadcrumb } from "@/components/blocks/saratoga";

interface SomeListProps {
  /** The page's ancestors, shown above the title. */
  breadcrumbs?: SaratogaBreadcrumb[];
}

// ...
<Saratoga.Root>
  {breadcrumbs && <Saratoga.Breadcrumbs items={breadcrumbs} />}
  <Saratoga.Header>{/* ... */}</Saratoga.Header>
```

When the trail names a record the list reads anyway, the list builds it, as a content
component does. A team's members list (`team-members-list.tsx`) shows `Teams › <team>`:

```tsx
<Saratoga.Root>
  <Saratoga.Breadcrumbs
    items={[
      { label: "Teams", href: route("/orgs/[slug]/admin/teams", { slug: organization.slug }) },
      {
        label: team.name,
        href: route("/orgs/[slug]/admin/teams/[team_id]", {
          slug: organization.slug,
          team_id: teamId,
        }),
      },
    ]}
  />
  <Saratoga.Header>
    <Saratoga.Title>Members of {team.name}</Saratoga.Title>
```

A list component that renders more than one `Saratoga.Root` (an empty or error branch,
say) renders the trail in each.

### Before/after: a History page (`ObjectHistory`)

Before (`person-history-content.tsx`):

```tsx
<>
  <Navbar
    breadcrumbs={[
      { label: "Admin", href: route("/orgs/[slug]/admin", { slug: organization.slug }) },
      {
        label: "Personnel",
        href: route("/orgs/[slug]/admin/personnel", { slug: organization.slug }),
      },
      {
        label: person.name,
        href: route("/orgs/[slug]/admin/personnel/[person_id]", {
          slug: organization.slug,
          person_id: personId,
        }),
      },
      "History",
    ]}
  />
  <Std.ScrollContainer>
    <ObjectHistory objectType="Person" objectId={personId} title={`${person.name} — History`} />
  </Std.ScrollContainer>
</>
```

After (the first entry, "Admin", and the last, "History", go; the record stays as the
last ancestor):

```tsx
<ObjectHistory
  objectType="Person"
  objectId={personId}
  title={`${person.name} — History`}
  breadcrumbs={[
    {
      label: "Personnel",
      href: route("/orgs/[slug]/admin/personnel", { slug: organization.slug }),
    },
    {
      label: person.name,
      href: route("/orgs/[slug]/admin/personnel/[person_id]", {
        slug: organization.slug,
        person_id: personId,
      }),
    },
  ]}
/>
```

`page.tsx` then wraps the History content in `Std.ScrollContainer`, as above. The
`scope="own"` (user-scope) form of `ObjectHistory` takes the same prop.

### Before/after: a `Glorious` page

Before (`skill-track/reports/matrix/page.tsx`):

```tsx
<HydrateClient>
  <>
    <Navbar
      breadcrumbs={[
        { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
        { label: "Reports", href: route("/orgs/[slug]/skill-track/reports", { slug }) },
        {
          label: "Personnel × Skill Matrix",
          href: route("/orgs/[slug]/skill-track/reports/matrix", { slug }),
        },
      ]}
    />
    <Suspense fallback={<PageLoadingSpinner />}>
      <SkillTrack_SkillMatrixReport syntheticChecksEnabled={syntheticChecksEnabled} />
    </Suspense>
  </>
</HydrateClient>
```

After: the trail keeps only "Reports" ("Skill Track" is the module, and the report is
the page). `page.tsx` is the one shown under
[full-height pages](#variant-full-height-pages-glorious-reports-and-matrices) (a
`breadcrumbs` prop, still no `ScrollContainer`), and the report renders the trail in both
branches:

```tsx
export function SkillTrack_SkillMatrixReport({
  syntheticChecksEnabled,
  breadcrumbs,
}: {
  syntheticChecksEnabled: boolean;
  /** The page's ancestors, shown above the title. */
  breadcrumbs?: SaratogaBreadcrumb[];
}) {
  // ...
  if (!team) {
    return (
      <Glorious.Root className="mx-auto w-full max-w-4xl">
        <Glorious.Header>
          {breadcrumbs && <Glorious.Breadcrumbs items={breadcrumbs} />}
          <Glorious.Title>Personnel × Skill Matrix Report</Glorious.Title>
          {/* ... */}
        </Glorious.Header>
      </Glorious.Root>
    );
  }
  return <SkillMatrixReportView /* ... */ breadcrumbs={breadcrumbs} />;
}

// in SkillMatrixReportView
<Glorious.Root>
  <Glorious.Header>
    {breadcrumbs && <Glorious.Breadcrumbs items={breadcrumbs} />}
    <Glorious.Title>Personnel × Skill Matrix Report</Glorious.Title>
```

### Before/after: `Std.IndexPage`

An index page just drops its navbar (and the `route` import, if that was its only use):

```tsx
// Before
<>
  <Navbar breadcrumbs={["Admin"]} />
  <Std.ScrollContainer>
    <Std.IndexPage title="Admin Module">{/* ... */}</Std.IndexPage>
  </Std.ScrollContainer>
</>

// After
<>
  <Std.ScrollContainer>
    <Std.IndexPage title="Admin Module">{/* ... */}</Std.IndexPage>
  </Std.ScrollContainer>
</>
```

### A data-dependent `ScrollContainer` `className`

The two session recording pages rendered `<Std.ScrollContainer className="flex">` only in
their approved branch, so the empty state centres in the scroll area. `page.tsx` can't
know which branch the content takes, so it renders a plain `Std.ScrollContainer`, and in
that branch the content renders a full-height column, with the trail above the empty
state (`session-by-person-content.tsx`):

```tsx
if (isApproved) {
  return (
    // Fills the scroll area, so the empty state centres below the trail.
    <div className="flex min-h-full flex-col">
      <Saratoga.Root>{breadcrumbs}</Saratoga.Root>
      <SkillTrack_SessionApprovedEmpty sessionId={sessionId} />
    </div>
  );
}
```

Here `breadcrumbs` is the `<Saratoga.Breadcrumbs items={…} />` element, built once and
shared by both branches.

---

## Mutations

```tsx
const mutation = useMutation(
  trpc.teams.updateTeam.mutationOptions({
    meta: { effects: teamsEffects.updateTeam },
    async onSuccess() {
      toast.success("Team updated");
    },
  }),
);
```

```ts
// src/client/teams-effects.ts
export const teamsEffects = createEffects<"teams">()({
  updateTeam: (vars, { updated }) => [
    write(
      trpc.teams.getTeam.queryKey({ organizationId: vars.organizationId, teamId: vars.teamId }),
      updated,
    ),
    invalidate(trpc.teams.listTeams.queryFilter({ organizationId: vars.organizationId })),
  ],
});
```

- `meta.effects` (`src/trpc/mutation-effector.tsx`) replaces manual
  `queryClient.setQueryData`/`invalidateQueries` calls in `onSuccess` — declared once per
  procedure in `src/client/<domain>-effects.ts` via `createEffects<"router">()({...})`,
  not repeated at each call site.
- `write(queryKey, data)` writes the mutation's response straight into the cache the
  content component reads from — use it when the response _is_ the detail query's full
  new value (as `updateTeam`'s is here). No `router.refresh()` needed — `useSuspenseQuery`
  picks up the write on its own.
- `invalidate(filter)` covers queries the response can't fully determine, typically
  list-level ones (e.g. `listTeams` after an update that might affect a column shown in
  the list). If a mutation's response doesn't carry the full updated entity, `invalidate`
  the detail query too instead of (or alongside) `write`, so it refetches.

---

## When _not_ to use this

If a detail page's title doesn't need the entity's name (a static title is fine), skip
`generateMetadata`'s extra `fetchQuery` — see the "static/generic title" convention
used by list-style pages (e.g. `skill-track/packages/page.tsx`:
`` `Packages ${TITLE_SEPARATOR} Skill Track` ``). In that case the page body's
`prefetch` calls are the only server-side data touch needed.

## Pages that host `?action=` dialogs

Use this split (a server `page.tsx` and a `<entity>-content.tsx`) for any detail page that
hosts `?action=` dialogs. A client `page.tsx` that reads route params with
`use(props.params)` re-suspends whenever the search param changes and flashes
`PageLoadingSpinner` over the page each time a dialog opens or closes — see
[mutation-dialog.md](mutation-dialog.md#general-points).
