# Skill and skill group detail pages in Skill Track

**Date:** 2026-10-19
**Issues:** [#415](https://github.com/redcloud-nz/avut/issues/415) (skill page), [#416](https://github.com/redcloud-nz/avut/issues/416) (group page). Follow-ups to #257 / PR #414.
**Branch:** `feat/skill-details-page`, worktree `.claude/worktrees/skill-details-page` (dev server on its `.dev-port`, 3106)
**DB:** no migration; shared `avut`.
**D4H:** not involved.
**Written against:** integration @ 095add1a

## Decisions

- **Two routes.**
  - Skill: `/orgs/[slug]/skill-track/skills/[skill_id]`.
  - Group: `/orgs/[slug]/skill-track/catalogue/[package_id]/groups/[group_id]`, nested under its package (#416).
  - Both follow `docs/patterns/detail-page-data-fetching.md`. `page.tsx` holds `generateMetadata` (awaited `fetchQuery`) plus a `prefetch`. A `"use client"` content component in `src/modules/skill-track/components/` renders `Std.Navbar`, `Std.ScrollContainer` and `Saratoga.Columns`, the way `catalogue-package-content.tsx` does.
- **Visibility is the catalogue's rule** (decided with the user 2026-10-19). Anyone holding `skillPackageSubscription: ["view"]` can open a skill or group page for any package the catalogue shows: every available package, plus a withdrawn (unpublished or Archived, not Deleted) package the organization still subscribes to. That is `catalogueSkillPackageWhere(organizationId)` in `skill-package-subscriptions-router.ts`, the rule `getPackage` already uses.
  - The user doesn't consider tags, properties or timestamps sensitive for non-subscribers. So the new procedures return the full `Skill`/`SkillGroup` schemas, dates included, to subscribers and non-subscribers alike.
  - The comment on `catalogueSkillSchema`, and the existing test `"doesn't leak properties/tags/timestamps on catalogue groups and skills"`, frame the pick as a privacy boundary. Reword both in Task 1: the pick keeps the catalogue payload small. `getPackage` itself is unchanged.
  - A Deleted skill or group, or one whose package is outside the rule, is `NOT_FOUND` (`Messages.skillNotFound` / `Messages.skillGroupNotFound`).
  - An **Archived** skill or group is returned (not-Deleted, as `listAssessableSkills` does), and the page shows an **Archived** badge. The Skills list links archived rows, so their pages must open.
- **A skill in a Deleted group still opens.** `deleteGroup` is soft and doesn't cascade, so an Active skill can sit in a Deleted group, and the Skills list already shows it (with `row.group` undefined).
  - `getSkill` doesn't filter on group status. It returns `group: SkillGroup | null`, which is null when the group is Deleted.
  - The skill page then shows Group as "—", matching the list.
  - Whether `deleteGroup` should cascade is parked.
- **The group must belong to the package in the URL.** `getGroup` takes `{ skillPackageId, skillGroupId }` and is `NOT_FOUND` when the group's `skillPackageId` differs.
- **Each procedure returns its package and the organization's subscription state**, so the page can show the withdrawn note and gate the coverage link without a second query:
  - `skillPackage: SkillPackage.schema` (for `name`, `published`, `status`)
  - `subscribed: boolean`
- **The coverage link only** (decided with the user 2026-10-19). The skill page lists no checks. Its header has a "Skill Coverage" link, inside `<Protect permissions={{ skillCheck: ["view"] }}>`.
  - The link is `` `${route("/orgs/[slug]/skill-track/reports/skill", { slug })}?skill=${id}` ``, as `session-contents.tsx` builds query links.
  - It renders only when `subscribed && SkillPackage.isAvailable(skillPackage) && skill.status === "Active"`. The report (`getCompetencyMatrix`) covers only Active skills in available subscribed packages. An archived skill's id there shows "Unknown Skill".
- **Subscribe and unsubscribe invalidate the new queries.** `skillPackageSubscriptionsEffects.subscribeToPackage` and `.unsubscribeFromPackage` (`src/client/skill-package-subscriptions-effects.ts`) gain `invalidate(trpc.skillPackageSubscriptions.getSkill.queryFilter({ organizationId }))` and the same for `getGroup`. `subscribed` would otherwise be stale after a subscribe on the catalogue page. Invalidate, don't write: the effect doesn't know which skills belong to the package.
- **Breadcrumbs.**
  - Skill page: Skill Track › Skills › <skill name>. Its home is the Skills list, as #415 says, even when it's reached from the catalogue.
  - Group page: Skill Track › Catalogue › <package name> › <group name>.
- **Help cards are shared with each page's parent screen**, per `content/README.md` ("One card or shared"): both new pages are read-only, like their parents.
  - The skill page uses `skill-track/skills`, which gains a paragraph on the skill page.
  - The group page uses `skill-track/catalogue`, which gains a paragraph on group and skill pages.
  - When the customisation controls (#21, #42, #40) land, they split into cards of their own.
- **The frequency format is shared.** The Skills list formats `frequency` inline ("N months", "1 month", "None"). Move it to `formatFrequency(months)` in `src/modules/skill-track/lib/format-frequency.ts` (module-private: only Skill Track uses it). The Skills list and the skill page both call it.
- **Layout leaves room for customisation.** The org's settings for a skill or group will go in a card of their own in the main column, below the information card. Don't add an empty placeholder card now: name the information card "Skill Information" / "Group Information" so the next card has somewhere to sit.

## Tasks

### Review group A: data layer

- [x] **Task 1: `skillPackageSubscriptions.getSkill`** (feat(skill-track): add skillPackageSubscriptions.getSkill)
  - **Files:** `src/trpc/routers/skill-package-subscriptions-router.ts`, `src/trpc/routers/skill-package-subscriptions-router.test.ts`
  - **Do:** Add `getSkill: organizationProcedure({ skillPackageSubscription: ["view"] })`, placed after `getPackage` (procedures are alphabetical, per `src/trpc/CLAUDE.md`).
    - Input `{ skillId: SkillId.schema }`.
    - Query `ctx.prisma.skill.findFirst` where `id: skillId`, `status: { not: "Deleted" }`, `skillPackage: catalogueSkillPackageWhere(organizationId)`. Include `skillGroup`, plus `skillPackage` with `subscriptions: { where: { organizationId }, select: { id: true } }`.
    - Not found → `TRPCError NOT_FOUND`, `Messages.skillNotFound(skillId)`.
    - Output `Skill.schema.extend({ group: SkillGroup.schema.nullable(), skillPackage: SkillPackage.schema, subscribed: z.boolean() })`, built with each schema's `fromRecord`.
      - `group` is null when the skill's group is Deleted (see Decisions).
      - The output key is `group`, as in the Skills list's `SkillRow`, not Prisma's `skillGroup`. Say so in the doc comment.
    - Doc-comment it like `getPackage`: what's returned, the visibility rule, and the throws.
    - Reword the `catalogueSkillSchema` comment, and rename the existing "doesn't leak…" test, e.g. "keeps the catalogue contents payload to the picked fields".
    - Tests follow `.claude/rules/testing.md` (prisma-mock, `createCaller`, fixture ids). Cover:
      - a skill in a subscribed, available package (`subscribed: true`)
      - a skill in an available package the org doesn't subscribe to (`subscribed: false`)
      - a skill in a withdrawn package the org subscribes to (returned)
      - a withdrawn package the org doesn't subscribe to (`NOT_FOUND`)
      - a Deleted package the org still subscribes to (`NOT_FOUND`)
      - an Archived skill (returned)
      - a skill in a Deleted group (returned, `group: null`)
      - a Deleted skill (`NOT_FOUND`)
      - a caller without `skillPackageSubscription: ["view"]` (`FORBIDDEN`)
  - **Done when:** the tests pass and `npm run check` is clean.

- [x] **Task 2: `skillPackageSubscriptions.getGroup`** (feat(skill-track): add skillPackageSubscriptions.getGroup)
  - **Files:** `src/trpc/routers/skill-package-subscriptions-router.ts`, `src/trpc/routers/skill-package-subscriptions-router.test.ts`
  - **Do:** Add `getGroup: organizationProcedure({ skillPackageSubscription: ["view"] })`, placed before `getPackage`.
    - Input `{ skillPackageId: SkillPackageId.schema, skillGroupId: SkillGroupId.schema }`.
    - Query `ctx.prisma.skillGroup.findFirst` where `id: skillGroupId`, `skillPackageId`, `status: { not: "Deleted" }`, `skillPackage: catalogueSkillPackageWhere(organizationId)`.
    - Include `skills: { where: { status: { not: "Deleted" } }, orderBy: { sequence: "asc" } }`, plus `skillPackage` with the organization's `subscriptions` as in Task 1.
    - Not found → `NOT_FOUND`, `Messages.skillGroupNotFound(skillGroupId)`.
    - Output `SkillGroup.schema.extend({ skillPackage: SkillPackage.schema, subscribed: z.boolean(), skills: z.array(Skill.schema) })`.
    - Tests cover the package-visibility cases of Task 1 (subscribed, unsubscribed, withdrawn±subscribed, Deleted package, permission), plus:
      - an Archived group (returned)
      - a Deleted group (`NOT_FOUND`)
      - a group id paired with a different package id (`NOT_FOUND`)
      - Archived skills listed and Deleted skills left out, in `sequence` order
  - **Done when:** the tests pass and `npm run check` is clean.

- [x] **Task 3: invalidate the new queries on subscribe/unsubscribe** (feat(skill-track): invalidate skill and group queries on subscription change)
  - `mechanical`
  - **Files:** `src/client/skill-package-subscriptions-effects.ts`
  - **Do:** In both `subscribeToPackage` and `unsubscribeFromPackage`, add `invalidate(trpc.skillPackageSubscriptions.getSkill.queryFilter({ organizationId: vars.organizationId }))` and the same for `getGroup`, next to the existing `invalidate`s. Follow the file's existing shape.
  - **Done when:** `npm run check` is clean.

### Review group B: pages and entry points (visual checkpoint at the end)

- [ ] **Task 4: skill detail page**
  - `visual`
  - **Files:**
    - new `src/app/(wrapper)/(authenticated)/orgs/[slug]/skill-track/skills/[skill_id]/page.tsx`
    - new `src/modules/skill-track/components/skill-content.tsx`
    - `content/help/skill-track/skills.mdx`
  - **Do:** Follow `docs/patterns/detail-page-data-fetching.md`, with `catalogue/[package_id]/page.tsx` + `catalogue-package-content.tsx` as the closest example. Run `npx next typegen` after adding the page.
    - `page.tsx`:
      - `generateMetadata` fetches `getSkill` and sets the title to `<skill> · Skills`, using `TITLE_SEPARATOR`.
      - The body `prefetch`es it and renders `<SkillTrack_Skill_Content skillId={…} />` in `HydrateClient`.
    - `skill-content.tsx` (`SkillTrack_Skill_Content`):
      - `useSuspenseQuery(getSkill)`.
      - `Std.Navbar` with the breadcrumbs from Decisions and `actions={<HelpButton id="skill-track/skills" />}`.
      - `Saratoga.Header`: the title is the skill name, plus an `Archived` outline badge when the skill isn't `Active` or its (non-null) group isn't `Active`. `Saratoga.Actions` holds the Skill Coverage link button, gated as in Decisions, as a `Button asChild` around a `Link`.
      - When the package isn't available, show the withdrawn note as `catalogue-package-content.tsx` does. Only a subscriber can reach a withdrawn package.
      - Main column, card "Skill Information" (`DataList`/`DataItem`):
        - Name, and Description (block)
        - Group: plain text for now, "—" when null. Task 5 makes it a link, once the group route exists.
        - Package: link to `catalogue/[package_id]`
        - Frequency: format inline as the Skills list does; Task 6 extracts the helper.
        - Tags (secondary badges, or "None")
        - Required (Yes/No), Included by default (Yes/No)
      - Secondary column card: Skill ID, Created, Updated (`DataItemDateValue`).
    - `skills.mdx`: add a short paragraph on the skill page.
      - It shows a skill's details, which the package's author sets.
      - What the Archived badge and the withdrawn note mean.
      - The Skill Coverage link: who sees it, and that it's absent for an archived skill.
      - Keep the card under ~150 words (`wc -w`), tightening the existing text if needed.
  - **Done when:** the page renders for a subscribed skill, an unsubscribed one, an archived one (no coverage link) and one in a Deleted group. `npm run check` is clean.

- [ ] **Task 5: skill group detail page**
  - `visual`
  - **Files:**
    - new `src/app/(wrapper)/(authenticated)/orgs/[slug]/skill-track/catalogue/[package_id]/groups/[group_id]/page.tsx`
    - new `src/modules/skill-track/components/group-content.tsx`
    - `src/modules/skill-track/components/skill-content.tsx` (Group becomes a link)
    - `content/help/skill-track/catalogue.mdx`
  - **Do:** Same pattern as Task 4. Run `npx next typegen`.
    - The title is `<group> · <package>`.
    - `SkillTrack_SkillGroup_Content`:
      - Breadcrumbs from Decisions, with the package crumb linked. `HelpButton id="skill-track/catalogue"`.
      - Title is the group name, with an `Archived` badge when the group isn't `Active`, and the withdrawn note as in Task 4.
      - Main column:
        - Card "Group Information": Name, Description, Package (link), Tags, Included by default (Yes/No).
        - Card "Skills": the group's skills in order, styled like the `<ul>` in `PackageGroup` (`catalogue-package-content.tsx`). Each skill name links to its skill page and carries the same Required / Not included by default badges, plus `Archived` for a non-Active skill. When the group has no skills, say "No skills in this group."
      - Secondary column card: Group ID, Created, Updated.
    - In `skill-content.tsx`, the Group value becomes a `Link` to the group page when `group` isn't null.
    - `catalogue.mdx`: a sentence or two saying a group opens its own page, listing its skills, and that each skill opens its page. Stay under ~150 words.
  - **Done when:**
    - The page renders for a group in a subscribed package and in an unsubscribed one.
    - A group id under the wrong package 404s.
    - The skill page's Group links to the group page.
    - `npm run check` is clean.

- [ ] **Task 6: entry points and `formatFrequency`**
  - `visual`, `mechanical`
  - **Files:**
    - new `src/modules/skill-track/lib/format-frequency.ts`
    - `src/modules/skill-track/components/skills-list.tsx`
    - `src/modules/skill-track/components/skill-content.tsx`
    - `src/modules/skill-track/components/catalogue-package-content.tsx`
  - **Do:**
    - `formatFrequency(months: number): string` returns "None" for 0, "1 month" for 1, and "N months" otherwise. The Skills list's Frequency cell and the skill page both call it.
    - Skills list. Follow the Package cell's `Link` + `route()` in the same file:
      - The Skill cell's name becomes a `Link` to `skills/[skill_id]`. Keep the Archived badge outside the link.
      - The Group cell becomes a `Link` to `catalogue/[package_id]/groups/[group_id]` when `row.group` exists. Add a `cell` to the existing group accessor.
    - Catalogue `PackageGroup`:
      - The group `<h3>` name links to the group page.
      - Each skill name links to the skill page.
      - `PackageGroup` needs the org slug and package id: take them as props, or `useOrganization()` inside.
  - **Done when:** every link lands on the right page, and `npm run check` is clean.

**Visual checkpoint** after Task 6: the Skills list, a catalogue package page, a skill page and a group page.

## Docs impact

New Skill and Skill Group pages, reached from the Skills list and the catalogue package page. `content/docs/skill-track/catalogue.mdx` should mention them. There are new screenshots of both pages, and the Skills list and catalogue package screenshots change slightly (linked names).

## Out of scope

- Any org customisation of a skill or group: include/required/frequency overrides (#21), custom properties (#42), `requiredByTags` (#40).
- A checks list on the skill page (decided with the user: the coverage link only).
- Showing `properties` on either page. They come with #42.
- History for subscribers (see `docs/plans/2026-10-17-skill-history.md`: a cross-org read that needs its own design).
- Changing `getPackage`'s returned fields.

## Parked

- `deleteGroup` (`src/server/services/skill-packages.ts`) soft-deletes a group without cascading to its skills, so Active skills in a Deleted group stay assessable and appear in the Skills list with no group. Decide whether to cascade or block the delete.
