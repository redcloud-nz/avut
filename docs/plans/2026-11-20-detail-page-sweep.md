# Detail-page sweep: no repeated title card, one status style, IDs in the record card

**Date:** 2026-11-20
**Issues:** [#434](https://github.com/redcloud-nz/avut/issues/434) (drop the repeated title card, show status one way) and [#417](https://github.com/redcloud-nz/avut/issues/417) (move record IDs to the Created/Updated card). Milestone v0.13. One PR, `Fixes #434` and `Fixes #417`.
**Branch:** `feat/detail-page-sweep`, worktree `.claude/worktrees/detail-page-sweep` (dev server on its `.dev-port`, 3102)
**DB:** no migration. Shared `avut` is fine.
**Written against:** integration @ 4855a185

Every detail page opens with an `<h1>` naming the record, then a card titled "… Details" or "… Information" whose first rows are the record's ID and its Name again. Status shows three different ways. This sweep settles one shape on three representative pages, then applies it to every detail page.

## Decisions

- **One commit per module area, each doing both issues on its files.** The two issues edit the same lines (the info card's header and its first rows), so splitting them by issue would touch every file twice. Commit subjects name both issues where both apply.
- **Info card** (#434): no `CardHeader` title, and no Name row when the `<h1>` already shows the name. It keeps everything else (description, properties, external IDs such as `D4H ID`). A card that holds more than the name and ID keeps its content; a card left empty goes. A card whose title names something other than the record (`Linked User Account`, `Members`, `Teams`, `D4H`, `Related`, `Roster`) keeps its title: the rule is about restating the `<h1>`, not about every heading.
- **The edit pencil stays on the info card** (memory: keep the card pencil alongside the Actions menu's Edit). Where it sits once the title is gone is settled in Task 1's visual checkpoint. Proposed: a title-less card renders the pencil in the card's top-right corner, level with the first row, rather than in an otherwise empty header row. If that needs a shared piece (e.g. a `CardAction` that works without a `CardHeader`), Task 1 adds it to `src/components/ui/card.tsx` and documents it in `src/components/ui/README.md`.
- **The edit pencil's alternatives** for Task 1 to weigh: (a) make `CardAction` work without a `CardHeader` (needs `relative` on `Card`, which is `overflow-hidden`, and new positioning: real work in `card.tsx`); (b) `DataItemAction` from `src/components/ui/data-item.tsx`, which already pins an action top-right level with a row, but per row (on person the first row left is the non-inline Email row: check how it looks).
- **Record ID** (#417): moves from the info card to the secondary column's Created/Updated card, as its first row, mono. That card becomes a shared component, `RecordInfo_Card` in `src/components/cards/record-info-card.tsx`: props `id` and `idLabel` (both optional), `createdAt` and `updatedAt` (both optional), and `children` for extra rows rendered between the ID and Created. It stays server-safe (no `"use client"`; `DataItemDateValue` is already the client island), because the org-admin organisation page is a Server Component. Every page that has a Created/Updated card uses it. A page with no Created/Updated card today doesn't gain one (no new fields: team admin, D4H equipment item).
- **D4H-backed pages get no `RecordInfo_Card`.** D4H member, D4H team and the four catalogue pages don't use `Saratoga.Columns`. Their `D4H ID` is an external ID and D4H's Updated is D4H's, so both stay in the info card; only the card title and the Title/Name row go.
- **Related-record IDs** are a per-page call, recorded in the task's commit body and in the PR. The default: an ID of a related record stays with that record's card (Linked User Account keeps its User ID; the D4H card on a team membership keeps Member ID and Role ID). An ID of something attached to this record with no card of its own (the Subscription ID on a catalogue package) goes in `RecordInfo_Card`'s children.
- **Status badges go next to the title only**, never in `Saratoga.Actions` or inside a row. `Saratoga.Title` gets a `badges` prop that renders them as a sibling of the `<h1>` in a `min-w-0` flex wrapper, so a long name still truncates (the `<h1>` is `whitespace-nowrap overflow-hidden text-ellipsis`), the badge stays visible, and the badge text stays out of the heading's accessible name. It replaces the ad-hoc `className="flex items-center gap-2"` in skill-track's `skill-content.tsx` and `group-content.tsx` and in `d4h-i3/components/form-shared.tsx` (`SubmittedFormHeader`).
- **Status rule, by value** (user, 2026-11-20): a record's own lifecycle status (`RecordStatus`, a package's publish state, a session's approval, a token's status) shows as a title badge **when it isn't the normal state**, and its `Status` row is dropped on every page. Active (or Published, or an open session) shows no badge. Archived, Deleted (Rubbish bin), Withdrawn, Draft/Unpublished, Approved/Submitted and an invalid token each get a badge. **D4H Status** rows are D4H's data, not the record's lifecycle, so they stay rows; the I3 "Returned" `statusBadge` inside the equipment item's D4H Status row stays there too (it describes the D4H status). Each of Tasks 2–7 names the pages that gain or lose a badge.
- **Explanations go in an `Alert variant="warning"`** directly under `Saratoga.Header`, not a muted `<p>`. Shape follows the existing one in `d4h-i3/…/bundle-content.tsx` (`AlertTitle` + `AlertDescription`). The d4h-nag rule's "Paused: …" `Alert` moves from the secondary column to under the header to match.
- **`src/components/cards/user-profile-info.tsx` is deleted**, not swept: nothing imports `UserProfileInfo_Card`.
- **Pages that aren't record detail pages are left alone:** settings pages (`organization-settings-content.tsx` ×2, `user-settings-content.tsx`, `user/settings/account`), dashboards (`user/page.tsx`, `team/dashboard-content.tsx`) and the run summary's status alert in `d4h-nag/…/run-content.tsx` (already an `Alert`). Task 7 checks they stayed unchanged.

## Tasks

### Review group 1: design pass (visual)

- [ ] **Task 1: design pass on three representative pages** `visual`
  - **Files:** `src/components/cards/record-info-card.tsx` (new), `src/components/blocks/saratoga.tsx`, possibly `src/components/ui/card.tsx` + `src/components/ui/README.md`, `src/modules/org-admin/components/personnel/person-content.tsx`, `src/modules/skill-track/components/package-content.tsx`, `src/modules/d4h/components/items/equipment-item-content.tsx`, `src/components/cards/user-profile-info.tsx` (deleted)
  - **Do:** Build `RecordInfo_Card`, `Saratoga.Title`'s `badges` prop, and the pencil placement for a title-less card (weigh the two alternatives in Decisions), per the Decisions. Apply them to three pages:
    - **person:** pencil kept; Name row goes; Person ID → `RecordInfo_Card`; Status row goes, Archived/Deleted shows as a title badge; the Linked User Account card is untouched.
    - **skill-track catalogue package:** "Subscribed · Withdrawn" leaves `Saratoga.Actions` for a title badge ("Withdrawn", or "Deleted" for a deleted package); the muted explanation becomes a warning `Alert`; Name row goes; Package ID → `RecordInfo_Card`, with Subscription ID in its children.
    - **D4H equipment item:** card title "Item Information" goes; pencil kept; the `Ref` row goes (the `<h1>` is `<ref> <kind>`); no `RecordInfo_Card` (the page has no Created/Updated card). The I3 `statusBadge` stays in the D4H Status row.

    Delete `user-profile-info.tsx`. The page shape (`docs/patterns/detail-page-data-fetching.md`) is unchanged.

  - **Done when:** the three pages render with no card title restating the `<h1>`, no Name row, the ID first in the secondary card, status only next to the title, the explanation in an Alert, and a long title still truncating with a badge; `npm run check` passes; the user approves the look at the checkpoint. Record the settled pencil placement in Decisions before Task 2 starts.

**Checkpoint:** visual, on the three pages.

### Review group 2: sweep (org-admin, skill-track, skill-package-builder)

- [ ] **Task 2: org-admin and the shared team card**
  - **Files:** `src/modules/org-admin/components/users/user-content.tsx`, `teams/team-content.tsx`, `teams/team-membership-content.tsx`, `d4h-access-tokens/access-token-content.tsx`, `src/components/teams/team-details-card.tsx`, `src/modules/team-admin/components/team-admin-content.tsx`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/organization/page.tsx`, `content/help/team-admin.mdx`
  - **Do:** Apply Task 1's shape. Per page:
    - **org user:** "User Details" title and Name row go. User ID stays in the info card with the user's fields, because the secondary card's Created is the org membership's (`member.createdAt`), not the user's; that card becomes `RecordInfo_Card` with no ID and its Created relabelled "Joined". The Linked Person card keeps its title and its Person ID (related record).
    - **team membership:** the `<h1>` is "Team Membership", so the info card loses only its "Details" title; Membership ID → `RecordInfo_Card`; Status row → title badge when not Active; the D4H card keeps Member ID, Role ID and D4H Status.
    - **org access token:** "D4H Access Token" title goes; Token ID → `RecordInfo_Card`. The Label row stays (the `<h1>` falls back to `Access Token: <id>` when there's no label). Status row → title badge when not Active.
    - **`Teams_Details_Card`:** title and Team ID go; Status row → title badge on the org team page. Add `showName` (default false): org-admin's team page omits it (its `<h1>` is the name), team admin passes it (its `<h1>` is "Team Admin"). Team ID → `RecordInfo_Card` on the org team page only; team admin has no Created/Updated card and doesn't gain one. Rename the help card's "**Team Details**" in `content/help/team-admin.mdx` to describe the card without that title.
    - **organisation page:** the card titled with the org name under the `<h1>` "Organisation" loses the title, keeps Name (the `<h1>` doesn't say it), and Organisation ID → `RecordInfo_Card` (server-rendered).
    - `personnel/linked-user-card.tsx` is unchanged.
  - **Done when:** each page follows the Decisions; `npm run check` passes.

- [ ] **Task 3: skill-track** `mechanical`
  - **Files:** `src/modules/skill-track/components/session-content.tsx`, `skill-content.tsx`, `group-content.tsx`
  - **Do:** Apply Task 1's shape. Title and Name rows go; IDs → `RecordInfo_Card`. Archived badges move to the `badges` prop; the muted explanation `<p>`s under the header become warning `Alert`s. The skill page's `Related` card keeps its title. Session: Status row goes, "Approved" (or whatever non-open state it shows) becomes a title badge; the `<h1>` gets the breadcrumb's fallback, `session.name || session.id`, since an unnamed session would otherwise have an empty heading.
  - **Done when:** as Task 2.

- [ ] **Task 4: skill-package-builder** `mechanical`
  - **Files:** `src/modules/skill-package-builder/components/package-content.tsx`, `group-content.tsx`, `skill-content.tsx`
  - **Do:** Apply Task 1's shape. Title and Name rows go; IDs → `RecordInfo_Card`; Status rows → title badges when not the normal state (package: not Published; group/skill: not Active). Keep the remaining row order (Package/Group rows first).
  - **Done when:** as Task 2.

### Review group 3: sweep (system-admin, user-settings, D4H modules)

- [ ] **Task 5: system-admin and user-settings**
  - **Files:** `src/modules/system-admin/components/users/user-content.tsx`, `groups/group-content.tsx`, `organizations/organization-content.tsx`, `src/modules/user-settings/components/d4h-access-token-content.tsx`, `organization-content.tsx`
  - **Do:** Apply Task 1's shape. Per page:
    - **system user:** "Identity" title and Name row go; User ID → the existing secondary Created card, which becomes `RecordInfo_Card`; Status row → title badge when not the normal state.
    - **system group:** title and Name row go; Group ID → `RecordInfo_Card`.
    - **system organisation:** "Identity" title and Name row go; Organisation ID and Created → `RecordInfo_Card` at the top of the existing secondary column. Members, Teams, Groups, Enabled Modules and Record Counts keep their titles.
    - **user-settings token:** the `<h1>` is the fixed "D4H Personal Access Token", so the card drops "Token Details" but keeps Label; Token ID → `RecordInfo_Card`; the Status row's outline badge becomes a title badge when not Active.
    - **user-settings organisation:** "Organisation" title and Name row go; its secondary "Joined" card becomes `RecordInfo_Card` with no ID.
  - **Done when:** as Task 2.

- [ ] **Task 6: D4H** `mechanical`
  - **Files:** `src/modules/d4h/components/members/member-content.tsx`, `teams/team-content.tsx`, `catalogue/brand-content.tsx`, `model-content.tsx`, `category-content.tsx`, `type-content.tsx`
  - **Do:** Card titles and Name/Title rows go. D4H ID, D4H Status and D4H's Updated stay in the info card; no `RecordInfo_Card` (Decisions: D4H-backed pages).
  - **Done when:** as Task 2.

- [ ] **Task 7: D4H I3 and D4H nag**
  - **Files:** `src/modules/d4h-i3/components/bundles/bundle-content.tsx`, `templates/template-content.tsx`, `src/modules/d4h-i3/components/form-shared.tsx`, `src/modules/d4h-nag/components/rule-content.tsx`, `run-content.tsx`
  - **Do:** Per page:
    - **bundle:** "Bundle Details" title and Name row go; Status row → title badge when not Active (Rubbish bin keeps its `Alert` too); the Created/Updated card becomes `RecordInfo_Card` with no ID.
    - **template:** the card title and Name row go. `D4HI3Module_OtherRecords_Badge` (now inside the `CardTitle`) moves to the `badges` prop. Created/Updated → `RecordInfo_Card` with no ID.
    - **`SubmittedFormHeader`** in `form-shared.tsx`: its "Submitted" badge moves to the `badges` prop.
    - **rule:** "Rule Details" title goes; the "Paused: …" `Alert` moves under `Saratoga.Header`; the Status row → title badge when paused; Created → `RecordInfo_Card` with no ID.
    - **run:** "Run Details" stays: it summarises the run beside a status `Alert`, and the `<h1>` is a generated title it doesn't restate.
  - **Done when:** as Task 2. Then check every file in this plan's task lists for a `CardTitle` (including multi-line ones) that restates its `<h1>`, and that none of the excluded pages changed.

**Checkpoint:** visual, one page per module from groups 2 and 3.

## Docs impact

Detail pages lose their "… Details" card title, Name row and Status row (now a title badge), and IDs move to the Created/Updated card: re-shoot detail-page screenshots in `content/docs/admin/{personnel,teams,users,organization}.mdx`, `skill-track/{packages,sessions}.mdx`, `skill-package-builder/index.mdx`, `d4h-i3/index.mdx`, `d4h/index.mdx`, and fix any "Details card" wording; note it on #494.

## Out of scope

- Settings pages and dashboards (see Decisions), and list pages.
- Changing what a record shows (no new fields, no removed properties beyond Name and the moved ID).
- Edit/Delete menu changes (`EntityActionMenu` is already in place).

## Parked

## Review notes
