# D4H: say "Type", and cross-link related records

**Date:** 2026-10-25
**Issue:** [#455](https://github.com/redcloud-nz/avut/issues/455) (part of #456)
**Branch:** `feat/d4h-cross-links`, worktree `.claude/worktrees/d4h-cross-links`
**DB:** no migration. Shared `avut`. No router changes: every link site already has the ids it needs.
**Written against:** integration @ f2e5511e

Finish the "Kind" → "Type" wording that #453 started (it is left only on the D4H I3 template screens and the D4H I3 help card), and make every D4H team, member, item, category, type, brand and model name inside the `d4h` and `d4h-i3` modules a link, using new D4H entity-link wrappers.

## Decisions

- **Links stay inside `d4h` and `d4h-i3`.** No links between D4H records and AVUT teams/people (`Team_D4H`, `TeamMembership_D4H`) in either direction (user, 2026-10-25).
- **Code and the D4H API keep `kind`**, and so do the template output-ref placeholders `{{kind.id}}`/`{{kind.title}}` (user, 2026-10-25). Only labels, headings, placeholders and help text change.
- **Built before #454**, which reworks the template pickers. Here the template screens only get label text and links, which #454 rebases over (user, 2026-10-25).
- **Wrappers live in the shared layer**, `src/components/entity-links/`, because both modules use them. They follow `docs/patterns/entity-link.md`: each takes a `Ref` typed prop, resolves its route with `route()`, and gets `organization.slug` from `useOrganization()`. They carry no enrichment fields (nothing needs one yet).

  | Wrapper                                                                                                                                                                                                                                                                                                                     | Prop                                                                                                                                                                                     | Route                                           |
  | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
  | `D4HTeamLink`                                                                                                                                                                                                                                                                                                               | `team: D4HTeamRef` (exists: `{id, resourceType, title}`)                                                                                                                                 | `/orgs/[slug]/d4h/teams/[d4h_team_id]`          |
  | `D4HMemberLink`                                                                                                                                                                                                                                                                                                             | `member: Omit<D4HMemberRef, "name"> & { name: string \| null }`, `D4HMemberRef` = `{id, name, owner: {id}}`                                                                              | `…/d4h/teams/[d4h_team_id]/members/[member_id]` |
  | `D4HEquipmentItemLink`                                                                                                                                                                                                                                                                                                      | `item: D4HEquipmentItemRef` = `{id, ref, owner: {id}}`, optional `label`                                                                                                                 | `…/d4h/teams/[d4h_team_id]/items/[item_id]`     |
  | `D4HEquipmentCategoryLink`                                                                                                                                                                                                                                                                                                  | `category: D4HEquipmentCategoryRef` = `{id, title}`                                                                                                                                      | `/orgs/[slug]/d4h/categories/[category_id]`     |
  | `D4HEquipmentTypeLink`                                                                                                                                                                                                                                                                                                      | `type: D4HEquipmentKindRef` = `{id, title}`                                                                                                                                              | `/orgs/[slug]/d4h/types/[type_id]`              |
  | `D4HEquipmentBrandLink`                                                                                                                                                                                                                                                                                                     | `brand: D4HEquipmentBrandRef` = `{id, title}`                                                                                                                                            | `/orgs/[slug]/d4h/brands/[brand_id]`            |
  | `D4HEquipmentModelLink`                                                                                                                                                                                                                                                                                                     | `model: D4HEquipmentModelRef` = `{id, title, brand: {id}}`                                                                                                                               | the model's brand page (see below)              |
  | `I3TemplateLink`                                                                                                                                                                                                                                                                                                            | `template: I3TemplateRef` = `{id, name}`                                                                                                                                                 | `/orgs/[slug]/d4h-i3/templates/[template_id]`   |
  | - **Ref shapes are nested picks of the D4H records**, so a full `D4HMember`, `D4HEquipmentItem`, `D4HEquipmentModel` (or category/kind/brand) passes straight through: the team is `owner.id` and a model's brand is `brand.id`, as in the records. Call sites holding something else build a literal: a holder (`{id, name | null}`) adds `owner: {id: teamId}` from the listing team, a parent (`{id, ref}`) adds the page team, a template variant builds `{id: modelId, title: modelTitle, brand: {id: brandId}}`. |
  - Each `Ref` follows `D4HTeamRef`'s object style in `src/lib/schemas/d4h/team.ts` (`export const X = { schema: z.object(...) } as const` plus the inferred type), in the entity's schema file in `src/lib/schemas/d4h/`. `I3TemplateRef` goes in `src/lib/schemas/i3-template.ts`.
  - `EntityLink`'s `type` label says what users see: "D4H Team", "D4H Member", "Equipment Item", "Equipment Category", "Equipment Type", "Equipment Brand", "Equipment Model", "Template".
  - **`D4HMemberLink` renders plain `Member #<id>`, no link and no hover card, when `name` is `null`.** A null name means the holder isn't in the team's member list (retired, or the list failed to load), so the member page would 404. That's today's behaviour, kept in one place.
  - **`D4HEquipmentItemLink`'s text is `label ?? "#<ref>"`.** `label` is for the D4H Tasks list, whose task carries `itemLabel` (`#1234 Helmet`) and no `ref`. It passes `{id: task.resourceId, ref: "", owner: {id: task.d4hTeamId}}` with `label={task.itemLabel}`. (`EntityLink`'s `children` is the hover-card body, not the link text, so it can't be used for this.)

- **Models have no page.** `D4HEquipmentModelLink` links to the model's brand page, where the Models table lists it, and its hover card names the brand page as the destination. A model page is out of scope.
- **Nullable ids render plain.** An item's `brand.id`/`model.id` can be `null` (and the title missing): the call site renders the title or "—" as plain text then, never a link with a bad id.
- **`D4HModule_Owner`** (`src/modules/d4h/components/catalogue/owner.tsx`) takes the owner's `id` and renders a `D4HTeamLink` when `resourceType === "Team"`. An Organisation owner stays plain text (no page).
- **Item links use the item's own team** (`item.owner.id`), and link only when that team is reachable (`teams.some((t) => t.id === owner.id)`), as `ContentsTable` and `type-content.tsx` already do; otherwise `#<ref>` is plain text. `member-content.tsx` uses the route `teamId` today, which 404s for an item owned by another team. **Parents** are the exception: `item.parents` is `{id, ref}[]` with no owner, so they keep the page's team.
- **Item refs render through `D4HItemRef`** (`src/components/d4h/d4h-item-ref.tsx`, added at checkpoint 1): AVUT's `#` prefix in muted monospace, then the ref as D4H holds it, since some D4H refs already start with `#`. `D4HEquipmentItemLink` uses it; so does any plain-text ref fallback. Plain strings (breadcrumbs, tab titles, toasts) show the ref without our `#`.
- **No-token behaviour is unchanged.** Every link is built from data the existing queries already return; nothing new is fetched.
- **Not link sites:** page titles and breadcrumbs (they're the page itself, or already links), select options and pickers, toast and tooltip strings, and dialog titles naming the record being acted on.
- **The Issue and Return forms get no links** (user, 2026-10-25): not the form lists, not the form instance pages, and not the Return dialog on the item page (`return-equipment-item.tsx`), which is the same flow.
- **The item page gets a Team row** (a `D4HTeamLink` from the `listAccessibleTeams` data it already has). Today the team appears only in its breadcrumbs.
- **Token debug pages** (`admin/d4h-access-tokens/[token_id]/equipment-kinds`): the visible label "Equipment Kinds" becomes "Equipment Types", and the alert "Failed to parse equipment kind data" says "equipment type data". The route segment and the API path shown stay `equipment-kinds`, because the page mirrors the D4H endpoint.

## Tasks

### Review group 1: link wrappers

- [x] **1. D4H and template entity-link wrappers** — feat(entity-links): add D4H and I3 template entity-link wrappers (#455)
  - **Files:** `src/lib/schemas/d4h/{member,equipment-item,equipment-category,equipment-kind,equipment-brand,equipment-model}.ts`, `src/lib/schemas/i3-template.ts`, `src/components/entity-links/{d4h-team,d4h-member,d4h-equipment-item,d4h-equipment-category,d4h-equipment-type,d4h-equipment-brand,d4h-equipment-model,i3-template}-link.tsx`, `docs/patterns/entity-link.md`.
  - **Do:** add the `Ref` schemas and the eight wrappers in the Decisions table, following `docs/patterns/entity-link.md` and `team-link.tsx` as the template. Add each wrapper to the pattern doc's table. Use nothing yet (the next tasks wire them in).
  - **Done when:** `npm run check` passes. Small render tests cover: `D4HMemberLink` with `name: null` renders plain `Member #<id>` with no link; `D4HEquipmentModelLink`'s href is the brand page; `D4HEquipmentItemLink` renders `label` when given and `#<ref>` otherwise, with `owner.id` in the href.

### Review group 2: D4H module (`visual`), then visual checkpoint 1

- [x] **2. Catalogue pages** `visual` `mechanical` — feat(d4h): link names on the catalogue pages (#455)
  - **Files:** `src/modules/d4h/components/catalogue/{owner,brands-list,brand-content,categories-list,category-content,type-content}.tsx`.
  - **Do:** `D4HModule_Owner` takes `id` and links Team owners (Decisions). Every caller passes `owner` with its `id`. Replace the bare `<Link>`s for brands, categories, types, items and holders with the wrappers. Link the plain cells: on `type-content.tsx`, the Team column (`D4HTeamLink`), Brand (`D4HEquipmentBrandLink` when `brand.id` is set) and Model (`D4HEquipmentModelLink` when `model.id` and `brand.id` are set). Keep `type-content.tsx`'s current rule that an item Ref links only when its team is reachable. Brand page models stay plain, since the link would point at the page they're on.
  - **Done when:** `npm run check` passes. No bare `next/link` `<Link>` is left for an entity name in these files (`grep -n '<Link' src/modules/d4h/components/catalogue`).

- [x] **3. Items, members, teams and tasks** `visual` — feat(d4h): link names on the item, member, team and task pages (#455)
  - **Files:** `src/modules/d4h/components/items/equipment-item-content.tsx`, `src/modules/d4h/components/members/{member-content,team-members-list}.tsx`, `src/modules/d4h/components/teams/d4h-teams-list.tsx`, `src/modules/d4h/components/tasks/d4h-tasks-list.tsx`.
  - **Do:**
    - **Item page:** Type, Category, Brand and Model in the details become wrapper links (brand/model only with ids). Issued To uses `D4HMemberLink` (the `Member #id` fallback stays plain, inside the wrapper). Add a **Team** row with `D4HTeamLink`. Parents use `D4HEquipmentItemLink` with the page team (Decisions); Contents keep their reachability guard, and the Contents table links its Type, Brand and Model cells.
    - **Member page:** the items table links Ref with `row.owner.id` behind the reachability guard (Decisions), plus Type, Brand and Model. The Team DataItem uses `D4HTeamLink`.
    - **Lists:** team names in `d4h-teams-list.tsx` and member names in `team-members-list.tsx` use the wrappers.
    - **Tasks:** each team section heading's team name becomes a `D4HTeamLink` (built from `task.d4hTeamId` and `teamTitle`), and item labels use `D4HEquipmentItemLink` with `label={task.itemLabel}` (Decisions).
  - **Done when:** `npm run check` passes, and no bare `<Link>` remains for an entity name in these files.

### Review group 3: D4H I3 module (`visual`), then visual checkpoint 2

- [x] **4. "Type" wording** `visual` `mechanical` — feat(d4h-i3): say "Type" where users read "Kind" (#455)
  - **Files:** `src/modules/d4h-i3/components/templates/{templates-list,template-content,create-template,update-template}.tsx`, `content/help/d4h-i3.mdx`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/d4h-access-tokens/[token_id]/equipment-kinds/page.tsx`.
  - **Do:** "D4H Kind" → "D4H Type", "Select a kind" → "Select a type", the help card's "category and kind" → "category and type", and the debug page's two visible strings (Decisions). Keep `id="template-kind"`, `kindId` and all identifiers.
  - **Done when:** `npm run check` passes, and `grep -rn -i -w -E 'kinds?' src/modules/d4h src/modules/d4h-i3 content/help/d4h*.mdx` finds only identifiers, comments and `{{kind.*}}` placeholders.

- [x] **5. Template links** `visual` `mechanical` — feat(d4h-i3): link templates, categories, types, brands and models (#455)
  - **Files:** `src/modules/d4h-i3/components/templates/{templates-list,template-content,template-variants}.tsx`.
  - **Do:** the list's template name uses `I3TemplateLink`. Its D4H Category and D4H Type cells, and the detail page's Category and Type values, use `D4HEquipmentCategoryLink`/`D4HEquipmentTypeLink` built from `d4h.categoryId/categoryTitle` and `d4h.kindId/kindTitle` (plain "—" when `d4h` is null). Variant rows link Brand and Model from `variant.d4h`.
  - **Done when:** `npm run check` passes.

- [ ] **6. Issued Types** `visual`
  - **Files:** `src/modules/d4h-i3/components/issued-types/{team-issued-types,issued-type-content}.tsx`.
  - **Do:**
    - **Team Issued Types:** each category group header links with `D4HEquipmentCategoryLink` (plain for the `Category #id` fallback). The type → issued-type link stays a bare `<Link>`, since an issued type is a view, not an entity.
    - **Issued type page:** Ref, Holder, Brand and Model cells use the wrappers. Add a "D4H Type" link to the D4H type page in the header area (a `D4HEquipmentTypeLink` under the title, or the title's description line), so the page reaches the catalogue entry.
  - **Done when:** `npm run check` passes, and no bare `<Link>` remains for an entity name in these files (the issued-type link excepted).

## Docs impact

Template screens now say "D4H Type" and names across D4H and D4H I3 link to their pages. Guides: `content/docs/i3/index.mdx` (line ~52, "category and kind") and `content/docs/d4h-views/index.mdx` (line ~27, "their kinds") need "type", plus a sentence that names link through. Screenshots: D4H I3 template list/detail/create (they show "D4H Kind").

## Out of scope

- Links between D4H records and AVUT teams/people.
- Renaming `kind` in code, the D4H API schemas, stored template columns or the `{{kind.*}}` placeholders.
- A page for equipment models.
- "Brand → its types or items" from the issue: the brand page lists only its models, and listing types or items there needs a new query. The models table is the brand's cross-link for now.
- Any links on the Issue and Return forms or the item page's Return dialog (user, 2026-10-25).
- The template picker rework (#454).

## Parked

## Review notes

- `docs/patterns/entity-link.md`: sort the new wrapper-table rows alphabetically (D4H Equipment Brand … Type, D4H Member, D4H Team), and note in "Adding a new entity type" step 1 that a Ref may carry `title` instead of `name`, as the D4H records do.
- Item page Contents table and member page items table: the Type, Brand and Model cells link without the row's reachability check. When the owning team is out of reach and owns that type or brand, the catalogue page 404s. Compute `reachable` once per row and render those cells plain when it's false, as Ref does.
