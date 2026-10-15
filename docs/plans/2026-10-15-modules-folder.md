# Implementation plan: `src/modules/<id>/` for module-specific UI code

**Date:** 2026-10-15 (first written 2026-09-29)

**Tracks:** #385

**Branch / DB:** a stack of five branches, `refactor/modules-folder-1` … `-5` (see
[PR stack](#pr-stack)). No Prisma change, no `db:branch`. Pure file moves, import rewrites and one
lint rule.

**Written against:** integration @ cef534bd; **revised** 2026-10-15 against integration @ 0eb325d6
(see [Revision 2026-10-15](#revision-2026-10-15)).

**Source:** discussion in session, then #385. The motivation: `src/components/` mixes the shared
UI layer (`ui`, `blocks`, `nav`, …) with per-module feature folders (`admin`, `skill-track`,
`system`, `user`, …), and some module-only components sit under `src/app/` beside their routes.

---

## Decisions

- **Layout:** `src/modules/<module-id>/components/` for components, `src/modules/<module-id>/lib/`
  for non-component module-private code (hooks, helpers). Create a subfolder only when something
  goes in it; no empty `lib/`.
- **Folder names are `modules.ts` ids, not route segments.** `org-admin` and `system-admin`
  both have segment `admin`. The ids that get folders: `org-admin`, `skill-track`,
  `skill-package-builder`, `i3`, `d4h-views`, `notes`, `system-admin`, `user-dashboard`,
  `user-notes`. `forms` has no UI code, so no folder.
- **One folder that isn't a registry id: `user-settings`.** The `profile` module was retired in
  #356 and user settings moved into the user menu, but the `/user/settings/*` pages still have 25
  files of their own UI. Decided 2026-10-15: they get `src/modules/user-settings/` and the same
  boundary rule as any module, rather than staying in `src/components/`.
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
  - Notes (decided 2026-10-15): the seven files shared by org notes and personal notes
    (`note-card`, `note-detail`, `note-editor`, `notes-list`, `notes-breadcrumbs`,
    `note-gone-boundary`, `deleted-notes`) stay in `src/components/notes/`. The org-only files
    go to `modules/notes`, the personal-only ones to `modules/user-notes`.
- **Module-private files under `src/app/` move into the module.** These are the non-route
  `.tsx` files beside pages: 11 in `i3/templates`, 5 in `d4h-views`, 4 in `admin`, 2 in
  `skill-track`, plus `skill-track/sessions/[session_id]/_prefetch-session-config-dialog.ts` (as of
  0eb325d6). Pages then import them via `@/modules/…` instead of `./…`.
- **The boundary is enforced by `eslint-plugin-boundaries`**, which the repo already uses
  (v7.2, `eslint.config.mjs` "Layering" block). It supports captures, so a module can be
  forbidden from importing _another_ module while importing itself freely. Allowed:
  - `src/app/**` may import any module (routes are the composition root; also covers
    `(authenticated)/layout.tsx` → system-admin's impersonation banner and user-settings'
    timezone auto-detect).
  - `src/components/nav/org-sidebar-modules.tsx` and `scope-sidebar-modules.tsx` may import
    modules (they are the sidebar-menu registry).
  - `src/components/docs/demo-*.tsx` may import modules (docs demos render the real component,
    e.g. `demo-check-row` → skill-track's `check-row` and `record-check-dialog`).
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
  folder stay valid. Files aren't renamed. Use `git mv` so history follows.
- **A stack of five PRs** (decided 2026-10-15, replacing "one branch, one PR"). Each branch is
  cut from the previous one and its PR targets it. Only the bottom PR targets `integration`. Each
  merges after the one below it, with no auto-merge on a PR whose parent is still open. One
  commit per task inside each PR. See [PR stack](#pr-stack).
- **#138 comes after this** (decided 2026-10-15). This plan moves UI files only. Route files and
  layouts stay where Next needs them, so the route-access conversation can build on the new
  layout.

## PR stack

| PR  | Branch                      | Tasks                                                           |
| --- | --------------------------- | --------------------------------------------------------------- |
| 1   | `refactor/modules-folder-1` | 1 (lint boundary, conventions), 2 (shared org UI)               |
| 2   | `refactor/modules-folder-2` | 3 (skill-package-builder), 6 (i3), 7 (d4h-views), 10 (notes)    |
| 3   | `refactor/modules-folder-3` | 4 (org-admin)                                                   |
| 4   | `refactor/modules-folder-4` | 5 (skill-track)                                                 |
| 5   | `refactor/modules-folder-5` | 8 (system-admin), 9 (user-dashboard, user-settings, user-notes) |

Every PR above the first depends on Task 1's lint config (the `module` element and its
exceptions), so they're stacked rather than cut in parallel from `integration`. Several also
touch `nav/org-sidebar-modules.tsx` or `scope-sidebar-modules.tsx`.

## Revision 2026-10-15

Re-checked against integration @ 0eb325d6, at pickup for #385:

- `profile` was retired (#356). Task 9 now splits `components/user/` into `user-dashboard` and
  `user-settings`.
- Notes gained UI (PR #348), shared by two modules. New Task 10, plus the shared-layer rule above.
- `src/hooks/use-person.ts` has no importers left. Task 4 deletes it instead of moving it.
- `skill-track` grew from 34 files to 54, and `admin` from 61 to 70. The tasks move whole folders, so
  only the `src/app` file lists needed checking. Re-run the listings at the start of each task
  anyway.
- `docs/conventions-checklist.md` is on integration now, so Task 1 updates it.
- The impersonation banner now renders from `(authenticated)/layout.tsx` (PR #393).

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

### - [x] Task 1 — Lint boundary and conventions for `src/modules/`

**Files:** `eslint.config.mjs`, `AGENTS.md`, `docs/conventions-checklist.md` (add a placement
item: module-only UI goes in `src/modules/<id>/`, shared UI in `src/components/`).

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
  `src/modules/<id>/{components,lib}`, that folders use `modules.ts` ids (with `user-settings` as the one non-registry folder), that shared UI stays
  in `src/components/`, that schemas stay in `src/lib/schemas/`, the import rule (lint) and its
  two exceptions, and "no barrels". In **Scope roots and modules**, add one line pointing at it.

**Done when:** `npm run check -- --all` passes. Prove the rule fires, then delete the probe files:
create both `src/modules/a/components/x.tsx` and `src/modules/b/components/y.tsx` first. An
unresolved import leaves the target unknown, and with `default: "allow"` it would pass lint
whether or not the rule works. Then: `x.tsx` importing `@/modules/b/components/y` fails lint,
`src/components/ui/probe.tsx` importing `@/modules/a/components/x` fails, and the same import
from `src/components/nav/org-sidebar-modules.tsx` passes. Report the three outputs.

### - [ ] Task 2 — `mechanical` — Extract shared org UI out of `components/admin`

**Files:** `src/components/admin/organization-settings/*` (all but
`organization-settings-content.tsx`) → `src/components/organization-settings/`;
`src/components/admin/invitations/invitation-role-fields.tsx` →
`src/components/organization-roles/invitation-role-fields.tsx`; their importers (org-admin
settings content, invitations, users, personnel; system-admin organizations).

**Do:** Moves per "How to do a move", but **rewrite per file, not per folder**. A folder-wide
`@/components/admin/organization-settings/` sed would also rewrite
`orgs/[slug]/admin/organization-settings/page.tsx`'s import of
`organization-settings-content`, which stays behind. `organization-settings-content.tsx` stays in
`components/admin/organization-settings/` for now (it moves with org-admin in Task 4). Relative
imports to fix: `organization-settings-content.tsx` (`./organization-settings-form` →
`@/components/organization-settings/organization-settings-form`) and
`admin/invitations/create-invitation.tsx` (`./invitation-role-fields` →
`@/components/organization-roles/invitation-role-fields`).

**Done when:** `npm run check` passes; `grep -rn '@/components/admin/' src/components/system`
is empty.

### - [ ] Task 3 — `mechanical` — Move skill-package-builder

**Files:** `src/components/skill-package-builder/**` →
`src/modules/skill-package-builder/components/`; 6 pages under
`orgs/[slug]/skill-package-builder/`.

**Do:** Move per "How to do a move". Its imports of `@/components/skill-packages/` stay (shared).

**Done when:** `npm run check` passes; `src/components/skill-package-builder` no longer exists.

### - [ ] Task 4 — `mechanical` — Move org-admin

**Files:** rest of `src/components/admin/**` → `src/modules/org-admin/components/**`;
`orgs/[slug]/admin/organization/--update/update-organization.tsx` →
`modules/org-admin/components/organization/`;
`orgs/[slug]/admin/d4h-access-tokens/{d4h-access-tokens-list.tsx,--create/create-d4h-access-token.tsx,[token_id]/access-token-content.tsx}`
→ `modules/org-admin/components/d4h-access-tokens/`; `src/hooks/use-person.ts` (no importers left as of 0eb325d6: delete it);
`src/components/nav/org-sidebar-modules.tsx`; every file under `orgs/[slug]/admin` that imports
`@/components/admin/` (17 as of 0eb325d6), plus the 4 pages importing the moved `./` files;
`docs/patterns/detail-page-data-fetching.md` (lines ~30–34 name `src/components/admin/…`).

**Do:** Move per "How to do a move". `git rm src/hooks/use-person.ts` after confirming it still
has no importers. Update the pattern doc's example paths and its "lives in
`src/components/admin/<domain>/`" guidance to `src/modules/<id>/components/<domain>/`.

**Done when:** `npm run check` passes; `src/components/admin` and `src/hooks/use-person.ts` no
longer exist.

### - [ ] Task 5 — `mechanical` — Move skill-track

**Files:** `src/components/skill-track/**` → `src/modules/skill-track/components/**` (includes
`reports/` and its tests); `orgs/[slug]/skill-track/checks/checks-list.tsx` and
`catalogue/catalogue-packages-list.tsx` → `modules/skill-track/components/`;
`sessions/[session_id]/_prefetch-session-config-dialog.ts` → `modules/skill-track/lib/` (three
importers: `sessions/[session_id]/page.tsx` via `./`, and `by-person/page.tsx` and
`by-skill/page.tsx` via `../`); `nav/org-sidebar-modules.tsx`; `docs/demo-check-row.tsx`; the
skill-track pages; `docs/patterns/mutation-dialog.md` (~line 510 names
`src/components/skill-track/session-config-dialogs.tsx`).

**Do:** Move per "How to do a move". `demo-check-row` keeps importing `check-row` and
`record-check-dialog` under the `docs-demo` exception.

**Done when:** `npm run check` passes, including `check-row.test.tsx`,
`record-check-dialog.test.tsx`, `use-session-checks-sync.test.ts`,
`reports/competency-status.test.ts` and `reports/synthetic-competency-data.test.ts` from their
new paths.

### - [ ] Task 6 — `mechanical` — Move i3

**Files:** `src/components/i3/{sidebar-menu,issue-items-form-list}.tsx` →
`src/modules/i3/components/` (the second's only importer is `i3/forms/issue-items/page.tsx`); the 11 non-route
files under `orgs/[slug]/i3/templates/` (`create-template.tsx`, `templates-list.tsx`, and
`[template_id]/{template-content,update-template,recover-template,template-variants,add-variant,update-variant,delete-template,delete-variant,template-menu}.tsx`)
→ `src/modules/i3/components/templates/`; `nav/org-sidebar-modules.tsx`; i3 pages.

**Do:** Move per "How to do a move". Flatten `[template_id]/` into `templates/` (a dynamic
segment name has no meaning outside `app/`). The `./` imports among the moved files stay valid
after flattening. Only `templates/page.tsx` and `templates/[template_id]/page.tsx` change, from
`./…` to `@/modules/i3/components/templates/…`.

**Done when:** `npm run check` passes; `src/components/i3` no longer exists;
`find "src/app/(wrapper)/(authenticated)/orgs/[slug]/i3" -type f` lists only route files.

### - [ ] Task 7 — `mechanical` — Move d4h-views

**Files:** `src/components/d4h-views/sidebar-menu.tsx`; `orgs/[slug]/d4h-views/{teams/d4h-teams-list,personnel/personnel-list,equipment/brands/[brand_id]/brand-models,equipment/categories/[category_id]/category-kinds,equipment/categories/[category_id]/kinds/[kind_id]/kind-items}.tsx`
→ `src/modules/d4h-views/components/{teams,personnel,equipment}/`; `nav/org-sidebar-modules.tsx`;
d4h-views pages.

**Do:** Move per "How to do a move", dropping the dynamic-segment folders as in Task 6.

**Done when:** `npm run check` passes; the d4h-views route tree holds only route files.

### - [ ] Task 8 — `mechanical` — Move system-admin

**Files:** `src/components/system/admin/**` → `src/modules/system-admin/components/**`;
`src/app/(wrapper)/(authenticated)/layout.tsx` (the impersonation banner);
`nav/scope-sidebar-modules.tsx`; the system-admin pages;
`eslint.config.mjs` (the auth block's `ignores` names
`src/components/system/admin/impersonation-banner.tsx` and
`…/users/impersonate-user-dialog.tsx`).

**Do:** Move per "How to do a move". Update the two `ignores` paths. Otherwise those two
files start failing the `authClient` restriction, or worse, if the paths are left stale, the
exemption silently disappears.

**Done when:** `npm run check` passes; `src/components/system` no longer exists;
`impersonation-banner.test.tsx` and `user-actions-menu.test.tsx` pass from their new paths.

### - [ ] Task 9 — `mechanical` — Split user into user-dashboard and user-settings

**Files:** `src/components/user/{activity-stats,invitations,org-selector,signed-in-as}.tsx` →
`src/modules/user-dashboard/components/`; `src/components/user/user-settings/**` →
`src/modules/user-settings/components/**` (drop the `user-settings/` level);
`src/app/(wrapper)/(authenticated)/layout.tsx` (timezone auto-detect), `user/page.tsx`,
`user/settings/**` pages; `nav/scope-sidebar-modules.tsx` and the user menu if they import any
of it.

**Do:** Move per "How to do a move", in this order. First rewrite `@/components/user/user-settings/`
→ `@/modules/user-settings/components/`. Then do the four dashboard files one by one (only
`user/page.tsx` imports them). A folder-wide `@/components/user/` sed run first would send the
seven settings importers to `user-dashboard`. As of 0eb325d6 the dashboard cards and the settings files
don't import each other. Check again, because a cross-import has to go to the shared layer.

**Done when:** `npm run check` passes; `src/components/user` no longer exists.

### - [ ] Task 10 — `mechanical` — Move notes and user-notes

**Files:** from `src/components/notes/`: `org-note-content`, `org-note-history-content`,
`org-notes-list`, `notes-module-gate`, `delete-org-note-dialog` → `src/modules/notes/components/`;
`user-note-content`, `user-note-history-content`, `user-notes-list`, `delete-user-note-dialog` →
`src/modules/user-notes/components/`; the notes layouts and pages under `orgs/[slug]/notes` and
`user/notes`.

**Do:** Move per "How to do a move", **per file**. The shared seven stay in
`src/components/notes/`, so a folder-wide sed would rewrite their importers wrongly. The moved
files' `./note-detail`-style imports of the shared files become `@/components/notes/…`. A shared
file that imports a moved one (none as of 0eb325d6) would break the boundary. Stop and report it.

**Done when:** `npm run check -- --all` passes (this is PR 2's last task).

### After PR 5

`npm run check -- --all` passes and `ls src/components` shows no module folders, only the shared
layer and the non-module areas listed in Decisions. Smoke-load one page per module on the
worktree dev server and confirm each renders without a console error, since a moved
`"use client"` file can surface only at runtime. The pages: org-admin personnel, skill-track
sessions, skill-package-builder, i3 templates, d4h-views teams, notes, system-admin users,
`/user`, `/user/notes` and `/user/settings/account`.

---

## Docs impact

None. Developer docs only: AGENTS.md, `docs/patterns/`, the conventions checklist.

## Out of scope

- Moving schemas (`src/lib/schemas/`) or grouping server code (`services`, `routers`) by domain.
  That comes after the service-layer rollout.
- `d4h-today`, `components/organization` (org dashboard), `auth`, `invitations`, `docs`,
  `marketing`, `history`, `whats-new`, `playground`, `system/scratch`.
- Renaming files or components (e.g. `AdminModule_*` component names), or restructuring
  inside a moved folder beyond flattening `app/` dynamic-segment folders.
- Updating historical `docs/plans|reviews|specs|ideas|research` that mention old paths.

## Parked

- (none yet)
