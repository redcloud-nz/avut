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
src/app/(authenticated)/orgs/[slug]/admin/teams/[team_id]/page.tsx   # route shell only
src/components/admin/teams/team-content.tsx                          # "use client", all rendering
```

The route folder holds only `page.tsx`. The content component lives under
`src/components/admin/<domain>/`, named `<entity>-content.tsx`, alongside the other
components for that domain (menus, dialogs, cards) — not in the route folder. This
mirrors where every other page-specific component for a domain already lives, and
means the route folder stays a thin routing artifact.

---

## `page.tsx`

```tsx
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, team_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const teamId = TeamId.schema.parse(team_id);
  const team = await fetchQuery(
    trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
  );

  return { title: `${team.name} ${TITLE_SEPARATOR} Teams` };
}

export default async function AdminModule_Team_Page(props: Props) {
  const { slug, team_id } = await props.params;
  const { organization } = await requireOrganization(slug);

  const teamId = TeamId.schema.parse(team_id);

  prefetch(trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }));

  return (
    <HydrateClient>
      <Std.SidebarInset>
        <AdminModule_Team_Content teamId={teamId} />
      </Std.SidebarInset>
    </HydrateClient>
  );
}
```

Key points:

- **Both `trpc` calls here are the `@/trpc/server` one** — it calls the router
  in-process, preserving the request's session; the `@/trpc/client` one exists for
  Client Components only and goes out over HTTP unauthenticated if used here by mistake.
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
- **No `<Suspense>` wrapper here.** `Std.SidebarInset` already wraps its children in
  `<Suspense fallback={<PageLoadingSpinner />}>` (see `src/components/blocks/std.tsx`),
  so every page using it gets this for free. Don't add a second one.
- **No breadcrumbs, no `Std.Navbar`, no `Std.ScrollContainer` here** — those move into
  the content component (next section).

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
    <>
      <Std.Navbar
        breadcrumbs={[
          { label: "Admin", href: route("/orgs/[slug]/admin", { slug: organization.slug }) },
          { label: "Teams", href: route("/orgs/[slug]/admin/teams", { slug: organization.slug }) },
          { label: team.name },
        ]}
      />
      <Std.ScrollContainer>
        <Saratoga.Root>{/* ... */}</Saratoga.Root>
      </Std.ScrollContainer>
    </>
  );
}
```

Key points:

- **Reads everything via `useSuspenseQuery`** (or `useSuspenseQueries` for more than
  one — see the personnel page, which combines `getPerson` and `getLinkedUser`). No
  props carry entity data in; only the id(s) needed to build the query key.
- **Owns `Std.Navbar` and `Std.ScrollContainer`**, not `page.tsx`. This is the reason
  the breadcrumb's entity name stays in sync with mutations: it's read from the same
  `useSuspenseQuery` call as everything else on the page, so a cache write updates it
  along with the rest of the content. Since the suspense point (`useSuspenseQuery`) is
  at the top of this component, before any JSX — including the `Navbar` — is produced,
  the _whole_ component suspends together; that's exactly what `SidebarInset`'s
  boundary is there to catch.
- Organization id and slug come from `useOrganization()`, not from props — `page.tsx`
  only passes the route param(s) it can't get any other way (e.g. `teamId`).

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
  content component reads from — use it when the response *is* the detail query's full
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
used by list-style pages (e.g. `skill-track/catalogue/page.tsx`:
`` `Catalogue ${TITLE_SEPARATOR} Skill Track` ``). In that case the page body's
`prefetch` calls are the only server-side data touch needed.
