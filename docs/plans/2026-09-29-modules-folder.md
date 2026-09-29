# Implementation plan: `src/modules/<id>/` for module-specific UI code

**Date:** 2026-09-29

**Branch / DB:** `plan/modules-folder` → rename to `refactor/modules-folder` at pickup. No Prisma
change, no `db:branch`. Pure file moves, import rewrites and one lint rule.

**Written against:** integration @ cef534bd

**Source:** discussion in session (no issue). The motivation: `src/components/` mixes the shared
UI layer (`ui`, `blocks`, `nav`, …) with per-module feature folders (`admin`, `skill-track`,
`system`, `user`, …), and some module-only components sit under `src/app/` beside their routes.

---

## Decisions

- **Layout:** `src/modules/<module-id>/components/` for components, `src/modules/<module-id>/lib/`
  for non-component module-private code (hooks, helpers). Create a subfolder only when something
  goes in it; no empty `lib/`.
- **Folder names are `modules.ts` ids, not route segments.** `org-admin` and `system-admin`
  both have segment `admin`. The ids that get folders: `org-admin`, `skill-track`,
  `skill-package-builder`, `i3`, `d4h-views`, `system-admin`, `profile`, `user-dashboard`.
  `forms` and `notes` have no UI code, so no folder.
- **Schemas don't move.** They're per-domain, not per-module (`organization`, `person`, `team`
  are each used by several modules). They stay in `src/lib/schemas/` until the later
  server-by-domain grouping decides where domains live.
- **Only registry modules move.** These stay in `src/components/`: `auth`, `invitations`,
  `docs`, `marketing` (public areas, not modules); `organization/` (the org dashboard at
  `/orgs/[slug]`, not a module); `d4h-today` (not in the registry); and the shared layer (`ui`,
  `blocks`, `nav`, `controls`, `entity-links`, `cards`, `markdown`, `errors`, `providers`, `art`,
  `icons`, …). `playground/` and `system/scratch/` under `app/` are dev tooling and stay.
- **Code used by more than one module goes to the shared layer, not into either module:**
  - `components/admin/organization-settings/*`, **except** `organization-settings-content.tsx`
    (org-admin's page body), → `src/components/organization-settings/`. The form is shared
    verbatim by org-admin and system-admin by design (see its doc comment).
  - `components/admin/invitations/invitation-role-fields.tsx` →
    `src/components/organization-roles/invitation-role-fields.tsx` (used by org-admin
    invitations/users/personnel and system-admin members).
  - `components/skill-packages/` (import tooling used by skill-package-builder and
    system-admin) stays where it is.
- **Module-private files under `src/app/` move into the module.** These are the non-route
  `.tsx` files beside pages: 11 in `i3/templates`, 5 in `d4h-views`, 4 in `admin`, 2 in
  `skill-track`. Pages then import them via `@/modules/…` instead of `./…`.
- **The boundary is enforced by `eslint-plugin-boundaries`**, which the repo already uses
  (v7.2, `eslint.config.mjs` "Layering" block). It supports captures, so a module can be
  forbidden from importing *another* module while importing itself freely. Allowed:
  - `src/app/**` may import any module (routes are the composition root; also covers
    `(wrapper)/layout.tsx` → system-admin's impersonation banner and `(authenticated)/layout.tsx`
    → profile's timezone auto-detect).
  - `src/components/nav/org-sidebar-modules.tsx` and `scope-sidebar-modules.tsx` may import
    modules (they are the sidebar-menu registry).
  - `src/components/docs/demo-*.tsx` may import modules (docs demos render the real component,
    e.g. `demo-assessment-row` → skill-track's `assessment-row`).
  - Everything else in `src/components/`, and all of `lib`, `server`, `trpc`, `forms`,
    `emails`, `client`, `hooks`, may not import `src/modules/`.
- **`src/modules/` is a UI layer, like `components`,** in every existing lint block. The
  path-scoped blocks that list `src/components/**` (the auth `no-restricted-imports` block, the
  `authClient.useSession` block, `avut/nz-spelling`, and the boundaries prisma-client/generated
  policies) must list `src/modules/**` too, **before** any file moves. Otherwise a moved file
  silently loses those rules.
- **No barrel `index.ts` files.** Import files directly, as now; a barrel mixes server and
  client code across the `"use client"` boundary.
- **Moves keep each folder's internal structure** (`admin/teams/team-content.tsx` →
  `modules/org-admin/components/teams/team-content.tsx`), so relative imports inside a moved
  folder stay valid. Files aren't renamed, except `user/profile-sidebar-menu.tsx` →
  `profile/components/sidebar-menu.tsx` to match every other module. Use `git mv` so history
  follows.
- **One branch, one commit per module, one PR.** No open PR touches these folders (checked
  2026-09-29), and the moves are mechanical, so a stack of PRs would add rebasing cost without
  better review. Each commit is still reviewable on its own. *(Revisit at pickup if you'd rather
  split.)*

## How to do a move (applies to Tasks 3–9)

1. `git mv` the folder or files to the new path.
2. Rewrite the import specifiers across `src/`, e.g.
   `grep -rl '@/components/skill-track/' src | xargs sed -i '' 's#@/components/skill-track/#@/modules/skill-track/components/#g'`.
   Include test files and any `vi.mock("@/components/…")` strings (none exist as of
   cef534bd, but check again).
3. For files moved out of `src/app/`, change the page's `./foo` import to the `@/modules/…`
   alias.
4. Fix any relative import that pointed at a moved-away file, or that a moved file used to
   reach something left behind. Each task names the ones it has.
5. `npm run check`. It runs typegen/tsc/eslint and the related tests. A boundaries error means a cross-module import the plan missed; stop and report
   it rather than allowlisting it.
6. `grep -rn '<old path>' src docs/patterns AGENTS.md .claude` should come back empty
   (historical `docs/plans|reviews|specs|ideas|research` keep old paths; they're dated
   records).

---

## Tasks

### - [ ] Task 1 — Lint boundary and conventions for `src/modules/`

**Files:** `eslint.config.mjs`, `AGENTS.md`, and `docs/conventions-checklist.md` if it is present
after syncing with integration and has a file-placement item. It's on the unmerged
`chore/ship-workflow` branch as of cef534bd.

**Do:**
- In the "Layering" block: add element
  `{ type: "module", pattern: "src/modules/*/**", partialMatch: false, capture: ["moduleId"] }`
  (matches the file's style; `mode` is deprecated in `@boundaries/elements`). Add file
  categories for the allowed importers: `module-registry` =
  `src/components/nav/{org,scope}-sidebar-modules.tsx`, `docs-demo` =
  `src/components/docs/demo-*.tsx`.
- Policies:
  - a `module` may not import a different `module`, as one policy:
    `{ from: { element: { type: "module" } }, disallow: { to: { element: { type: "module", captured: { moduleId: "!{{ from.element.captured.moduleId }}" } } } } }`
    (templates render against `{ from, to }`; use `from.element.captured.*`, not the legacy
    `from.captured.*`);
  - `lib`, `server`, `trpc`, `forms`, `emails`, `client`, `hooks`, `components` may not import
    `module`. Then, in a **later** policy (last match wins), allow `module-registry` and
    `docs-demo` files to import it;
  - add `module` to the existing "server-side must not import UI" target list, the
    "don't import the Prisma client" source list and the "UI doesn't import generated" source
    list.
  - Update the block's comment to describe the module rule.
- Add `src/modules/**/*.{ts,tsx}` (or `…/*.tsx` to match) alongside `src/components/**` in:
  the auth `no-restricted-imports` block, the `authClient.useSession` block, and the
  `avut/nz-spelling` block.
- `AGENTS.md`: under **Project Structure**, add a short "Modules" paragraph: what goes in
  `src/modules/<id>/{components,lib}`, that folders use `modules.ts` ids, that shared UI stays
  in `src/components/`, that schemas stay in `src/lib/schemas/`, the import rule (lint) and its
  two exceptions, and "no barrels". In **Scope roots and modules**, add one line pointing at it.

**Done when:** `npm run check -- --all` passes. Prove the rule fires, then delete the probe files:
create both `src/modules/a/components/x.tsx` and `src/modules/b/components/y.tsx` first. An
unresolved import leaves the target unknown, and with `default: "allow"` it would pass lint
whether or not the rule works. Then: `x.tsx` importing `@/modules/b/components/y` fails lint,
`src/components/ui/probe.tsx` importing `@/modules/a/components/x` fails, and the same import
from `src/components/nav/org-sidebar-modules.tsx` passes. Report the three outputs.

### - [ ] Task 2 — Extract shared org UI out of `components/admin`

**Files:** `src/components/admin/organization-settings/*` (all but
`organization-settings-content.tsx`) → `src/components/organization-settings/`;
`src/components/admin/invitations/invitation-role-fields.tsx` →
`src/components/organization-roles/invitation-role-fields.tsx`; their importers (org-admin
settings content, invitations, users, personnel; system-admin organizations).

**Do:** Moves per "How to do a move", but **rewrite per file, not per folder**. A folder-wide
`@/components/admin/organization-settings/` sed would also rewrite
`orgs/[slug]/admin/organization/settings/page.tsx`'s import of
`organization-settings-content`, which stays behind. `organization-settings-content.tsx` stays in
`components/admin/organization-settings/` for now (it moves with org-admin in Task 4). Relative
imports to fix: `organization-settings-content.tsx` (`./organization-settings-form` →
`@/components/organization-settings/organization-settings-form`) and
`admin/invitations/create-invitation.tsx` (`./invitation-role-fields` →
`@/components/organization-roles/invitation-role-fields`).

**Done when:** `npm run check` passes; `grep -rn '@/components/admin/' src/components/system`
is empty.

### - [ ] Task 3 — Move skill-package-builder

**Files:** `src/components/skill-package-builder/**` →
`src/modules/skill-package-builder/components/`; 6 pages under
`orgs/[slug]/skill-package-builder/`.

**Do:** Move per "How to do a move". Its imports of `@/components/skill-packages/` stay (shared).

**Done when:** `npm run check` passes; `src/components/skill-package-builder` no longer exists.

### - [ ] Task 4 — Move org-admin

**Files:** rest of `src/components/admin/**` → `src/modules/org-admin/components/**`;
`orgs/[slug]/admin/organization/--update/update-organization.tsx` →
`modules/org-admin/components/organization/`;
`orgs/[slug]/admin/d4h-access-tokens/{d4h-access-tokens-list.tsx,--create/create-d4h-access-token.tsx,[token_id]/access-token-content.tsx}`
→ `modules/org-admin/components/d4h-access-tokens/`; `src/hooks/use-person.ts` →
`src/modules/org-admin/lib/use-person.ts` (sole importer: `admin/personnel/[person_id]/history/page.tsx`);
`src/components/nav/org-sidebar-modules.tsx`; the 14 admin pages;
`docs/patterns/detail-page-data-fetching.md` (lines ~30–34 name `src/components/admin/…`).

**Do:** Move per "How to do a move". In `use-person.ts`, change `./use-organization` to
`@/hooks/use-organization`. Update the pattern doc's example paths and its "lives in
`src/components/admin/<domain>/`" guidance to `src/modules/<id>/components/<domain>/`.

**Done when:** `npm run check` passes; `src/components/admin` and `src/hooks/use-person.ts` no
longer exist.

### - [ ] Task 5 — Move skill-track

**Files:** `src/components/skill-track/**` → `src/modules/skill-track/components/**` (includes
`reports/` and its tests); `orgs/[slug]/skill-track/checks/checks-list.tsx` and
`catalogue/catalogue-packages-list.tsx` → `modules/skill-track/components/`;
`nav/org-sidebar-modules.tsx`; `docs/demo-assessment-row.tsx`; the skill-track pages.

**Do:** Move per "How to do a move". `demo-assessment-row` keeps importing `assessment-row`
under the `docs-demo` exception.

**Done when:** `npm run check` passes (including `assessment-row.test.tsx`,
`competency-status.test.ts`, `synthetic-competency-data.test.ts` from their new paths).

### - [ ] Task 6 — Move i3

**Files:** `src/components/i3/sidebar-menu.tsx` → `src/modules/i3/components/`; the 11 non-route
files under `orgs/[slug]/i3/templates/` (`create-template.tsx`, `templates-list.tsx`, and
`[template_id]/{template-content,update-template,recover-template,template-variants,add-variant,update-variant,delete-template,delete-variant,template-menu}.tsx`)
→ `src/modules/i3/components/templates/`; `nav/org-sidebar-modules.tsx`; i3 pages.

**Do:** Move per "How to do a move". Flatten `[template_id]/` into `templates/` (a dynamic
segment name has no meaning outside `app/`). The `./` imports among the moved files stay valid
after flattening. Only `templates/page.tsx` and `templates/[template_id]/page.tsx` change, from
`./…` to `@/modules/i3/components/templates/…`.

**Done when:** `npm run check` passes; `find "src/app/(wrapper)/(authenticated)/orgs/[slug]/i3" -type f`
lists only route files.

### - [ ] Task 7 — Move d4h-views

**Files:** `src/components/d4h-views/sidebar-menu.tsx`; `orgs/[slug]/d4h-views/{teams/d4h-teams-list,personnel/personnel-list,equipment/brands/[brand_id]/brand-models,equipment/categories/[category_id]/category-kinds,equipment/categories/[category_id]/kinds/[kind_id]/kind-items}.tsx`
→ `src/modules/d4h-views/components/{teams,personnel,equipment}/`; `nav/org-sidebar-modules.tsx`;
d4h-views pages.

**Do:** Move per "How to do a move", dropping the dynamic-segment folders as in Task 6.

**Done when:** `npm run check` passes; the d4h-views route tree holds only route files.

### - [ ] Task 8 — Move system-admin

**Files:** `src/components/system/admin/**` → `src/modules/system-admin/components/**`;
`src/app/(wrapper)/layout.tsx`; `nav/scope-sidebar-modules.tsx`; the system-admin pages;
`eslint.config.mjs` (the auth block's `ignores` names
`src/components/system/admin/impersonation-banner.tsx` and
`…/users/impersonate-user-dialog.tsx`).

**Do:** Move per "How to do a move". Update the two `ignores` paths. Otherwise those two
files start failing the `authClient` restriction, or worse, if the paths are left stale, the
exemption silently disappears.

**Done when:** `npm run check` passes; `src/components/system` no longer exists;
`impersonation-banner.test.tsx` and `user-actions-menu.test.tsx` pass from their new paths.

### - [ ] Task 9 — Split user into profile and user-dashboard

**Files:** `src/components/user/user-settings/**` → `src/modules/profile/components/**`
(drop the `user-settings/` level); `src/components/user/profile-sidebar-menu.tsx` →
`src/modules/profile/components/sidebar-menu.tsx`;
`src/components/user/{activity-stats,invitations,org-selector,signed-in-as}.tsx` →
`src/modules/user-dashboard/components/`; `src/app/(wrapper)/(authenticated)/layout.tsx`,
`user/page.tsx`, `user/settings/**` pages; `nav/scope-sidebar-modules.tsx`.

**Do:** Move per "How to do a move". Check first that the four dashboard cards don't import
anything under `user-settings/`, and vice versa. A cross-import between them has to go to the
shared layer, per the Decisions.

**Done when:** `npm run check -- --all` passes; `src/components/user` no longer exists;
`ls src/components` shows no module folders (only the shared layer and the non-module areas
listed in Decisions). Smoke-load one page per module on the worktree dev server (org-admin
personnel, skill-track sessions, skill-package-builder, i3 templates, d4h-views teams,
system-admin users, `/user`, `/user/settings/account`) and confirm each renders without a
console error. A moved `"use client"` file can surface only at runtime.

---

## Out of scope

- Moving schemas (`src/lib/schemas/`) or grouping server code (`services`, `routers`) by domain.
  That comes after the service-layer rollout.
- `d4h-today`, `components/organization` (org dashboard), `auth`, `invitations`, `docs`,
  `marketing`, `playground`, `system/scratch`.
- Renaming files or components (e.g. `AdminModule_*` component names), or restructuring
  inside a moved folder beyond flattening `app/` dynamic-segment folders.
- Updating historical `docs/plans|reviews|specs|ideas|research` that mention old paths.
