# Three-scope navigation redesign (org / user / system)

**Project:** avut
**Date:** 2026-09-15 00:00
**Source:** brainstorm session

## Idea

Restructure the whole authenticated app around three real, top-level scopes — `/orgs/[slug]`, `/user`, and `/system` — each with modules hanging directly off its root. Replace the current module-switcher dropdown with a single, always-rendered **scope switcher** (orgs + "Personal Account" + "System" for sys admins) that gives a persistent indicator of which scope you're in. Within a scope, drop the route-matched per-module sidebar in favour of one static sidebar that lists every enabled module as a collapsible section with its pages nested inside. `/user` becomes the new default landing page — a personal dashboard that also does the job of today's org picker.

## Context / motivation

This builds on the deferred three-way `ModuleScope` design from issue #92 (see memory `project-pseudo-global-org`), but goes further than that plan intended. #92 kept `/system-admin`'s URL unchanged and treated the scopes as an internal discriminator with a "Personal Account" pseudo-entry in the _existing_ module switcher. This session decided to make the scopes literal — real root paths — and to resolve a second, previously-unrelated open question at the same time: the current per-module sidebar (`OrgModuleListMenu` + a parallel-route `@sidebar` slot matched per module, e.g. `@sidebar/orgs/[slug]/i3/page.tsx` → `I3_Sidebar_Menu`) is explicitly marked `PROTOTYPE` in the code, with comments pointing at an unresolved "suspense-boundary-review" discussion about the tradeoffs of that approach. Once every module in a scope is meant to show at once rather than being swapped in per current route, the main justification for that fine-grained slot matching goes away.

## Options considered

- **Keep #92's minimal-churn plan** (internal `ModuleScope` only, `/system-admin` URL untouched, module switcher kept, Personal Account as a pseudo-org entry) — set aside in favour of literal scope roots, since the user wants real URL structure (`/system/admin`, `/user/profile`) and a genuine UX split, not just an internal discriminator.
- **Keep the `@sidebar` parallel-route slot pattern at every level** (scope root _and_ per-module) — set aside. With all of a scope's modules rendered together instead of swapped per sub-route, per-module route matching no longer buys anything.
- **Drop the `@sidebar` slot pattern entirely** — considered but rejected. The scope-root level (`orgs/[slug]` vs `user` vs `system`) still needs genuinely different data-fetching contexts (e.g. `OrganizationProvider` keyed off the slug's org id), so slotting is kept at that one level only.
- **Auto-expand a scope's org from a single-org account straight into that org** (today's `entry-control.ts` behaviour) vs. **always land on the Personal dashboard first** — kept the existing auto-proceed shortcut for now; making it a user preference is explicitly deferred until a user-level settings/config system exists.
- **Move `orgs/[slug]/playground` into `/system` as a registered module** — raised, then reversed: some of its sandboxes (e.g. `person-picker`) depend on being nested under a real org for test data. Decided to leave it exactly as-is: an unregistered, org-scoped dev route, not part of the `Modules` registry or the new sidebar at all.
- **Split `/system/admin`'s existing sub-areas** (`organizations`, `users`, `skill-packages`) into three separate top-level system modules vs. **one bundled "Admin" module** — kept as a single "Admin" collapsible with those as nested pages, unchanged from today's grouping.

## Open questions

- Exact shape of the restructured `Modules` registry: today's `OrganizationModuleId` / `GlobalModuleId` / `ModuleScope: "organization" | "global"` needs to become a genuine three-way union (`organization` / `user` / `system`), each scope with its own id type, `segment`, and `href` builder relative to its own root. Naming (`GlobalModuleId` → `SystemModuleId`, etc.) not yet settled.
- `NavCollapsible` (`src/components/nav/nav-section.tsx`) currently auto-opens only on an _exact_ href match. With every module always rendered, it needs to detect "a descendant page is active," and it's undecided whether collapsibles behave accordion-style (one open at a time) or can have several open at once.
- Whether the scope switcher is one component mounted above the whole sidebar tree (shared across all three scopes) or still mounted per-scope-layout, just with new content — leaning toward "always rendered" implying the former, but not explicitly confirmed.
- Full inventory of what the personal dashboard (`/user` index) should contain beyond the org list/invitations it's inheriting from today's `OrgSelector_Card`.
- Migration mechanics: redirects for `/system-admin` → `/system/admin` and `/user-settings` → `/user/profile`; removal of `/orgs/--select-org` and `/modules`; confirming `/orgs/--create` is genuinely dead before deleting it.
- The user profile page is being renamed (name TBD) and is explicitly scoped as "single page module for now" — deliberately deferring any expansion into multiple profile-related pages.

## Notes

- Prior art / superseded plan: memory `project-pseudo-global-org`, tracking issue **#92** (per-user enable/configure split into #93, depends on #92). This idea supersedes #92's shape — the tracking issue will need updating or replacing when this moves to a spec.
- Current per-module sidebar prototype to be dismantled: `src/components/nav/org-module-list-menu.tsx` (`OrgModuleListMenu`), `src/app/(wrapper)/(authenticated)/@sidebar/orgs/[slug]/**` (per-module `page.tsx`/`default.tsx` pairs), and the individual `*_Sidebar_Menu` components (`I3_Sidebar_Menu`, `Admin_Sidebar_Menu`, `SystemAdmin_Sidebar_Menu`, etc.) — these get composed inline into one scope-level list instead of route-matched.
- Scope-root `@sidebar` layouts to keep (just simplified internally): `@sidebar/orgs/[slug]/layout.tsx`, plus new equivalents for `@sidebar/user` and `@sidebar/system`.
- Routes confirmed to move: `system-admin/**` → `system/admin/**`; `user-settings/page.tsx` → `user/profile/page.tsx` (with a rename pending).
- Routes confirmed to be removed: `orgs/--select-org` (superseded by the personal dashboard's org list), `orgs/--create` (currently unused), `modules/page.tsx` (module-first picker flow, no longer wanted).
- `orgs/[slug]/playground` stays exactly as today: unregistered in `Modules`, org-scoped, not part of the new sidebar.
- `entry-control.ts`'s single-org auto-`Proceed` shortcut is kept unchanged for now; a future user-level config system is the prerequisite for making it configurable (separate idea, not scoped here).
- `/system/admin`'s existing sub-areas (`organizations`, `users`, `skill-packages`) stay nested under one "Admin" module/collapsible, unchanged.
