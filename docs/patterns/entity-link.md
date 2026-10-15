# Pattern: `EntityLink` entity-name links

`EntityLink` (`src/components/entity-links/entity-link.tsx`) is the standard way to render
an entity's name as a link to its detail page. It wraps `Link` in a shadcn `HoverCard`
(`src/components/ui/hover-card.tsx`) so hovering (or focusing) the name always confirms
what it links to before navigating — closing a gap where entity-name links used to exist
in several inconsistent styles (bare `<Link>`, `hover:underline`,
`underline-offset-2 hover:underline`) with no shared visual cue that they navigate anywhere.

Design discussed in #299.

---

## Use the wrapper, not `EntityLink` directly

`EntityLink` itself is a thin primitive — `{ href, title, type, children? }` — but callers
should reach for the per-entity wrapper in `src/components/entity-links/`, not `EntityLink`
directly:

| Entity          | Wrapper              | Prop                                                     |
| --------------- | -------------------- | -------------------------------------------------------- |
| Person          | `PersonLink`         | `person: PersonRef & Partial<Pick<PersonData, "email">>` |
| Team            | `TeamLink`           | `team: TeamRef & Partial<Pick<TeamData, "description">>` |
| Team Membership | `TeamMembershipLink` | `teamMembership: TeamMembershipRef`                      |
| User            | `UserLink`           | `user: UserRef & Partial<Pick<UserData, "email">>`       |

Each wrapper resolves its own route via `route()`, sources `organization.slug` from
`useOrganization()` internally (callers don't need it in scope just to render a link — drop
it from `useMemo` deps if it's no longer used for anything else), and renders whatever
enrichment field it has as the `HoverCardContent` body:

```tsx
// Table cell — no route()/organization.slug needed at the call site
cell: (ctx) => <PersonLink person={ctx.row.original} />;
```

```tsx
// Inline in a detail page
<DataItem inline>
  <DataItemTitle>Team</DataItemTitle>
  <DataItemValue>
    <TeamLink team={team} />
  </DataItemValue>
</DataItem>
```

Only reach for `EntityLink` directly when adding a new entity type (see below) — never as a
substitute for an existing wrapper.

## Prop typing: intersect the `Ref` schema, don't hand-roll the shape

A wrapper's prop is typed as `<Entity>Ref & Partial<Pick<<Entity>Data, "<enrichment field>">>`
— the `Ref` schema (`src/lib/schemas/<entity>.ts`) supplies `{id, name}` (or, for
`TeamMembershipRef`, `{teamId, personId, name}` — team memberships have no single-id detail
route), and the `Partial<Pick<...>>` half adds whatever extra field the hover card shows
(`email` for `PersonLink`/`UserLink`, `description` for `TeamLink`). `TeamMembershipLink`
has no enrichment field, so its prop is just `TeamMembershipRef`.

This is a structural type, not a request to construct a bare `Ref` at the call site: a
caller already holding the full `PersonData`/`TeamData`/`UserData` (the common case) can
pass it straight through — it satisfies the intersection as-is. Only construct a literal
`{id, name, ...}` object when the call site's data doesn't already carry an `id`/`name` in
that shape (e.g. `organization-content.tsx`'s system-admin member row, which parses the
router's plain `string` `userId` through `UserId.schema.parse` first to get a branded
`UserId` before building the `UserRef`).

Don't re-derive `Pick<PersonData, "id" | "name">` (or the `Team`/`User` equivalent) inline —
use the `Ref` schema.

## Adding a new entity type

1. Add `<Entity>Ref` to `src/lib/schemas/<entity>.ts` if it doesn't already exist — `{id, name}`
   for anything with a single-id detail route, or the full identifying key (as
   `TeamMembershipRef` does) when it doesn't.
2. Add `src/components/entity-links/<entity>-link.tsx`, following an existing wrapper as a
   template: resolve the route with `route()`, pass `title`/`type` to `EntityLink`, and put
   any enrichment field in `children`.
3. Only build the enrichment fields a wrapper actually needs right now. `EntityLink` never
   fetches on hover — it renders only data the caller already has in hand (no loading state,
   no round trip) — so don't widen a `Ref` schema speculatively for a field no call site
   passes yet.
