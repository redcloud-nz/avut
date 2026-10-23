# Rename D4H Views and I3 to D4H and D4H I3

**Date:** 2026-10-24
**Issue:** [#452](https://github.com/redcloud-nz/avut/issues/452) (stage 1 of #456)
**Branch:** `feat/rename-d4h-modules`, worktree `.claude/worktrees/rename-d4h-modules`
**DB:** adds a data-only migration, so it needs `npm run db:branch rename-d4h-modules` before it is applied (Task 1)
**Written against:** integration @ a2665d29

Renames the two D4H-facing modules: their ids, URL segments, settings keys, folders, labels and component prefixes. Also adds the dependency decided on the issue: D4H I3 requires D4H.

|                                  | Now                                              | After                                          |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| Module id (`src/lib/modules.ts`) | `d4h-views` / `i3`                               | `d4h` / `d4h-i3`                               |
| Label                            | D4H Views / I3                                   | D4H / D4H I3                                   |
| URL                              | `/orgs/[slug]/d4h-views/…` / `/orgs/[slug]/i3/…` | `/orgs/[slug]/d4h/…` / `/orgs/[slug]/d4h-i3/…` |
| Module folder                    | `src/modules/d4h-views/` / `src/modules/i3/`     | `src/modules/d4h/` / `src/modules/d4h-i3/`     |
| Settings key                     | `modules.d4h-views.*` / `modules.i3.*`           | `modules.d4h.*` / `modules.d4h-i3.*`           |
| Index page title                 | "D4H Views Module" / "I3 Module"                 | "D4H" / "D4H I3"                               |

## Decisions

- **No redirects.** The old URLs stop existing (#452, v0.12 plan wave 5).
- **Settings move by data migration**, not a read-time fallback. `OrganizationConfig` stores one row per leaf (`key` = dot path), so the migration rewrites the `key` prefix: `modules.d4h-views.` → `modules.d4h.` and `modules.i3.` → `modules.d4h-i3.` (this carries I3's `storage` too). It's data only. `schema.prisma` doesn't change.
- **Past audit entries keep their old paths.** `OrganizationSettings` log entries record diffs keyed `modules.i3.enabled` and so on. That's history, so it's left alone.
- **`d4h-i3` requires `d4h`** (issue comment, 2026-10-24). How it works, settled at L1:
  - **Write-through.** Saving `modules.d4h` with `enabled: false` also saves `modules.d4h-i3.enabled = false` in the same transaction and the same audit entry.
  - **Refused the other way.** Saving `modules.d4h-i3` with `enabled: true` while D4H is off throws `ConflictError` ("Turn on D4H first").
  - **Usability guard.** A module whose `requires` module isn't usable isn't usable either. So an org that has I3 on and D4H Views off today loses D4H I3 after the migration ("leave as is"). Its stored `d4h-i3` flag stays on, so turning D4H on brings it back.
  - **Settings UI.** While D4H is off, the D4H I3 card's **Enable** is disabled, with a line saying why. An org whose I3 is on but held off by D4H sees "Inactive until D4H is turned on" and keeps **Disable**. The D4H disable dialog says D4H I3 is turned off too.
  - The rule is data in the registry: `OrganizationModuleDef.requires?: OrganizationModuleId`, set on `d4h-i3`. Nothing hardcodes the pair.
  - `requires` gates on the D4H **module** being on, not on a D4H token. The rename leaves every D4H page's no-token handling as it is.
- **Every page is gated on its own module only** (issue comment). D4H pages check `d4h`, D4H I3 pages check `d4h-i3`. The guard above gives the dependency.
- **Internal `i3` names that aren't the module id stay** (L1). That covers the roles `i3-editor`/`i3-admin` (stored on member rows; their `moduleId` _does_ become `d4h-i3`), the tRPC router `i3` and `i3-effects.ts`, the permission resources (`i3Item`, `i3Template`), `Operations` keys, form keys (`i3-issue`, `i3-return`), `src/forms/i3-*`, emails, `services/i3-templates.ts`, Prisma models (`I3Template`…), log object types, the trash type `i3Template`, and the Vercel flag `i3ModuleFlag` with key `i3-module` (renaming the key would need a matching change in Vercel for every environment). I3 is still the product name inside "D4H I3". `d4h-views` goes everywhere.
- **Guides stay where they are.** End-user guides aren't edited in a feature branch. The one exception is the two guides' `section:` frontmatter (`content/docs/d4h-views/index.mdx`, `content/docs/i3/index.mdx`), which changes to `d4h` / `d4h-i3` in Task 1. `src/server/docs.ts` hides a section whose id matches a flag-off module id, so without the change the I3 guide and its help card would stop being hidden when `i3-module` is off, and search would show the raw id as the section title. Moving the folders to `/docs/d4h` and `/docs/d4h-i3` and rewording them is `/avut-docs` work.
- **The scratch `org-dashboard` page is gitignored** and exists only in the main checkout, so no task edits it. After merge it fails typecheck there until it's updated by hand.
- **Rollout:** no production org has either module in use: I3 is behind the `i3-module` flag, which is off in production, and no org has `d4h-views` enabled (confirmed by the user, 2026-10-24). So the brief window between `migrate deploy` and the new deployment going live affects nobody. The migration stays for the dev and preview databases, which have real settings. Merge when no other branch is in either module.
- **Help cards are renamed in-branch** (`content/help/d4h-views.mdx` → `d4h.mdx`, `i3.mdx` → `d4h-i3.mdx`), with the `<HelpButton id>`s that use them. Their `guide:` fields keep pointing at the guides' current slugs.

## Tasks

### Review group A: ids, settings and the dependency rule

- [x] **Task 1: Rename the module ids, settings keys and labels, and add the migration** (feat(modules): rename D4H Views and I3 module ids to d4h and d4h-i3 (#452))
  - **Files:** `src/lib/modules.ts`, `src/lib/schemas/organization-settings.ts`, `prisma/migrations/<timestamp>_rename_d4h_modules/migration.sql` (new), `src/lib/module-flags.ts`, `src/server/module-flags.ts` (+ test), `src/lib/flags.ts` (description only), `src/lib/schemas/organization-role.ts` (`moduleId`), `src/lib/schemas/log-entry.ts` (`moduleByObjectType`), `src/lib/glossary.ts` (+ test), `src/components/nav/org-sidebar-modules.tsx` (map keys only), `src/components/organization-settings/feature-settings-card.tsx`, `src/components/organization-settings/organization-settings-form.tsx`, `src/components/marketing/tools-content.ts`, `src/app/(public)/(marketing)/page.tsx` (`MODULE_COPY` keys and the untyped `NEEDS_D4H` set), every page and layout that calls `isOrganizationModuleUsable(slug, "d4h-views" | "i3")` or `organization.isModuleEnabled("d4h-views" | "i3")`, `content/docs/d4h-views/index.mdx` and `content/docs/i3/index.mdx` (`section:` only), `src/lib/schemas/organization-role.test.ts` (group label "I3" → "D4H I3"), `src/server/services/organization-settings.test.ts`, `src/client/settings-effects.test.ts`, `src/lib/schemas/log-entry.test.ts`, and every other test that names the ids (`grep -rnE '"(d4h-views|i3)"|modules\.(i3|"d4h-views")|\["d4h-views"\]' src`).
  - **Do:**
    - In `modules.ts`, rename the registry entries and `OrganizationModuleId` members to `d4h` / `d4h-i3`, with labels "D4H" / "D4H I3". **Keep `segment` and `href` at `d4h-views` / `i3` for now**, because the route folders move in Task 4 and `route()` is typed against the filesystem.
    - Rename the settings keys in `organizationSettingsSchema.modules` and `OrganizationSettingsSlices` (`modules.d4h`, `modules.d4h-i3`, with `storage` moving along).
    - Write the migration by hand. Two `UPDATE organization_config SET key = …` statements rewrite the `modules.d4h-views.` and `modules.i3.` prefixes, matched with `LIKE 'modules.d4h-views.%'` / `LIKE 'modules.i3.%'`. Use the next timestamp after `20261022202935_d4h_tasks`. **Don't apply it.** The orchestrator runs `db:branch` and applies it with permission.
    - `FLAGGED_MODULE_IDS` and `MODULE_FLAG_EVALUATORS`: `i3` → `d4h-i3` (still `i3ModuleFlag`). The settings form's anchors become `module-d4h` / `module-d4h-i3`, with labels "D4H" / "D4H I3".
    - **Disable-dialog action collision.** `Feature_SettingsCard` builds `disable-${slice after the first "."}`, so `modules.d4h` would produce `disable-d4h`, which the D4H Integration card (`integrations.d4h`) already uses, on the same page. Make the action key unique per slice: the whole slice with dots replaced (`disable-integrations-d4h`, `disable-modules-d4h`). Update the comment there.
    - Leave every internal name listed in Decisions alone.
  - **Done when:** `grep -rnE '"d4h-views"|\bi3:|"i3"' src` finds only the kept names (roles, router, forms, flag key, `i3Template`), plus the `segment`/`href`/route strings Task 4 moves. The two disable dialogs open separately. `npm run check -- --all` passes (it runs `help-cards.test.ts` and `glossary.test.ts`, which a content-only change doesn't trigger), and the migration SQL reads correctly. (The orchestrator applies it to the branch DB, checks with a read-only query that no `modules.i3.` or `modules.d4h-views.` keys remain, and restarts the dev server, since `getOrganizationSettings` is `"use cache"`.)

- [ ] **Task 2: D4H I3 requires D4H**
  - **Files:** `src/lib/modules.ts`, `src/lib/module-flags.ts` (+ test if there is one, else new), `src/hooks/use-organization.tsx` (+ test), `src/server/module-flags.ts` (+ test), `src/app/(wrapper)/(authenticated)/orgs/[slug]/page.tsx`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/notes/[note_id]/page.tsx` and `…/history/page.tsx`, `src/modules/system-admin/components/organizations/organization-content.tsx`, `src/server/services/organization-settings.ts` and/or `src/server/settings-store.ts`, `src/trpc/routers/settings-router.ts` (+ test), `src/client/settings-effects.ts` (+ test).
  - **Do:**
    - Add `requires?: OrganizationModuleId` to `OrganizationModuleDef`, and set `requires: "d4h"` on `d4h-i3`. Read it through an `OrganizationModuleDef`-typed lookup, because with `satisfies` most `Modules[id]` union members have no `requires` property.
    - Change `isModuleUsable` so it also requires the `requires` module to be usable. It needs to know whether _another_ module is enabled for the org, so replace the `enabledForOrganization: boolean` parameter with a lookup (`(id: OrganizationModuleId) => boolean`). `isModuleUsable` handles `alwaysOn` itself from the registry, so callers' lookups don't need to. Update all six callers listed. Keep the function the one rule that the client and server share.
    - Write-through and refusal in the org settings write path, in one transaction with the one audit entry. When a slice write leaves a module enabled whose `requires` module is disabled: if the write turned the required module off, also set the dependent's `enabled` to `false`. If the write turned the dependent on, throw `ConflictError` (`src/lib/errors.ts`) with a message naming the required module's label. Drive this from the registry (`requires`), not a hardcoded pair. The seam is an optional `normalize(existing, next)` passed to `createSettingsStore` by `organization-settings.ts`. It runs in `writeWith` **after** `schema.parse` and **before** flatten/diff, so the write-through lands in `changes`. `settings-store.ts` stays scope-agnostic, and `user-settings-store` is unaffected.
    - **Client cache.** `updateOrganizationSettingsSlice`'s effect (`mergePatchedFields`) copies only the patched fields at the slice's own path, deliberately. Extend it so that when the patched slice is a module, it also merges `enabled` from the returned settings for every module whose `requires` is that module, read from the registry.
  - **Done when:**
    - Tests cover `isModuleUsable` with the dependency (D4H off, so D4H I3 is unusable even when enabled; D4H on, so D4H I3 follows its own flag and the Vercel flag).
    - Tests cover the write-through (saving D4H off also writes `modules.d4h-i3.enabled = false`, and the audit `changes` include both), the refusal (D4H off and saving D4H I3 on gives `CONFLICT`), and that unrelated slices are unaffected.
    - `settings-effects.test.ts` covers the dependent merge: patching D4H off sets D4H I3 off in the cache.
    - `npm run check` passes.

### Review group B: URLs, folders and names (visual)

- [ ] **Task 3: Settings card shows the dependency** · `visual`
  - **Files:** `src/components/organization-settings/organization-settings-form.tsx`, `src/components/organization-settings/feature-settings-card.tsx`, the D4H I3 route layout (`NotEnabledError` message).
  - **Do:** `Feature_SettingsCard` shows **Enable** when a module is off and **Disable** (with a confirm dialog) when it's on. Read the dependency from the registry's `requires`, not a hardcoded `d4h`.
    - **Dependent off, required off:** **Enable** is disabled, with a short muted line: "Turn on D4H to use D4H I3."
    - **Dependent on, required off** (orgs left as they are): show "Inactive until D4H is turned on." Keep **Disable** working.
    - **D4H disable dialog:** the shared copy says "enabling it again brings everything back". For a module that others require, add that D4H I3 will be turned off too and won't come back on by itself.
    - The D4H I3 layout's `NotEnabledError` message mentions that D4H I3 needs D4H.
  - **Done when:**
    - With D4H off, D4H I3's Enable is disabled and explained.
    - Turning D4H off while D4H I3 is on flips the D4H I3 card to off without a reload (Task 2's effect).
    - The blocked-but-on state shows its line and can still be disabled.
    - `npm run check` passes.

- [ ] **Task 4: Move the routes to `/d4h` and `/d4h-i3`** · `visual` · `mechanical`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h-views/**` → `…/d4h/**`, `…/i3/**` → `…/d4h-i3/**` (`git mv`), `src/lib/modules.ts` (`segment`, `href`), `src/lib/trash-registry.ts`, and every `route("/orgs/[slug]/d4h-views…")` / `route("/orgs/[slug]/i3…")` and literal path in `src/` (`grep -rnE '/orgs/\[slug\]/(d4h-views|i3)\b' src`), including emails' links.
  - **Do:** `git mv` both route trees and set `segment`/`href` in the registry. Update every route string, `PageProps`/`LayoutProps` generic, and `Path:` header comment (fix the few headers that already name the wrong path while you're there). Breadcrumb labels "D4H Views" become "D4H" and "I3" becomes "D4H I3", read from `Modules[...].label` where the page already imports `Modules`. Index titles become "D4H" / "D4H I3", with "D4H Views Module - Equipment" becoming "D4H - Equipment". `NotEnabledError` messages name the new labels. Run `npx next typegen` after the move.
  - **Done when:** `grep -rnE '/orgs/\[slug\]/(d4h-views|i3)\b|"/(d4h-views|i3)/' src` finds nothing. `npm run check` passes, and every page under both trees renders.

- [ ] **Task 5: Move the module folders and rename component prefixes** · `mechanical`
  - **Files:** `src/modules/d4h-views/**` → `src/modules/d4h/**`, `src/modules/i3/**` → `src/modules/d4h-i3/**` (`git mv`), their importers (pages under both route trees, `src/components/nav/org-sidebar-modules.tsx`, any `docs/demo-*.tsx`).
  - **Do:** `git mv` the folders and fix the imports. Rename the exported and default-export identifiers in both modules and both route trees, following the new ids: `D4HViewsModule_*`, `D4HViewsModules_*` and `D4HViews_*` become `D4HModule_*` / `D4H_*`, and `I3Module_*` / `I3_*` become `D4HI3Module_*` / `D4HI3_*` (about 74 identifiers, `grep -rhoE '\b(D4HViews(Module|Modules)?|I3Module|I3)_[A-Za-z_]+' src | sort -u`). Leave alone identifiers that name the domain rather than the module (`I3Template…` schemas, `I3TemplateId`, `i3Router`, `i3Effects`).
  - **Done when:** that grep returns nothing, `src/modules/` lists `d4h` and `d4h-i3`, and `npm run check` passes (the module-boundary lint included).

- [ ] **Task 6: Help cards, developer docs and leftovers** · `visual` · `mechanical`
  - **Files:** `content/help/d4h-views.mdx` → `content/help/d4h.mdx`, `content/help/i3.mdx` → `content/help/d4h-i3.mdx` (`git mv`), every `<HelpButton id="d4h-views" | "i3">`, `src/components/docs/help-button.tsx` (doc comment example), `src/client/d4h-api-effects.ts` (comment), `AGENTS.md` (the `forms` bullet's "reached through `i3`"), `docs/patterns/mutation-dialog.md`, `docs/patterns/route-access-control.md`, `README.md` (module table), `.github/ISSUE_TEMPLATE/feature_request.yml` (example module ids), `.claude/skills/avut-test-in-browser/SKILL.md` (module table), the marketing page's hero and FAQ copy ("D4H Views and I3"), `src/lib/glossary.ts` (the "D4H" entry text) and `src/lib/forms.ts` (descriptions).
  - **Do:** Rename the cards and their `title:` ("D4H", "D4H I3"), and reword their copy only where it names the module ("I3 tracks equipment…" becomes "D4H I3 tracks equipment…"). Keep the role names "I3 Editor" / "I3 Admin". Keep each card's `guide:` at the current guide slug (see Decisions). Update the HelpButton ids, and the developer docs' example paths and ids. Finish with a sweep of `src`, `content/help`, `docs/patterns` and `AGENTS.md` for `d4h-views` / `D4H Views` (should be none) and for module-sense `i3` (should be only the kept names).
  - **Done when:** the help sheet opens on both modules' index pages with the new titles, the sweep is clean, and `npm run check -- --all` passes.

Visual checkpoint after Task 6: the sidebar and module switcher, both index pages, a few deep pages in each tree, the org dashboard tiles, and the settings page with D4H on and off.

## Docs impact

D4H Views and I3 are renamed to D4H and D4H I3, and D4H I3 now needs D4H. Move and reword the guides `content/docs/d4h-views/` → `d4h/` and `i3/` → `d4h-i3/`, fix the links to them in `admin/` and `account/` and the help cards' `guide:`, and reshoot sidebar, breadcrumb, index-page and module-settings screenshots.

## Out of scope

- Renaming roles, the `i3` router, permission resources, form keys, Prisma models or the Vercel flag key (see Decisions).
- Redirects from the old URLs.
- Moving or rewording the end-user guides (Docs impact).
- Anything from the later #456 stages: the permission family (#457), the team-scoped browser (#453), template provenance (#454), Kinds → Types (#455).

## Parked

(none yet)
