# D4H I3 data-quality rules for issued items

**Date:** 2026-11-19
**Issue:** [#519](https://github.com/redcloud-nz/avut/issues/519) (milestone v0.13 - nucula), part
of [redcloud-nz/avut-ideas#39](https://github.com/redcloud-nz/avut-ideas/issues/39). Builds on
#518 (bundles, merged; see `docs/plans/2026-11-18-i3-bundles.md`).
**Branch:** `feat/i3-data-quality`, worktree `.claude/worktrees/i3-data-quality`
**DB:** adds a migration. `npm run db:branch i3-data-quality` before Task 1's `migrate dev` (it
needs every connection to `avut` closed), and `npm run db:unbranch` once merged.
**Written against:** integration @ ba30fb40

Issued equipment in D4H is often recorded with a missing size, a blank brand and model, a stray
model or the wrong brand. Templates get a **Brand & Model** setting (Required / Optional / None),
and their variants become the list of valid brand/model pairs. One shared helper sorts each held
item into **OK**, **Incomplete** or **Doesn't match**, and two screens show it: the per-type
Issued Types page for a team, and the bundle comparison.

## Decisions

- **`brandModelRule I3BrandModelRule @default(Optional)`** on `I3Template_D4H`, next to
  `requireSN`, with a new Prisma enum `I3BrandModelRule { Required Optional None }`:
  - **Required:** items need a model, and so a brand (the model belongs to a brand).
  - **Optional:** today's behaviour, and the default, so existing templates are unchanged. A
    blank brand and model is fine; a set one must be one of the variants (if there are any).
  - **None:** the type has no meaningful brand or model (whistles, say), so the correct record
    leaves both blank. A set brand or model is wrong.

  An enum rather than two switches, so the form can't say both "required" and "must be blank".
  In the UI the setting is **Brand & Model**. It goes through the existing
  `createTemplate`/`updateTemplate` paths (they spread `d4h` into the nested write, and
  `diffObject` logs the change), so no router change beyond the schema.

- **The rules come from the template:** `requireSN`, `brandModelRule`, and the brand/model
  pairs of its variants that have D4H records (`I3TemplateVariant.d4h` non-null). Variants without
  D4H records are ignored. Every variant counts, whether or not it fits the team: the rule is
  about what the item should be, not what can be issued here. A **None** template ignores its
  variants for the check (the variant form isn't changed to stop them).
- **The states**, for one item against one template, matching by D4H id (not title):
  - **Incomplete** if any required part is blank: serial (when `requireSN`; `null` or
    whitespace counts as blank), model (when Required; `model` null or `model.id` null),
    brand (when Required; `brand.id` null). The helper reports which parts are missing.
  - Otherwise **Doesn't match** if:
    - the rule is **None** and the item has a brand or a model set (the badge's tooltip says the
      template expects no brand or model); or
    - the template has D4H variants and the item has a brand that no variant accepts: with a
      model, the brand/model pair must be a variant's; without a model (only possible when
      Optional), the brand must be some variant's brand.
  - Otherwise **OK**. On an Optional template, an item with no brand has nothing to match, so
    it's OK. An Optional or Required template with no D4H variants skips the variant match.
  - Incomplete wins over Doesn't match: the blank part is the first thing to fix.
  - The helper reports _why_ it doesn't match (`mismatch: "not-a-variant" | "should-be-blank"`)
    so the badge tooltip can say which.
- **The helper is pure and module-private:** `src/modules/d4h-i3/lib/item-quality.ts`, beside
  `bundle-compare.ts`, structurally typed so it takes `listTeamIssuedEquipment` items, `listTemplates`
  templates and bundle lines alike.
- **Several templates on one D4H type** (nothing stops it): on Issued Types the item is judged
  against each Active template of the type and takes the **best** state (OK if any template
  accepts it), since any one of them may be how the item was issued. The bundle comparison
  judges a cell against that line's own template.
- **Bundle cells:** `BundleCell.state` keeps its meaning, `"held" | "missing"` ("has the kit"),
  so `heldCount`, `columnTotals` and "n of m held" are unchanged and no existing `=== "held"`
  check changes meaning. A new `BundleCell.quality: ItemQualityState | null` (null when missing)
  is the **worst** quality among its counted items (incomplete > mismatch > ok), so one bad
  record is never hidden behind a good one. `items` becomes `{ item: I; quality: ItemQualityResult }[]`
  so the member page can badge each one. Lost items aren't judged.
- **Two bundle lines on one D4H type** (e.g. "Boots – leather" and "Boots – rubber"): #518
  already counts the same item as held in both columns. Each column judges it against its own
  template, so leather boots can be OK in one column and "Doesn't match" in the other. Accepted
  for now, like #518's double-count; a test pins it.
- **LOST items aren't judged anywhere:** no badge on Issued Types, and they're left out of its
  counts, matching the bundle side.
- **The bundle line carries the rules.** `I3BundleLine.template` gains `requireSN`,
  `brandModelRule` (inside `d4h`) and `variants: { brandId, modelId }[]` (D4H variants only), loaded
  by `I3Bundles.getWithLines`. The comparison page needs no extra query. `ItemQualityRules` uses
  the same flat shape, so `compareBundle` builds a line's rules inline
  (`{ requireSN, brandModelRule, variants }`); `qualityRulesForTemplate` converts only the
  `listTemplates` shape (`variants[].d4h`).
- **Caches:** variants now feed `i3Bundles.getBundle`, so `createTemplateVariant`,
  `updateTemplateVariant` and `deleteTemplateVariant` in `src/client/i3-effects.ts` invalidate
  `trpc.i3Bundles.pathFilter()` as the template effects already do. Otherwise "add the variant,
  go back to the comparison" would still say "Doesn't match" for up to 10 minutes.
- **No D4H token:** unchanged. No new D4H calls; both screens already depend on D4H and fall
  back to their error boundaries, and `listTemplates` doesn't touch D4H.
- **Issued Types reads the rules from `i3.listTemplates`** (`i3Template: ["view"]`). The page is
  open to anyone with `d4hEquipment: ["view"]`, which includes plain `member`s, who can't read
  templates. So the quality column, the count and the filter appear only when
  `useHasPermission({ i3Template: ["view"] })` holds (both I3 roles have it). The client uses a
  non-suspense `useQuery` with `enabled` on that boolean, a deliberate deviation from
  `docs/patterns/detail-page-data-fetching.md` that the code explains in a comment. `page.tsx`
  doesn't prefetch it (that would run a FORBIDDEN call on the server for every plain member);
  the column appears once the query lands. A type with no Active template shows no quality
  column.
- **What Issued Types shows** for a type with rules: a **Check** column (always shown, not in the
  Show Columns menu) holding a badge for flagged items: "Incomplete" with the missing parts in its
  text ("No model", "No brand or model", "No serial number"…), or "Doesn't match" with a tooltip
  naming the item's brand/model and saying it isn't one of the template's variants. OK items show
  nothing. Above the table, a count: "3 incomplete · 2 don't match" (or "All items pass the
  template's checks"). A **Only show flagged items** checkbox in the Actions menu filters the rows;
  with it on and nothing flagged, the empty state reads "No flagged items." rather than "No X is
  issued…".
- **One badge component** for both screens: `D4HI3Module_ItemQuality_Badge` in
  `src/modules/d4h-i3/components/item-quality-badge.tsx`, amber like `other-records-flag.tsx`
  for both states (they're both "fix the D4H record"), with the label telling them apart.
- **Help:** the bundles card (`content/help/d4h-i3/bundles.mdx`) explains the new cell states.
  Templates and Issued Types have no help card today, and this doesn't add one.

## Tasks

### Review group A: data layer

- [x] **Task 1: `brandModelRule` on the template** (feat(d4h-i3): add a brand & model rule to I3 templates)
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_i3_template_brand_model_rule/migration.sql`
    (new, generated), `src/lib/schemas/i3-template.ts`, and any test fixture that builds an
    `I3Template.d4h` object literally (e.g. `src/forms/i3-issue-items/processor.test.ts`,
    `src/server/services/i3-templates.test.ts`, `src/trpc/routers/i3-router.test.ts`; find them
    with `grep -rn requireSN src`).
  - **Do:** Add `enum I3BrandModelRule { Required Optional None }` and
    `brandModelRule I3BrandModelRule @default(Optional)` to `I3Template_D4H` after `requireSN`.
    Before `migrate dev`: stop any dev server of this worktree, ask the user to close every other
    connection to `avut` (their 3000 server, Prisma Studio, other worktrees' servers) and run
    `npm run db:branch i3-data-quality`. Then, **with the user's permission**,
    `npm run prisma migrate dev --name i3_template_brand_model_rule`. In
    `src/lib/schemas/i3-template.ts`, add an `I3BrandModelRule` export (`schema: z.enum([...])`,
    `values`, and `label`/`description` per value for the form: "Required" / "Items need a
    model, and so a brand.", "Optional" / "Brand and model may be blank. If set, they must be one
    of the variants.", "None" / "This type has no meaningful brand or model. Leave them blank.")
    and add `brandModelRule: I3BrandModelRule.schema` to the `d4h` object in `i3TemplateSchema`.
    Update fixtures so they typecheck.
  - **Done when:** the migration only adds the enum type and the column with its default `Optional`, `npx prisma migrate status`
    against the branch DB is clean, and `npm run check` passes.

- [x] **Task 2: Bundle lines carry the quality rules** (feat(d4h-i3): carry template quality rules on bundle lines)
  - **Files:** `src/lib/schemas/i3-bundle.ts`, `src/server/services/i3-bundles.ts`,
    `src/server/services/i3-bundles.test.ts`, `src/trpc/routers/i3-bundles-router.test.ts` if its
    fixtures build lines, `src/client/i3-effects.ts`.
  - **Do:** In `i3BundleLineSchema`, add `requireSN` and `brandModelRule` to `template.d4h`, and
    `variants: z.array(z.object({ brandId: z.number(), modelId: z.number() }))` to `template`.
    In `i3-bundles.ts`, extend `lineTemplateInclude` to include the template's variants with
    their `d4h`, and `toLine` to map the D4H variants (skip those with `d4h` null) to
    `{ brandId, modelId }`. Keep the existing sort. In `i3-effects.ts`, add
    `invalidate(trpc.i3Bundles.pathFilter())` to `createTemplateVariant`,
    `updateTemplateVariant` and `deleteTemplateVariant`, with a comment like the existing "A
    bundle page shows…" ones, and update the `updateTemplate` comment to mention the rules.
  - **Done when:** a service test shows `getWithLines` returning the rules and only D4H variants,
    and `npm run check` passes.

- [x] **Task 3: The item-quality helper** (feat(d4h-i3): add the issued-item quality helper)
  - **Files:** `src/modules/d4h-i3/lib/item-quality.ts` (new),
    `src/modules/d4h-i3/lib/item-quality.test.ts` (new).
  - **Do:** A pure module (no server or React imports), structurally typed like
    `bundle-compare.ts`:
    - `type ItemQualityRules = { requireSN: boolean; brandModelRule: "Required" | "Optional" | "None"; variants: readonly { brandId: number; modelId: number }[] }`;
    - `type ItemQualityResult = { state: ItemQualityState; missing: ("brand" | "model" | "serial")[]; mismatch: "not-a-variant" | "should-be-blank" | null }`;
    - `qualityRulesForTemplate(template)` building rules from a template shaped like
      `listTemplates` output (`d4h` with `requireSN`/`brandModelRule`, `variants[].d4h`), or `null`
      when the template has no D4H type;
    - `type ItemQualityState = "ok" | "incomplete" | "mismatch"`;
    - `checkItemQuality(item, rules)` → `ItemQualityResult`,
      where `item` is `{ serial: string | null; brand: { id: number | null }; model: { id: number | null } | null }`,
      following the rules in Decisions exactly;
    - `bestQuality(results)` and `worstQuality(results)` over a list of results (OK < mismatch <
      incomplete), for Issued Types and the bundle cell;
    - `missingPartsLabel(missing)` → "No model", "No brand or model", "No serial number", "No model
      or serial number"… (sentence case, brand before model before serial).
  - **Done when:** tests cover each rule: serial required and blank / whitespace; Required
    with model blank, brand blank, both blank; mismatch by pair, by brand only (Optional), no
    brand on an Optional template (OK), no D4H variants (match skipped); None with both blank
    (OK, even with variants), with a brand set, with a model set (`should-be-blank`), and None
    plus a blank required serial (incomplete);
    incomplete winning over mismatch; best/worst ordering; the labels. `npm run check` passes.

- [x] **Task 4: The bundle comparison's quality states** (feat(d4h-i3): judge bundle cells against their line's template)
  - **Files:** `src/modules/d4h-i3/lib/bundle-compare.ts`,
    `src/modules/d4h-i3/lib/bundle-compare.test.ts`.
  - **Do:** Widen `BundleCompareLine.template.d4h` with `requireSN` and `brandModelRule`, and add
    `template.variants`. Widen `BundleCompareItem` with `serial`, `brand: { id }` and
    `model: { id } | null` (all present on `listTeamIssuedEquipment` items). Leave
    `BundleCellState` as `"held" | "missing"` and replace its "#519 widens this" comment with one
    pointing at `quality`. Add `quality: ItemQualityState | null` to `BundleCell`: the
    `worstQuality` of its counted items, `null` when missing. Change `items: I[]` to
    `items: { item: I; quality: ItemQualityResult }[]`; `lost` stays `I[]`. Build each line's
    rules inline from `template.d4h` and `template.variants`. Update the file's header comment.
    Fix the type errors in `bundle-matrix.tsx` / `bundle-member-comparison.tsx` minimally (read
    `.item`), so the build stays green; Task 7 does the real UI.
  - **Done when:** tests cover a held cell of each quality, a missing cell (`quality` null),
    worst-of across two items, that incomplete and mismatch cells still count in `heldCount` and
    `columnTotals`, and two lines on one kind judging the same item against their own templates.
    Existing tests pass with their fixtures widened. `npm run check` passes.

### Review group B: UI (visual)

- [ ] **Task 5: Brand & Model on the template forms and page** — `visual`, `mechanical`
  - **Files:** `src/modules/d4h-i3/components/templates/create-template.tsx`,
    `src/modules/d4h-i3/components/templates/update-template.tsx`,
    `src/modules/d4h-i3/components/templates/template-content.tsx`.
  - **Do:** Add a `d4h.brandModelRule` field after `d4h.requireSN`, labelled **Brand & Model**:
    a radio group (or a select, if the forms already use one for small enums; check
    `src/components/ui/README.md`) over `I3BrandModelRule.values`, each option showing its
    label and description from the schema module. Default `"Optional"` in
    `create-template.tsx`. On the template page, add a **Brand & Model** data item after
    **Require Serial Number** showing the rule's label.
  - **Done when:** creating and editing a template saves the setting (it shows on the template page
    and in the template's history diff), and `npm run check` passes.

- [ ] **Task 6: Quality on the Issued Types type page** — `visual`
  - **Files:** `src/modules/d4h-i3/components/item-quality-badge.tsx` (new),
    `src/modules/d4h-i3/components/issued-types/issued-type-content.tsx`,
    `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types/[type_id]/page.tsx`.
  - **Do:** Build `D4HI3Module_ItemQuality_Badge({ result, item })`: nothing for `ok`; an amber
    outline badge (style as `other-records-flag.tsx`) reading `missingPartsLabel(...)` for
    `incomplete`, and "Doesn't match" for `mismatch`, with a tooltip naming the item's brand and
    model titles ("— " for blank) and saying why, from `result.mismatch`: "isn't one of the
    template's variants" or "this template expects no brand or model". Then, on
    the type page, per Decisions (and `docs/patterns/detail-page-data-fetching.md`, from which
    the non-suspense query deliberately deviates, with a comment saying why):
    `useHasPermission({ i3Template: ["view"] })` gates a non-suspense `useQuery` of
    `trpc.i3.listTemplates` (no prefetch in `page.tsx`); take the Active templates whose
    `d4h.kindId === typeId`, build their rules with `qualityRulesForTemplate`, and judge each
    non-LOST row with `bestQuality` over them. When there are rules, add the **Check** column
    after Issued To, the count line above the table, and the **Only show flagged items**
    checkbox (in its own group in the Actions menu), with the "No flagged items." empty state.
    While the templates query is loading, render the table without the column rather than
    suspending. Keep the Returned badge as is.
  - **Done when:** as an I3 Editor, a type with a Required template flags items with no
    model, a type with variants flags a non-matching brand, and a None template flags an item
    with a brand or model set; the count and the filter agree;
    as a plain member, the page looks as it does today. `npm run check` passes.

- [ ] **Task 7: Quality in the bundle comparison** — `visual`
  - **Files:** `src/modules/d4h-i3/components/bundles/bundle-matrix.tsx`,
    `src/modules/d4h-i3/components/bundles/bundle-member-comparison.tsx`,
    `content/help/d4h-i3/bundles.mdx`.
  - **Do:** In the matrix, `CellMark` takes the cell's `state` and `quality`: held with `ok`
    stays the green check; held with `incomplete` or `mismatch` uses an amber `AlertWarningIcon`
    with `aria-label`/`title` "<template>, held, incomplete" / "…, held, doesn't match". Add a
    small legend under the matrix header naming the four marks (held, incomplete, doesn't match,
    missing). On the member page, a line's status
    reads Held / Incomplete / Doesn't match / Missing, and each counted item shows its
    `D4HI3Module_ItemQuality_Badge`. In the help card, after the **Held** paragraph, add that a
    held item can be **incomplete** (a part the template requires is blank: brand, model or
    serial) or **doesn't match** (its brand and model aren't one of the template's variants, or
    are set on a template whose type has no brand or model), and that both still count as held.
  - **Done when:** a bundle compared against a team with a flagged item shows the amber mark in
    the matrix and the badge on the member page; the held counts are unchanged; `npm run check`
    passes.

## Docs impact

Brand & Model setting on templates, quality flags on Issued Types and the bundle comparison: `content/docs/d4h-i3/` templates, issued-types and bundles pages; screenshots of the template form, an Issued Types type page and the bundle matrix.

## Out of scope

- Enforcing **Brand & Model** when issuing (the Issue form requiring a variant). This issue only
  reports existing records.
- Fixing records from AVUT (emailed forms, D4H update tasks): stays in redcloud-nz/avut-ideas#39.
- Per-type flagged counts on the team's Issued Types list.
- Detecting a correct-looking wrong record (new boots under the old brand): not possible from the
  data, per the issue.

## Parked

(none yet)
