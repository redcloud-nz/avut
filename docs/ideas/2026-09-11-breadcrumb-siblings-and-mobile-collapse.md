# Breadcrumb siblings + mobile collapse

**Project:** avut
**Date:** 2026-09-11 06:28
**Source:** brainstorm session

## Idea

Two linked enhancements to `Std.Breadcrumbs` ([src/components/blocks/std.tsx](../../src/components/blocks/std.tsx)):

1. **Mobile collapse (priority 1).** Below `md`, the whole breadcrumb trail collapses
   to a single control — the current page's label plus a `▾` chevron — that opens a
   `DropdownMenu` listing every ancestor crumb. Today every crumb except the leaf is
   `hidden md:block`, so on a phone the trail is simply gone and there is no way back
   up. This fixes that regardless of whether siblings are ever added.
2. **Siblings (priority 2).** A `BreadcrumbItem` gains an optional recursive
   `siblings?: BreadcrumbItem[]`, supported at every level of the trail. A crumb with
   siblings renders as a dropdown showing the full set of peer destinations, with the
   current location marked (matched via `usePathname()`) — a "where am I / where can I
   go" control. First adopter: the skill-track session subpages.

## Context / motivation

- `Breadcrumbs` currently renders `(BreadcrumbItem | string)[]` where `BreadcrumbItem`
  is `{ label: string; href?: Route }`. Callers pass literal arrays from each page's
  content component (e.g. [session-content.tsx:57](../../src/components/skill-track/session-content.tsx#L57)).
- On small screens `normalizedBreadcrumbs.slice(0, -1)` items all carry
  `hidden md:block` and the separators too — the user sees only the leaf label with no
  navigation affordance. The shadcn `BreadcrumbEllipsis` primitive exists in
  [breadcrumb.tsx](../../src/components/ui/breadcrumb.tsx) but is unused.
- The skill-track session has a fixed set of subpages —
  `sessions/[session_id]/` (overview) plus `checks`, `by-person`, `by-skill`,
  `review`, `skills`, `personnel` — each with its own content component and its own
  `Std.Navbar` breadcrumbs. Lateral movement between them is currently scattered across
  ad-hoc dropdowns and buttons in `Saratoga.Actions`. A siblings dropdown on the leaf
  crumb (`… / {session name} / Checks ▾`) would consolidate that and likely let some of
  those ad-hoc controls be retired later.

## Decisions from the session

- **Siblings at all levels**, not just the leaf. The `{session name}` crumb could later
  carry other-recent-sessions as siblings; the type must not assume leaf-only.
- **Dropdown shows the complete peer set including the current destination**, active one
  marked. Natural ordering matters (Overview, Checks, By Person, …), so the caller
  passes the full list in order and the component detects "current" rather than the
  caller splitting self out.
- **Current detection = path matching.** Caller passes every peer with `label` + `href`;
  the component compares each `href` against `usePathname()` and marks the match. No
  extra `current` flag for callers to get wrong. Consequence: `Breadcrumbs` becomes a
  client component. Query-param hrefs need care (compare pathname, not full href).
- **Mobile trigger = current page label + `▾`** (keeps context visible in the tight
  space), not a generic `…` / menu icon.
- **Mobile collapse is always on below `md`**, not conditional on trail length —
  simpler and predictable.
- **Mobile dropdown structure:** ancestor crumbs that have siblings become
  `DropdownMenuSub` submenus; ancestors without siblings are plain link items; the
  current page is a non-interactive header/label.
- **Permission gating is in scope.** A sibling the user cannot open should not appear.
  The sibling list (or the helper that builds it) runs each entry through
  `useHasPermission` ([src/hooks/use-has-permission.ts](../../src/hooks/use-has-permission.ts),
  same hook `<Protect>` uses) and filters. Shape TBD — probably each `BreadcrumbItem`
  gains an optional `permissions?: Permissions` that `Breadcrumbs` evaluates and drops.
- **Authoring:** siblings declared inline on the page as today, but shared helpers are
  encouraged for repeated sets — e.g. `sessionSubpages(org, session)` returning the
  ordered `BreadcrumbItem[]` (with per-entry `permissions`) that every session subpage
  passes verbatim.

## Options considered

- **Explicit `current: true` flag on a sibling** vs path matching — rejected in favour
  of path matching; less for callers to get wrong, and a helper returning one shared
  array can't know which page is calling it.
- **Self excluded from siblings, component renders `[self, ...siblings]`** — rejected;
  breaks natural ordering of the "where can I go" list.
- **Conditional mobile collapse (only when trail > 2 levels)** — rejected for
  always-on; predictability over cleverness.
- **Generic `…` menu icon as the mobile trigger** — rejected; current-label-plus-chevron
  keeps the user oriented.
- **Wiring up shadcn `BreadcrumbEllipsis` for the desktop overflow case** — not part of
  this; the desktop trail stays inline. Could revisit if a trail ever gets long enough
  to need horizontal-overflow handling.

## Open questions

- Exact API for per-crumb permission gating — `permissions?: Permissions` on
  `BreadcrumbItem`, evaluated inside `Breadcrumbs`? That means calling `useHasPermission`
  in a loop / for each crumb — check that's OK (hook rules: fixed-length arrays, or a
  single call with a merged object won't work since gating is per-entry). May need a
  small `useHasPermissions(list)` batch variant.
- Does making `Breadcrumbs` a client component cause any RSC friction? It's rendered
  inside `Std.Navbar`, itself used from both server and client content components —
  confirm `usePathname()` is fine in all current call sites (they appear to all be
  client components already).
- Should the desktop siblings dropdown and the mobile submenu share a single data walk
  / render helper, or are they different enough to keep separate?
- Icons per sibling entry (lucide) — worth supporting in `BreadcrumbItem` for the
  dropdown rows, or leave text-only for v1?
- Once session subpages adopt this, which `Saratoga.Actions` controls in
  `session-content.tsx` / `session-contents.tsx` actually get retired vs kept (some are
  actions like "Record", not navigation).

## Notes

- Entry points: [src/components/blocks/std.tsx](../../src/components/blocks/std.tsx)
  (`BreadcrumbItem` type ~L40, `Breadcrumbs` ~L55, `Navbar` ~L95),
  [src/components/ui/breadcrumb.tsx](../../src/components/ui/breadcrumb.tsx) (shadcn
  primitives incl. unused `BreadcrumbEllipsis`).
- Dropdown primitives: `src/components/ui/dropdown-menu.tsx` — has
  `DropdownMenuSub` / `DropdownMenuSubTrigger` / `DropdownMenuSubContent`.
- Permission hook: [src/hooks/use-has-permission.ts](../../src/hooks/use-has-permission.ts);
  `Permissions` type from `src/lib/permissions.ts`.
- Session subpage routes to build the first helper from:
  `/orgs/[slug]/skill-track/sessions/[session_id]{,/checks,/by-person,/by-skill,/review,/skills,/personnel}`.
- Ship priority 1 (mobile collapse, no siblings) independently and first — it's a
  straight usability fix. Siblings can follow as a second change.
