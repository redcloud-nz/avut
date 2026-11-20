# Detail-page sweep: one record-card shape, status shown one way

**Date:** 2026-11-20
**Issue:** [#434](https://github.com/redcloud-nz/avut/issues/434) (rewritten 2026-11-20 after the design pass). Milestone v0.13. One PR, `Fixes #434`. [#417](https://github.com/redcloud-nz/avut/issues/417) was closed as not planned: the ID stays at the top of the record card.
**Branch:** `feat/detail-page-sweep`, worktree `.claude/worktrees/detail-page-sweep` (dev server on its `.dev-port`, 3102)
**DB:** no migration. Shared `avut` is fine.
**Written against:** integration @ 4855a185

Every detail page opens with an `<h1>` naming the record, then a card titled "… Details" or "… Information", with the record's ID, timestamps and status scattered across cards in different ways. The design pass (Task 1, iterated with the user on the person and Skill Track package pages) settled one shape. Tasks 2–7 apply it to every other detail page.

## Decisions

The shape, settled with the user at the Task 1 checkpoint (2026-11-20):

- **Cards are organised around conceptual records.** Each record the page shows gets its own `RecordCard`: the page's own record, plus related records shown in full (the person page's **Linked User**; the package page's **Subscription**, split out of the package card). A card that mixes two records is split.
- **`RecordCard`** (`src/components/ui/record-card.tsx`):
  - **Header strip,** the height of an icon button (32px), ruled off from the body: a small muted uppercase label naming the record type (**"Person"**, **"Package"**, **"Linked User"**, **"Subscription"**, not "… record", not "… Details"). The label is the collapse toggle, with a chevron after it. The card's `action` sits at the strip's right: the edit pencil (the same 32px ghost icon button as the page's other icon buttons), or an ↗ open-in arrow on a related record's card.
  - **Body:** `CardContent` + `DataList`, starting with a **`RecordCardId`** row (normal label, muted mono value, inline at every width), then **Name**, then the record's other properties.
  - **Footer strip,** the same height as the header: **"Updated <date> · <relative>"** (`RecordCardTimestamp`), small and muted. **Created is not shown.** With `historyHref` the line links to the record's History page; records without one (org users, packages) show it as plain text.
  - **Collapsible,** open by default, state not remembered. Collapsing keeps the header and its action.
  - Server-safe: `Collapsible` and the timestamp are its client islands, so Server Component pages can use it.
- **Phone layout:** on phones only the ID row stays on one line; every other property stacks (title, then value below). From `sm` up every row is on one line.
- **The Name row stays** in the record card, even though the `<h1>` repeats it (user, after trying it without).
- **Related-record lists** in the secondary column (the person's **Team Memberships**) are not cards: a heading on the page background (no count), an outline **"+ Add"** button following the list pages' pattern (`+` only below `md`), and each related record as a clickable outline `Item` (whole tile links to it) with a muted right chevron. Source badges such as D4H are dropped from the tile.
- **Sidebar link cards are extracted too** (user, group 1 checkpoint): a secondary-column card of navigation rows (the team's Related, the session's Contents, the skill's Related) becomes a list of the same outline tiles on the background. It keeps a heading only when the heading carries an action (the team's Related has "+ Add"); otherwise the heading goes and the `<section>` gets an `aria-label` instead. Rows that aren't links (a locked session's config rows) are flat outline tiles without a chevron.
- **A linked external record is a record card** (user, group 1 checkpoint): the team page's D4H Integration card became "Linked D4H Team" (D4H Team ID as its ID row, sync button as its action), shown only when the team is linked, as the person's Linked User card is.
- **Metrics** (the package's Skills and Subscribers counts) go in the secondary column as compact tiles (number over a small muted label). For now they're a private `Metric` helper in `skill-track/…/package-content.tsx` (user: stay put until another page needs them).
- **Status badges go next to the title only**, never in `Saratoga.Actions` or inside a row. `Saratoga.Title` has a `badges` prop that renders them as a sibling of the `<h1>` in a `min-w-0` flex wrapper, so a long name still truncates and the badge text stays out of the heading's accessible name. It replaces the ad-hoc `className="flex items-center gap-2"` in skill-track's `skill-content.tsx` and `group-content.tsx` and in `d4h-i3/components/form-shared.tsx` (`SubmittedFormHeader`).
- **Status rule, by value** (user, 2026-11-20): a record's own lifecycle status (`RecordStatus`, a package's publish state, a session's approval, a token's status) shows as a title badge **when it isn't the normal state**, and its `Status` row is dropped. Active (or Published, or an open session) shows no badge. Archived, Deleted (Rubbish bin), Withdrawn, Draft/Unpublished, Approved/Submitted and an invalid token each get a badge. **D4H Status** rows are D4H's data, so they stay rows; the I3 "Returned" `statusBadge` in the equipment item's D4H Status row stays there too.
- **Explanations go in an `Alert variant="warning"`** directly under `Saratoga.Header`, not a muted `<p>` (shape: `d4h-i3/…/bundle-content.tsx`). The d4h-nag rule's "Paused: …" `Alert` moves from the secondary column to under the header.
- **D4H-backed pages** (D4H member, D4H team, the four catalogue pages, the equipment item) use `RecordCard` with their `D4H ID` as the `RecordCardId` row and no footer: their Updated is D4H's, and stays a row where shown today.
- **`getLinkedUser` returns the user's `updatedAt`** (added in Task 1) for the Linked User card's footer. It's the user account's own timestamp: a role change in this org updates the membership, not the user.
- **`src/components/cards/` is gone:** `user-profile-info.tsx` was unused and deleted; the record card lives in `ui`.
- **Pages that aren't record detail pages are left alone:** settings pages (`organization-settings-content.tsx` ×2, `user-settings-content.tsx`, `user/settings/account`), dashboards (`user/page.tsx`, `team/dashboard-content.tsx`).
- **One commit per module area.** Each commit applies the shape to its files.

## Tasks

### Review group 1: design pass (visual)

- [x] **Task 1: design pass on the person and Skill Track package pages** `visual` — feat(ui): settle the detail-page shape on three pages (#434, #417); feat(ui): RecordCard, the record-card shape for detail pages (#434)
  - **Files:** `src/components/ui/record-card.tsx`, `src/components/ui/record-card-timestamp.tsx`, `src/components/ui/README.md`, `src/components/blocks/saratoga.tsx`, `src/modules/org-admin/components/personnel/{person-content,linked-user-card,team-memberships}.tsx`, `src/modules/skill-track/components/package-content.tsx`, `src/modules/d4h/components/items/equipment-item-content.tsx` (first pass, redone in Task 6), `src/trpc/routers/personnel-router.ts`, `src/components/cards/user-profile-info.tsx` (deleted)
  - **Done:** iterated live with the user; the shape is in Decisions.

**Checkpoint:** done (2026-11-20).

### Review group 2: sweep (org-admin, skill-track, skill-package-builder)

For every page in Tasks 2–7: replace the "… Details"/"… Information"/"Identity" card with a `RecordCard` per record, apply the status rule and the Alert rule, drop Created, and move Updated into the footer (with `historyHref` where the record has a History page: check `src/app/**/history/page.tsx`). Split a card that mixes records. Convert related-record list cards in the secondary column to the Team Memberships pattern where they list records the user clicks through to. Follow `src/modules/org-admin/components/personnel/` and `skill-track/components/package-content.tsx` as the worked examples.

- [x] **Task 2: org-admin and the shared team card** `visual` — feat(org-admin): record cards on the org-admin detail pages (#434)
  - **Files:** `src/modules/org-admin/components/users/user-content.tsx`, `teams/team-content.tsx`, `teams/team-membership-content.tsx`, `d4h-access-tokens/access-token-content.tsx`, `src/components/teams/team-details-card.tsx`, `src/modules/team-admin/components/team-admin-content.tsx`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/organization/page.tsx`, `content/help/team-admin.mdx`
  - **Do:** per page:
    - **org user:** a "User" card (User ID, Name, Email, Roles); its Linked Person card becomes a "Linked Person" `RecordCard` with an ↗ to the person, as the person page's Linked User card does.
    - **team membership:** a "Membership" card; the D4H card becomes a "D4H Member" `RecordCard` (Member ID as its ID row, Role ID, D4H Status, Position, Ref, Team last synced).
    - **org access token:** a "D4H Access Token" card; Label stays; Status → title badge when not Active.
    - **`Teams_Details_Card`** → a "Team" `RecordCard` (Team ID, Name, Slug, Description) with the pencil; Status → title badge on the org team page. Team admin shows the same card (its `<h1>` is "Team Admin"). Update `content/help/team-admin.mdx` where it names "Team Details".
    - **organisation page** (Server Component): an "Organisation" card.
  - **Done when:** each page follows the Decisions; `npm run check` passes.

- [x] **Task 3: skill-track** `visual` — feat(skill-track): record cards on the skill-track detail pages (#434)
  - **Files:** `src/modules/skill-track/components/session-content.tsx`, `skill-content.tsx`, `group-content.tsx`
  - **Do:** "Session", "Skill", "Group" cards. Archived badges move to the `badges` prop; explanation `<p>`s become warning `Alert`s. The skill page's `Related` card keeps its title (it's a list, not a record). Session: Status row → title badge for a non-open state; the `<h1>` gets the breadcrumb's fallback, `session.name || session.id`.
  - **Done when:** as Task 2.

- [x] **Task 4: skill-package-builder** `visual` — feat(skill-package-builder): record cards on the builder detail pages (#434)
  - **Files:** `src/modules/skill-package-builder/components/package-content.tsx`, `group-content.tsx`, `skill-content.tsx`
  - **Do:** "Package", "Group", "Skill" cards with the pencil; Status rows → title badges when not the normal state (package: not Published; group/skill: not Active). Keep the remaining row order.
  - **Done when:** as Task 2.

**Checkpoint:** visual, one page per module.

### Review group 3: sweep (system-admin, user-settings, D4H modules)

- [x] **Task 5: system-admin and user-settings** `visual` — feat(system-admin): record cards on the system-admin and user-settings detail pages (#434)
  - **Files:** `src/modules/system-admin/components/users/user-content.tsx`, `groups/group-content.tsx`, `organizations/organization-content.tsx`, `src/modules/user-settings/components/d4h-access-token-content.tsx`, `organization-content.tsx`
  - **Do:** "User", "Group", "Organisation" cards. The system organisation page's Members, Teams, Groups, Enabled Modules and Record Counts keep their titles (Record Counts may become metric tiles if it reads better). User-settings token: a "D4H Access Token" card keeping Label; its Status badge → title badge when not Active. User-settings organisation: an "Organisation" card; its "Joined" card becomes the footer or a row.
  - **Done when:** as Task 2.

- [x] **Task 6: D4H** `visual` — feat(d4h): record cards on the D4H detail pages (#434)
  - **Files:** `src/modules/d4h/components/members/member-content.tsx`, `teams/team-content.tsx`, `items/equipment-item-content.tsx`, `catalogue/brand-content.tsx`, `model-content.tsx`, `category-content.tsx`, `type-content.tsx`
  - **Do:** "Member", "Team", "Item", "Brand", "Model", "Category", "Type" cards per the D4H-backed decision. The equipment item's Task 1 pencil (on the first row's `DataItemAction`) moves to the card header.
  - **Done when:** as Task 2.

- [x] **Task 7: D4H I3 and D4H nag** `visual` — feat(d4h-i3,d4h-nag): record cards on the I3 and reminder detail pages (#434)
  - **Files:** `src/modules/d4h-i3/components/bundles/bundle-content.tsx`, `templates/template-content.tsx`, `src/modules/d4h-i3/components/form-shared.tsx`, `src/modules/d4h-nag/components/rule-content.tsx`, `run-content.tsx`
  - **Do:** "Bundle", "Template", "Rule" cards. Template: `D4HI3Module_OtherRecords_Badge` (inside the `CardTitle` now) moves to the title `badges`. `SubmittedFormHeader`: its "Submitted" badge moves to `badges`. Rule: the "Paused: …" `Alert` moves under the header; Status → title badge when paused. Run: a "Run" card if it reads as a record, otherwise leave "Run Details" beside its status `Alert`.
  - **Done when:** as Task 2. Then check every file in this plan for a `CardTitle` that restates its `<h1>`, and that the excluded pages didn't change.

**Checkpoint:** visual, one page per module.

## Docs impact

Every detail page's cards change (record cards with a small type label, collapsible, Updated footer; status as a title badge; related lists as tiles): re-shoot detail-page screenshots in `content/docs/admin/{personnel,teams,users,organization}.mdx`, `skill-track/{packages,sessions}.mdx`, `skill-package-builder/index.mdx`, `d4h-i3/index.mdx`, `d4h/index.mdx`, fix "Details card" wording, and the "Subscribed · Withdrawn" text in `skill-track/packages.mdx` and `skill-package-builder/index.mdx` (now a Withdrawn/Deleted title badge and a warning box), and the team page's "D4H Integration" card in `admin/teams.mdx` (now "Linked D4H Team", shown only once linked; linking is in the menu); note it on #494.

## Out of scope

- Settings pages and dashboards, and list pages.
- New History pages (org users, packages): the footer stays plain text where there's none.
- Edit/Delete menu changes (see Parked).

## Parked

- Person page logs "personnel.getLinkedUser was called during the server render, where nothing was hydrated for it" and falls back to client rendering (linked-user card spins on desktop). Pre-existing; the page needs a prefetch for it. Area: org-admin personnel. **Dropped** (user, 2026-11-20).
- **Filed as #553.** The detail page's ⋮ Actions menu (`EntityActionMenu` in `Saratoga.Actions`): the user is unsure about the button and what it holds now that each record card carries its own edit pencil (and the package's Unsubscribe could sit on the Subscription card). Separate design question, raised at the #434 design pass (2026-11-20). Area: shared detail-page actions.
- **Filed as #554.** The system-admin organisation and user pages "aren't quite right" after the sweep (user, group 2 checkpoint); the user will rework them later. Open calls there: share the `Metric` tile (now copied on the system org page and the skill-track package page) in `src/components/ui/`; the system user's Organisations tiles dropped the org slug. Area: system-admin.

## Review notes

- Task 2 implementer calls, for the checkpoint: token status badge shows when D4H's status text isn't "OK" (it's never "Active"; an empty status text would store "HTTP 200" and badge); no Updated footer on the org User card (`organizations.listMembers` lacks `updatedAt`) or the Organisation card (`OrganizationData` lacks it); the user page's Teams list became the tile pattern (`user-teams-card.tsx`, name still ends `_Card`); Linked Person shows a Status row only when not Active; emptied secondary columns removed (membership, token, organisation pages); organisation slug now mono.
- Task 3 implementer calls: a session badges "Approved"/"Excluded" for Include/Exclude, none for Draft; skill and group pages show only their own Archived badge (a withdrawn package gets the Alert but no title badge there); skill and group cards have no pencil (read-only subscriber views).
- Task 4 implementer calls: the package's Published row is its publish state, so it became an "Unpublished" title badge (beside a non-Active status badge, so an archived draft shows both); Name moved up to second row on the group and skill cards (was after Package/Group); the three builder update dialogs' pencils became `size="icon"` with an aria-label to match the header strip.
- Task 5 implementer calls: system user "Banned" title badge; its org memberships table became an "Organisations" tile list in the secondary column; system organisation Groups became tiles, Members and Teams stay cards (actions / no links), Record Counts became metric tiles (own private `Metric` copy) with the D4H tokens count folded in; no Updated footer on system user / organisation or user-settings organisation (queries lack `updatedAt`); user-settings organisation gained an Organisation ID row and keeps "Joined" as its last row.
- Task 6 implementer calls: every D4H card gains a `D4H ID` row (only member and team had one; item, brand, model, category, type now show it too); Title/Name rows kept; brand and model keep D4H's Updated as a row; no footers; the item's pencil is the card header action; the team page's Members tile stays as it was (a section link, not a sidebar card). Not loaded in a browser (test admin has no D4H token).
- Task 7 implementer calls: bundle and template show their own ID row (AVUT records) and an Updated footer without a link (no History pages for I3 or nag records); template badges show a non-Active status then the Not-organisation-records flag; the rule badges "Disabled" when turned off and "Paused" for any other paused reason ("disabled" is itself a paused reason), the Alert keeps the specific reason; rule and run have no `updatedAt`, so no footer; the run reads as a record (ID, rule, team, window, trigger, started/finished), so "Run Details" became a "Run" card, with its status Alert and the untitled counts card left in the secondary column; emptied secondary columns removed (bundle, template, rule). Final check: no `CardTitle` left that restates its `<h1>` (the remaining ones title related lists: Organizations, Teams, Members, Enabled Modules); no excluded settings page or dashboard is in `git diff origin/integration`. D4H-backed pages not loaded in a browser (test account has no D4H token).
