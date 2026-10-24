# D4H: one browser for the catalogue and teams

**Date:** 2026-10-24
**Issue:** [#453](https://github.com/redcloud-nz/avut/issues/453) (closes #447, #448)
**Branch:** `feat/d4h-one-browser`, worktree `.claude/worktrees/d4h-one-browser`
**DB:** no migration. Shared `avut`. `D4HTask` and `d4hTasksRouter` stay as they are, and only their UI moves.
**Written against:** integration @ c8253ec5

Give D4H one browser and take the browse pages out of D4H I3. The equipment catalogue (categories, types, brands) stays org-wide with an Owner column. Teams, members and items are team-scoped under `/orgs/[slug]/d4h/teams/[d4h_team_id]/…`. The item page lives in D4H, and `page.tsx` adds I3's Return and returned badge when D4H I3 is enabled. D4H Tasks moves to `/d4h/tasks`.

**Rule for every task: a task that deletes or moves a route or component also repoints or deletes every remaining reference to it**, so each commit passes `npm run check` on its own. Grep `route("/orgs/[slug]/d4h…` and the component name before committing.

## Decisions

- **Org-wide member lists fold into team members.** `d4h/personnel` and `d4h/members` (all teams, Team column) are deleted. Members are reached per team at `teams/[d4h_team_id]/members`. `/d4h/members` becomes the picker's landing page, and the Teams page is the all-teams entry point.
- **`d4h/equipment` (the index page) is dropped.** Categories, Types and Brands are top-level: `/d4h/categories`, `/d4h/types`, `/d4h/brands`.
- **A type's items span every team**, listed with Team and Holder columns, each row linking to the team-scoped item page.
- **Route param is `d4h_team_id`**, not `team_id`, so it never reads as an AVUT `TeamId`.
- **Data fetching:** every new page is a server `page.tsx` that `prefetch`es inside `HydrateClient`, with a client `<entity>-content.tsx` in `src/modules/d4h/components/…` reading via `useSuspenseQuery` (`docs/patterns/detail-page-data-fetching.md`). This closes #447.
  - There are no D4H reads outside tRPC (the current `teams` and `personnel` pages do this), and no `use(props.params)` client pages.
  - **Module check:** every `d4h/**` page returns `null` unless `isOrganizationModuleUsable(slug, "d4h")`, as `d4h/teams/page.tsx` does.
  - **No D4H token:** every `generateMetadata` that calls `fetchQuery` (item, category, type, brand, member) keeps the item page's `PRECONDITION_FAILED` fallback to a generic title, and the page's error boundary explains.
- **The D4H TanStack DB collections go.** `src/client/collections/{d4h-equipment-categories,d4h-equipment-items,d4h-equipment-kinds,d4h-members,equipment-brands,equipment-models}.ts` are only read by the D4H pages being rewritten, so they're deleted along with the `ClientOnly` layouts that existed for them.
- **Status labels:** equipment status uses `D4HEquipmentStatus.label` (filter options too), and member status uses `formatD4HMemberStatus` (`src/lib/schemas/d4h/member.ts`). This closes #448.
  - Equipment lists already exclude retired and wishlist items (`only_current: true`), so status filters get no default.
- **Wording:** new pages say "Type", not "Kind" (column headers, titles, breadcrumbs). Route segments are `types/[type_id]`. Schema and router names keep "Kind" (#455 renames the rest).
- **Team picker:** the dialog shell moves out of Skill Track's `team-scope-dialog.tsx` into the shared layer, with nothing D4H- or Skill-Track-specific in it.
  - **What the shell owns:** the trigger button, the `?action=…` open state, being forced open on arrival but dismissable, and `DialogBoundary`. The caller supplies the title, the description and the picker list.
  - **How each caller uses it:** Skill Track keeps its `?team=` behaviour. D4H's picker navigates with `router.push` and doesn't clear `action` first (the navigation drops the query anyway, and a throttled nuqs write could land on the new URL).
  - **`/d4h/members`** opens it on arrival. With one team it redirects to `teams/[id]/members`, and with none (or no token) it shows an empty state.
  - **Change team:** team-scoped list pages (`teams/[d4h_team_id]` and `…/members`) get a **Change team** button that goes to the same section of the chosen team, shown only with more than one team.
  - **Detail pages get no Change team:** an item or member belongs to its team.
- **Item page composition:** the server `page.tsx` renders `D4HModule_EquipmentItem_Content`. When `isOrganizationModuleUsable(slug, "d4h-i3")` is true, it passes I3's pieces in as React-node props (`menuActions`, `menuDialogs`, `statusBadge`). Those pieces are self-fetching client components from `src/modules/d4h-i3/` that take `teamId`/`itemId`. They're slots, not functions, because they cross the server → client boundary.
  - **Return sits in the Actions menu, under Edit** (changed at checkpoint 1; Task 4 first built it as its own button). `EntityActionMenu` takes `extraActions` (more `<MenuAction>`s in its Actions group) and `dialogs` (always mounted beside it, reading the trigger through `useEntityActionMenuTrigger` to return focus). I3 fills them with `D4HI3Module_ItemReturn_MenuAction` and `D4HI3Module_ItemReturn_Dialog`. Return has no hotkey (`ActionHotkey` has no key for it).
    - Return isn't listed when the item has no member holder, and is disabled when it's already returned or the viewer can't return it.
  - **Unchanged:** Update (D4H edit), the open-tasks card and "Open in D4H" are D4H's own.
- **Returned badge only on the item page.** The I3 kind and member pages showed it per row. The new D4H member and type pages don't, because a D4H module can't import I3. It's a deliberate loss, and the item page and Return form still show it.
- **The member list drops the "Issued Items" count.** I3 fetched one `listMemberEquipment` per member, the N+1 behind #447. The member page shows the member's equipment instead.
- **New router procedures** (in `d4hApiRouter`, alphabetical, `d4hEquipment: ["view"]`):
  - **`listTeamMembers({ teamId })`:** one team's members via the cached `getD4HTeamMembers`, replacing the all-teams `listMembers` on the members list and member page.
    - A team the token can't reach is a `NotFoundError` (checked against `getD4HTokenMetadata`'s teams), not a 500.
    - Like today, only Operational and Non-operational members come back, so an Observer's or Retired member's page is not found and they show as an unnamed holder.
  - **`listEquipmentKindItems({ kindId })`:** the kind's current items in every team the token reaches, using D4H's `kind_id` filter, `only_current: true` and `size: 10000` (as `listEquipmentItems`).
    - Each row carries `team: { id, title }` and `holder: { id, name | null } | null`.
    - The fetch lives in `src/server/d4h-api/equipment.ts`, next to `fetchD4HEquipmentItem`. Its row schema keeps `location` narrow (`{ resourceType, id }`), like `D4HEquipmentItemDetail`: D4H expands it to the member's private record, so never widen it.
    - Holder names come from the team's cached member list, as in `getEquipmentItem`.
- **Cache effects:** `listEquipmentKindItems` is invalidated wherever item data changes (`docs/conventions-checklist.md`):
  - `d4hApiEffects.updateEquipmentItem`
  - `d4hTasksEffects` check task
  - `i3Effects.submitIssueItemsForm`
  - `i3Effects` return
- **D4H Tasks:** `/d4h/tasks`, org-wide. The list already groups rows under a team heading, so keep that.
  - The components move to `src/modules/d4h/components/tasks/`, renamed `D4HModule_*`.
  - I3's Return form still queues into it.
  - `d4hTasks` procedures aren't gated on d4h-i3, so it works with I3 off.
- **Sidebars and index pages:**
  - **D4H:** Teams, Members (to the picker landing), Categories, Types, Brands, Tasks.
    - Catalogue, Members and Tasks entries are gated on what their procedures need: `d4hEquipment: ["view"]` and `d4hTask: ["view"]`. Only Skill Track roles lack `d4hEquipment: ["view"]`, and they can't load those pages today.
    - Teams stays ungated, matching `listAccessibleTeams` (`organizationProcedure({})`).
    - The D4H index page uses the same `<Protect>`s.
  - **D4H I3:** Inspect, Issue, Return, Templates.
- **No redirects** from removed routes (issue: "No redirects").

## Tasks

### Review group 1: data layer and shared shell

- [x] **1. Router: `listTeamMembers` and `listEquipmentKindItems`** — feat(d4h): listTeamMembers and listEquipmentKindItems procedures (#453)
  - **Files:** `src/server/d4h-api/equipment.ts` (+ `equipment.test.ts`), `src/trpc/routers/d4h-api-router.ts`, `src/trpc/routers/d4h-api-router.test.ts`
  - **Do:**
    - Add `fetchD4HEquipmentItemsByKind(accessToken, teamId, kindId)` in `equipment.ts`, with a narrow-`location` row schema beside `D4HEquipmentItemDetail`.
    - Add both procedures as in Decisions, in alphabetical position, with `.input`/`.output` zod schemas.
    - `listEquipmentKindItems` fetches each accessible team in parallel and de-dupes by id. It fetches a team's members (`getD4HTeamMembers(...).catch(() => [])`) only when one of that team's items has a `Member` location.
    - Router tests mock `fetchD4HEquipmentItemsByKind` the way they already mock `fetchD4HEquipmentItem`. Follow `.claude/rules/testing.md`.
    - **Live probe:** the list endpoint's `@example` shows `location`, but confirm against the dev token that member-held items actually carry it, by opening a type page in task 8 or a one-off call. If the list omits it, say so in the report and the plan gets a fallback.
  - **Done when:** tests cover:
    - the members of the right team, and an unknown team giving NOT_FOUND
    - items across two teams with team titles
    - a member holder named, a non-member location giving `holder: null`, and a member missing from the list giving `name: null`
    - the location payload stripped to `{ resourceType, id }`

    `npm run check` passes.

- [x] **2. Shared picker dialog shell; Skill Track uses it** — refactor(ui): shared PickerDialog shell; Skill Track team scope uses it (#453)
  - **Files:** new `src/components/picker-dialog.tsx`; `src/modules/skill-track/components/reports/team-scope-dialog.tsx`
  - **Do:**
    - Extract the shell from `SkillTrack_TeamScopeDialog`:
      - `useQueryState("action", …)` with a caller-given action literal
      - the `forceOpen`/`dismissed` logic and its comment, and push-on-open/replace-on-close
      - the trigger `Button` (icon, label, `compact`)
      - `DialogContent`/`DialogHeader` with title and description, and `DialogBoundary`
    - Children get a way to mark the dialog dismissed as they select. Clearing `action` stays the caller's choice (Skill Track clears it, D4H navigates without clearing). Pick the simplest API both callers fit, and document it, including the "don't clear before navigating" note, in JSDoc.
    - `SkillTrack_TeamScopeDialog` becomes a thin wrapper with identical behaviour and look.
  - **Done when:** the Skill Track reports behave as before: forced open with no scope, Escape dismisses, the trigger reopens, and choosing sets `?team=`. `npm run check` passes.

### Review group 2: tasks and item page (`visual`), then visual checkpoint 1

- [x] **3. D4H Tasks moves to `/d4h/tasks`** `visual` — feat(d4h): D4H Tasks moves to /d4h/tasks (#453)
  - **Files:**
    - **New:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h/tasks/page.tsx`
    - **Move:** `src/modules/d4h-i3/components/{d4h-tasks-list,d4h-task-actions,d4h-task-changes}.tsx` → `src/modules/d4h/components/tasks/`. Move `src/modules/d4h-i3/components/equipment-item/item-tasks-card.tsx` too, because it imports the task actions and changes and the I3 item content imports it. The I3 item content then imports nothing across modules: render the card from the I3 page's `page.tsx` slot or drop it there until task 4. Pick whichever keeps lint green, and say which.
    - **Delete:** `d4h-i3/d4h-tasks/page.tsx`
    - **Edit:** both sidebar menus (move the D4H Tasks entry from I3 to D4H, gated `d4hTask: ["view"]`)
  - **Do:**
    - Same page shape as today's `d4h-i3/d4h-tasks/page.tsx`: prefetch `listOpenTasks`, title `D4H Tasks · D4H`, breadcrumbs D4H › Tasks. Keep the team grouping.
    - Rename the components `D4HModule_*`.
    - The list's item link keeps pointing at the I3 item route for now, and task 4 repoints it.
  - **Done when:** `/d4h/tasks` lists open tasks grouped by team, Check and Dismiss work, `src/modules/d4h/**` imports nothing from `src/modules/d4h-i3/**` and vice versa, and `npm run check` passes.

- [x] **4. D4H item page with I3 slots** `visual` — feat(d4h): D4H item page with I3 Return and returned badge as slots (#453)
  - **Files:**
    - **New:**
      - `d4h/teams/[d4h_team_id]/items/[item_id]/page.tsx`
      - `src/modules/d4h/components/items/{equipment-item-content,equipment-item-menu}.tsx`
      - `src/modules/d4h-i3/components/equipment-item/{item-return-action,item-returned-badge}.tsx`
    - **Move:** `src/modules/d4h-i3/components/equipment-item/update-equipment-item.tsx` → `src/modules/d4h/components/items/`
    - **Delete:**
      - `d4h-i3/teams/[team_id]/equipment-items/**` and `d4h/equipment/items/**`
      - `src/modules/d4h-i3/components/equipment-item/{equipment-item-content,equipment-item-menu}.tsx`
    - **Repoint links to the new item route:**
      - `src/modules/d4h/components/tasks/d4h-tasks-list.tsx`
      - `src/modules/d4h/components/equipment/kind-items.tsx` (team from `item.owner.id`)
      - `d4h/members/[team_id]/[member_id]/page.tsx` (team from `team_id`)
      - I3's `d4h-i3/teams/[team_id]/equipment-kinds/[kind_id]/page.tsx` and `…/members/[member_id]/page.tsx`. Task 5 deletes those, so a route swap is enough.
    - **Edit:** `src/client/d4h-api-effects.ts`, `src/client/d4h-tasks-effects.ts`, `src/client/i3-effects.ts` (invalidate `listEquipmentKindItems`, per Decisions)
  - **Do:**
    - **Page:** as in Decisions.
      - `generateMetadata` gets the title from `getEquipmentItem` (`Item #<ref> · D4H`), with the `PRECONDITION_FAILED` fallback.
      - Prefetch `getEquipmentItem`, `listAccessibleTeams`, `listEquipmentCategories` and `listItemTasks`, plus `listReturnedItemIds` only when D4H I3 is usable.
    - **Content:** the I3 content with the I3 pieces lifted out, and props `actions?: ReactNode` (after the menu in `Saratoga.Actions`) and `statusBadge?: ReactNode` (beside the D4H Status value).
      - Breadcrumbs are D4H › Teams › `<team>` (unlinked until task 6) › `Item #<ref>`.
      - "Kind" becomes "Type". Issued To shows the holder name unlinked until task 7.
      - Menu: Edit only.
    - **`D4HI3Module_ItemReturn_Action({ teamId, itemId })`:** reads `getEquipmentItem`, `listAccessibleTeams` and `listReturnedItemIds`. It renders the Return button (per Decisions: hidden without a member holder, `aria-disabled` plus tooltip otherwise) and `D4HI3Module_ReturnEquipmentItem_Dialog`, `<Protect>`-gated on `i3Item: ["return"]` via `render`.
      - Update the dialog's JSDoc about its opener, and drop `returnFocusRef` if the button now is the opener.
    - **`D4HI3Module_ItemReturnedBadge({ teamId, itemId })`:** reads `listReturnedItemIds` and renders `ReturnedBadge` when the item is returned.
    - Rename the moved components `D4HModule_*`.
    - Follow `docs/patterns/mutation-dialog.md` for the `?action=` dialogs.
  - **Done when:**
    - With D4H I3 on: Edit is in the menu, the Return button works, the badge shows, and after a Return focus lands on the Return button. With D4H I3 off: no Return, no badge, and the page works.
    - Editing an item then visiting a type page shows the new status.
    - `npm run check` passes (run `npx next typegen` after adding the page).

- [x] **5. Remove I3's browse pages** `mechanical` — refactor(d4h-i3): remove I3's browse pages, now served by the D4H browser (#453)
  - **Files:**
    - **Delete:** `d4h-i3/teams/**`, `d4h-i3/equipment-kinds/page.tsx`, `d4h-i3/members/page.tsx`
    - **Edit:** `src/modules/d4h-i3/components/sidebar-menu.tsx` (drop By Equipment Kind and By Member, leaving Inspect, Issue, Return, Templates), `d4h-i3/page.tsx` (drop By Equipment Type and By Member)
  - **Do:** Delete them, then grep for any remaining reference to the removed routes and to `D4HI3Module_ReturnedBadge` callers that went with them.
  - **Done when:** no `d4h-i3/teams`, `d4h-i3/members` or `d4h-i3/equipment-kinds` route remains, and `npm run check` passes.

**Visual checkpoint 1:** `/d4h/tasks`, the item page (I3 on and off, Return flow), and the I3 sidebar and index page.

### Review group 3: teams and members (`visual`)

- [x] **6. Teams, team index, picker, members list** `visual` — feat(d4h): team index, team picker and per-team members list (#453)
  - **Files:**
    - **Rewrite:** `d4h/teams/page.tsx` (server prefetch of `listAccessibleTeams`), `src/modules/d4h/components/teams/d4h-teams-list.tsx` (via `useSuspenseQuery`; names link to the team index)
    - **New:**
      - `d4h/teams/[d4h_team_id]/page.tsx` and `src/modules/d4h/components/teams/{team-content,team-picker-dialog}.tsx`
      - `src/modules/d4h/components/members/select-team.tsx`
      - `d4h/teams/[d4h_team_id]/members/page.tsx` and `src/modules/d4h/components/members/team-members-list.tsx` (moved from Task 7: the landing, picker and team index all link here)
    - **Replace:** `d4h/members/page.tsx` with a server page
    - **Delete:** `d4h/members/layout.tsx`, `d4h/members/[team_id]/[member_id]/page.tsx`, `d4h/personnel/page.tsx`, `src/modules/d4h/components/personnel/personnel-list.tsx`, `src/client/collections/d4h-members.ts`
    - **Edit:** `src/modules/d4h/components/sidebar-menu.tsx` (Members → the landing; add Teams), `d4h/page.tsx` (add Teams; Members link stays valid), `docs/patterns/route-access-control.md` (line ~62 and its "Known and accepted" note: only `d4h-today` still reads D4H outside tRPC), the item content (link the team breadcrumb)
  - **Do:**
    - **`D4HModule_TeamPickerDialog`:** uses task 2's shell to list `listAccessibleTeams` sorted by title in a searchable `Command`. Choosing a team does `router.push(section(teamId))`, with `section` a caller-supplied route builder.
    - **Team index:** a header with the team title and Change team, a short details card, and an `ItemGroup` link to Members. An id not in `listAccessibleTeams` calls `notFound()`.
    - **`/d4h/members` landing:** the server page prefetches `listAccessibleTeams`, and the client component:
      - redirects (`router.replace`) to the only team when there's one
      - shows `Empty` for none, or when there's no token (via the error boundary)
      - otherwise shows a short prompt with the picker forced open
    - **Members list** (Kaga table; prefetch `listTeamMembers` and `listAccessibleTeams`): Name (unlinked until Task 7 builds the member page), Ref, Position, Status (`formatD4HMemberStatus`), with Change team in the header. Breadcrumbs are D4H › Teams › `<team>` › Members.
    - **Unknown ids:** a client content component that can't find its team (or, in Task 7, its member) calls `notFound()` from `next/navigation`, as `d4h-access-token-content.tsx` does, so the real not-found panel shows.
  - **Done when:**
    - `/d4h/teams` lists teams that link to their index, and the team index renders and 404s an unknown team.
    - `/d4h/members` redirects with one team and opens the picker with several.
    - The members list renders labelled statuses under a team.
    - Change team keeps the section, and `npm run check` passes.

- [x] **7. Member page** `visual` — feat(d4h): team-scoped member page, linked from the members list and Issued To (#453)
  - **Files:** new `d4h/teams/[d4h_team_id]/members/[member_id]/page.tsx`, `src/modules/d4h/components/members/member-content.tsx`; `team-members-list.tsx` (link Name); the item content (link Issued To)
  - **Do:**
    - **Member page:** the title is the member's name from `listTeamMembers` in `generateMetadata` (generic fallback for no token or not found), with a details card as on today's `d4h/members/[team_id]/[member_id]`.
      - The equipment table comes from `listMemberEquipment` (prefetched): Ref (linked to the item page), Type, Brand, Model, Status (labelled), as a flat sortable Kaga table.
      - A member id not in the list calls `notFound()` from the content component.
    - The item page's Issued To links here when the holder is named.
  - **Done when:** the member page renders under a team, the members list links to it, labels are human-readable, links resolve, and `npm run check` passes.

- [x] **11. Item page: Parents and Contents** `visual` — feat(d4h): item page shows its parents and contents (#453) (added at checkpoint 1: the old D4H item page had them, and Task 4 dropped them)
  - **Files:** `src/server/d4h-api/equipment.ts` (+ test), `src/trpc/routers/d4h-api-router.ts` (+ test), `src/modules/d4h/components/items/equipment-item-content.tsx`, the item `page.tsx`, the cache effects that invalidate `listEquipmentKindItems`
  - **Do:**
    - **`listEquipmentItemContents({ teamId, itemId })`** (`d4hEquipment: ["view"]`, alphabetical): the items stored in this one, from D4H's equipment list with `parent_id: itemId`, `only_current: true`, `size: 10000`, for that team only (`NotFoundError` for a team the token can't reach, like `listTeamMembers`). Rows use the narrow `D4HEquipmentListItem` schema. Fetch helper beside `fetchD4HEquipmentItemsByKind`.
    - **Parents:** a Parents row in Item Information, from the item's own `parents` (already on `getEquipmentItem`), each linked to its item page in the same team, shown only when there are any.
    - **Contents:** a Contents section under Item Information (Kaga table: Ref linked to the item page, Type, Brand, Model, Status labelled), prefetched in `page.tsx`, shown only when there are contents. Look at the deleted `d4h/equipment/items/[item_id]/page.tsx` (`git show c82ae84c:…`) for the old layout.
    - Invalidate `listEquipmentItemContents` wherever `listEquipmentKindItems` is invalidated after an item edit.
  - **Done when:** a container item lists its contents and a contained item links up to its parents, tests cover the procedure (including the unknown team and no token), and `npm run check` passes.

### Review group 4: catalogue and navigation (`visual`), then visual checkpoint 2

- [x] **8. Categories and types** `visual` — feat(d4h): top-level categories and types pages (#453)
  - **Files:**
    - **New:** `d4h/categories/page.tsx`, `d4h/categories/[category_id]/page.tsx`, `d4h/types/page.tsx`, `d4h/types/[type_id]/page.tsx`, `src/modules/d4h/components/catalogue/{categories-list,category-content,types-list,type-content}.tsx`
    - **Delete:** `d4h/equipment/categories/**`, `src/modules/d4h/components/equipment/{category-kinds,kind-items}.tsx`, `src/client/collections/{d4h-equipment-categories,d4h-equipment-kinds,d4h-equipment-items}.ts`
    - **Edit:** `d4h/equipment/page.tsx` (drop its Categories link; task 9 deletes the page), the D4H sidebar and `d4h/page.tsx` (add Categories and Types)
  - **Do:**
    - Server pages prefetch `listEquipmentCategories` / `listEquipmentKinds` / `listEquipmentKindItems`. Category and type titles come from the list `fetchQuery` in `generateMetadata`, with the fallback.
    - **Categories list:** Title (linked), Types (count), Owner (with `resourceType`).
    - **Category page:** a details card plus its types (Title linked, Owner).
    - **Item page:** link its Category value to the category page (the old D4H item page did).
    - **Types list:** Title (linked), Category (linked), Owner.
    - **Type page:** a details card (Title, Category linked, Owner) plus the items table from `listEquipmentKindItems`: Ref (linked to `teams/[item.team.id]/items/[id]`), Team, Holder (linked to the member page when named), Brand, Model, Status (labelled).
  - **Done when:** all four pages render with "Type" wording and labelled statuses, item and holder links resolve, and `npm run check` passes.

- [x] **9. Brands; drop the equipment index** `visual` `mechanical` — feat(d4h): top-level brands pages; drop the equipment index and collections (#453)
  - **Files:**
    - **New:** `d4h/brands/page.tsx`, `d4h/brands/[brand_id]/page.tsx`, `src/modules/d4h/components/catalogue/{brands-list,brand-content}.tsx`
    - **Delete:** `d4h/equipment/**`, `src/modules/d4h/components/equipment/brand-models.tsx`, `src/client/collections/{equipment-brands,equipment-models}.ts`
    - **Edit:** the D4H sidebar and `d4h/page.tsx` (drop Equipment, add Brands); `src/client/*-effects.ts` (the "Feeds the D4H equipment collections" comment on `listEquipmentItems` invalidations: drop the invalidation if nothing reads `listEquipmentItems` any more, otherwise reword the comment)
  - **Do:**
    - Follow task 8's shape. **Brands list:** Title (linked), Models (count from `listEquipmentModels`), Owner. **Brand page:** a details card plus a models table (Title, Owner).
    - Grep to confirm nothing imports the deleted collections.
  - **Done when:** `src/modules/d4h/components/equipment/` and every `d4h/equipment` route are gone, and `npm run check` passes.

- [x] **10. Navigation gating, index pages and help cards** `visual` — feat(d4h): gate D4H navigation and update the D4H and D4H I3 help cards (#453)
  - **Files:** `src/modules/d4h/components/sidebar-menu.tsx`, `d4h/page.tsx`, `content/help/d4h.mdx`, `content/help/d4h-i3.mdx`
  - **Do:**
    - **D4H sidebar:** the final order and `<Protect>` gating per Decisions: Teams, Members, Categories, Types, Brands, Tasks.
    - **D4H index page:** the same six as `Item` links with one-line descriptions and the same gates.
    - **Help cards** (`content/README.md` rules):
      - **D4H card:** Teams and Members (per team, via the picker); the catalogue (Categories, Types, Brands, org-wide with Owner); the item page (Edit, open tasks, Open in D4H); Tasks. Drop its "read-only" claim.
      - **D4H I3 card:** drop By Equipment Type, By Member and the D4H tasks bullet, and say Return also appears on the D4H item page and the tasks live under D4H.
  - **Done when:** sidebars and the index match, `src/components/docs/help-cards.test.ts` and `src/lib/glossary.test.ts` pass, and `npm run check -- --all` passes.

**Visual checkpoint 2:** teams, the picker, the team index, members, the member page, categories, types, the type page, brands, and the D4H sidebar and index.

## Docs impact

D4H browsing (team-scoped Members/Items with a team picker; top-level Categories/Types/Brands; Tasks) moves wholly into D4H, and I3 loses By Equipment Type/By Member: restructure `content/docs/d4h-views/**`, trim `content/docs/i3/**`, and re-shoot every D4H page, the item page, and the I3 index and sidebar.

## Out of scope

- Renaming "Kind" to "Type" in schemas, routers and the rest of the UI (#455).
- Returned badges on list rows outside I3.
- Redirects from removed routes.
- Issued-item counts per member.
- Any change to `d4h-today`, the D4H access-token admin pages or the I3 forms beyond links.

## Parked

- Skill Track's `person-scope-dialog.tsx` and `skill-scope-dialog.tsx` repeat the picker shell logic (`select-scope`, forceOpen/dismissed, push/replace). Move them onto `PickerDialog` (`src/components/picker-dialog.tsx`). Area: Skill Track reports.

## Review notes

- (Task 1) `listEquipmentKindItems` tags each row with the team whose list returned it, and de-dupes keeping the first. Take the team and the member list to search from `item.owner.id` instead (or keep the row whose listing team equals `owner.id`), so a duplicate listed under a non-owning team first still gets the right Team, Holder and item link. Add a test with the duplicate under the non-owning team first.
- (Task 1) Add no-token tests (`getConfiguredD4HAccessToken` rejects with `NotConfiguredError` → `PRECONDITION_FAILED`) for `listTeamMembers` and `listEquipmentKindItems`, like `updateEquipmentItem`'s.
- (Task 4) `i3Effects.submitIssueItemsForm` doesn't invalidate `listMemberEquipment`, though issuing changes who holds what; Task 7's member page reads it. Add the invalidation.
- (Task 11) Wrap the item page's `ItemContents` in its own error boundary (plus `Suspense`) that renders a short "Couldn't load contents" line, so a failed `listEquipmentItemContents` doesn't take the whole item page to the route error boundary.
- (Task 6) With one team, `/d4h/members` should `redirect()` server-side (`fetchQuery` `listAccessibleTeams` in `page.tsx`) rather than `router.replace` in a client effect, so there's no empty flash or extra history entry. Keep the client component for zero or several teams.
- (Tasks 6, 7, 11, and the old `kind-items.tsx` pattern carried into Task 8) Label D4H's status column and details row "D4H Status", not bare "Status" (house terminology keeps bare "Status" for RecordStatus), in the members list, member page, contents table and the Task 8 tables.
- (Task 4) The item content throws a plain `Error` for a team not in `listAccessibleTeams`; call `notFound()` like the other D4H content components.
- (Task 9) `d4hApi.listEquipmentItems` has no callers now that the collections are gone. Delete the procedure and its tests (and any fetch helper only it used).
- (Task 9) The brand page's models table shows the owner's kind ("Team"/"Organisation") because `D4HEquipmentModel.owner` has no title. Resolve team owners to their title through `listAccessibleTeams` (and the org to its name, as `D4HModule_Owner` does elsewhere) so it reads like the other Owner columns.
