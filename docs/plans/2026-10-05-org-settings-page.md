# Organisation settings: own admin page, dialog-based editing, read-only view

**Date:** 2026-10-05
**Issue:** [#353](https://github.com/redcloud-nz/avut/issues/353) (from `docs/ideas/2026-10-02-cleanup.md` item 8)
**Branch:** `feat/org-settings-page`
**Worktree:** `.claude/worktrees/org-settings-page`, with its dev server on 3115 (its `.dev-port`).
**DB:** no migration and no schema change. The settings tree and `updateOrganizationSettingsSlice` stay as they are.
**D4H:** nothing here needs a D4H token. The D4H integration card only reads and writes settings.
**Written against:** integration @ 5dda779e

## Goal

Organisation settings get their own admin page at `/orgs/[slug]/admin/organization-settings`, linked from the admin sidebar and the admin index. Every card shows its current values. Editors change them in place: inline switches for on/off settings, Enable/Disable on module and integration cards, and `?action=` dialogs for typed values (see [Revised at the visual checkpoint](#revised-at-the-visual-checkpoint-2026-10-05)). Anyone with `organization: ["view"]` can read the page. Edit actions only appear for `organization: ["update"]` on the org page, and always on the system-admin page.

## Decisions

### Revised at the visual checkpoint (2026-10-05)

The user reviewed Task 2's per-setting switch dialogs and changed how settings are edited. These decisions replace the ones further down wherever they conflict: the generic switch dialog, the `update-*-enabled` actions, the "Status" rows, and `ModuleEnabled_SettingsCard`.

- **Rows are `SettingRow`** (`setting-row.tsx`), not `DataItem`. A row has the title in bold, the explanation underneath across the full width, and the value with the editing control on the right (`value`, then `action`).
- **On/off settings inside a card** (the two Personnel switches) use an inline instant-save switch, `OrganizationSettings_SettingSwitch` (`setting-switch.tsx`). Flipping it saves a single-field patch. Viewers see `SettingEnabledBadge` instead. There's no dialog, and the boolean-key typing from the old switch dialog carries over.
- **Modules and integrations use `Feature_SettingsCard`** (`feature-settings-card.tsx`).
  - Disabled: the card shows an `Empty` box saying "This module/integration is not enabled for your organisation", with an **Enable** button that saves straight away.
  - Enabled: the card shows its `children` (its own settings), and the header carries a **Disable** button. Disable opens a confirm dialog on `?action=disable-<key>`; the card owns that param (Recipe C), because a successful disable swaps the header the button lives in.
  - Viewers see the `Empty` message without the button, and no Disable button.
  - It takes `slice`, `enabled`, `kind: "module" | "integration"`, `title`, `description?` and `children?`.
- **An enabled module with no settings** (D4H Views, I3, Notes, Skill Package Builder) is just the card header with Disable. The user confirmed that's fine.
- **The D4H default server shows only while D4H is enabled**, as `children` of its card. This replaces the "always shown" decision below.
- **Dialogs remain only for typed values:** rubbish bin retention (`update-rubbish-bin`), the D4H default server (`update-d4h-default-server`) and Skill Track's result options (`update-skill-track-results`). Each one's trigger is a ghost pencil in that `SettingRow`'s `action` slot.
- **No card has a Save/Reset footer.**

### As first planned

- **Route:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/organization-settings/page.tsx`, a sibling of `organization/`. The old `organization/settings/` folder is deleted. `next.config.ts` `redirects()` gets `/orgs/:slug/admin/organization/settings` → `/orgs/:slug/admin/organization-settings`, `permanent: true`.
- **Breadcrumbs:** `Admin / Organisation Settings`. The page title stays "Organisation Settings".
- **Nav:** an "Organisation Settings" `NavSubItem` directly after "Organisation" in `Admin_Sidebar_Menu`, and an index `Item` directly after Organisation on the admin index. Both are wrapped in `<Protect permissions={{ organization: ["view"] }}>`, as the index's Organisation item already is. The gear button on the Organisation page header goes.
- **`canEdit`:** `OrganizationSettingsForm` takes a required `canEdit: boolean` and passes it to every card. The org page gets it from `useHasPermission({ organization: ["update"] })`, and the system-admin page passes `true`, since the procedures accept system admins through `allowSystemAdmin`. The cards can't use `<Protect>`, because the system-admin page has no current organisation (`useOrganization()` would throw). `docs/conventions-checklist.md` normally flags an ad-hoc permission boolean, so the `canEdit` prop carries a one-line comment saying why it isn't `<Protect>`.
- **Without `canEdit`, edit actions are hidden, not disabled.** That's `<Protect>`'s default and what the rest of the app does. The dialog components aren't rendered at all, so a pasted `?action=update-…` URL opens nothing for a viewer. The tRPC procedure stays the real guard.
- **Dialogs follow `docs/patterns/mutation-dialog.md`, Recipe A (self-triggered),** as `src/components/user/user-settings/update-date-format.tsx` does. Each one owns its `useQueryState("action", parseAsStringLiteral([...]))`, has a ghost icon `DialogTrigger` with `<ObjectIcons.Edit />` and an `aria-label`, resets the form and the mutation in an open-transition effect, and closes with `handleDialogOpenChange(false)` from `onSaved`. Recipe A is safe because nothing a save changes unmounts the dialog: the cards and rows render the same whatever the values are.
- **They save through `useOrganizationSettingsMutation`,** and the patch holds only the dialog's own field(s): `{ slice, patch: { field: value } }`. Slice patches are partial (`patchSchemaOf` in `settings-schema.ts`), so a dialog never resends fields it doesn't own. The current D4H card sends the whole slice, `syncToken` included, which this fixes.
- **Granularity:** one dialog per independent setting. Every boolean (the enable flags and the two Personnel switches) gets its own small dialog with one `Switch`. That matches the per-row edit buttons in user settings, and every row then has its own action. Rubbish Bin has one field and gets one dialog. D4H gets two (enabled, default server). Skill Track gets two: enabled, and the result options, which are one coupled form.
- **One generic switch dialog:** `OrganizationSettings_UpdateSwitch_Dialog` in `update-setting-switch.tsx` covers all nine boolean settings. It takes `organizationId`, `action` (the literal it parses), `slice`, `field`, `value` (current), `title`, `label` and `description`. Make it generic over `S extends OrganizationSettingsSliceId`, with `field` limited to that slice's boolean keys, using the existing `PathValue` from `src/lib/schemas/settings-schema.ts`: `{ [K in keyof PathValue<OrganizationSettings, S>]: PathValue<OrganizationSettings, S>[K] extends boolean ? K : never }[keyof PathValue<OrganizationSettings, S>]`. Then a wrong slice/field pair fails to typecheck. Without that, the server's non-strict patch schema would silently drop the unknown key, and the save would "succeed" and change nothing. TS can't correlate `S` with the discriminated-union input, so one narrowly scoped cast on the `mutate` call is fine, with a comment saying why.
- **Action literals** are `update-<key>` for a card with one setting, and `update-<key>-<field>` when a card has more than one:

  | Setting                         | `?action=`                             |
  | ------------------------------- | -------------------------------------- |
  | Personnel: link on accept       | `update-personnel-link-on-accept`      |
  | Personnel: link on person added | `update-personnel-link-on-create`      |
  | Rubbish Bin retention           | `update-rubbish-bin`                   |
  | D4H enabled                     | `update-d4h-enabled`                   |
  | D4H default server              | `update-d4h-default-server`            |
  | Email enabled                   | `update-email-enabled`                 |
  | D4H Views enabled               | `update-d4h-views-enabled`             |
  | I3 enabled                      | `update-i3-enabled`                    |
  | Notes enabled                   | `update-notes-enabled`                 |
  | Skill Package Builder enabled   | `update-skill-package-builder-enabled` |
  | Skill Track enabled             | `update-skill-track-enabled`           |
  | Skill Track result options      | `update-skill-track-results`           |

- **Display values:** booleans read "Enabled" / "Disabled", as in `user-modules.tsx`. Retention reads "N days". Default server shows the server's `name` from `D4HServerList`. Skill Track has a row per configurable result value, with the value as the title and its label as the value, or a muted "Disabled" when it's off.
- **Explanatory text stays visible to viewers.** Long descriptions, such as the Personnel switch explanations and the retention range, show as muted text under the value in the row, and are repeated as the dialog's `DialogDescription`. Card descriptions (`CardDescription` on the I3/Notes/Skill Track cards) stay.
- **D4H default server** is shown, and editable, whether or not the integration is enabled. Choosing a server ahead of enabling does no harm. The old form greyed the select out, but a read-only row has nothing to grey out.
- **The four enable-only module cards collapse into one component.** `d4h-views-module-settings.tsx`, `i3-module-settings.tsx`, `notes-module-settings.tsx` and `skill-package-builder-module-settings.tsx` are near-duplicates (I3 and Notes differ only in copy). They're replaced by one `ModuleEnabled_SettingsCard` in `module-enabled-settings.tsx`, taking `slice`, `title`, `description?` and the action literal. Skill Track keeps its own file, since it has options.
- **General card dropped** (user decision): `general-settings.tsx` is deleted, along with its `general` section and its contents-nav entry. `general.publicDomain` stays in the schema, so any stored values survive. Nothing reads it today.
- **Section `id`s and `getOrganizationSettingsFormSections`** stay as they are, apart from `general` going. `Saratoga.Contents` is untouched.
- **Email Integration:** the "No additional settings available." placeholder goes. The card is the enabled row and nothing else.
- **No `<dl>` semantics yet.** `DataItem` is still a `div` grid. Switching it to `<dl>` with an inline mobile variant is #351's job, and this doesn't wait for it.

## Tasks

- [x] **1. Move the page to `admin/organization-settings` and link it** `visual` — feat(admin): move organisation settings to its own admin page
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/organization-settings/page.tsx` (new, moved from `organization/settings/page.tsx`, which is deleted along with its folder); `src/components/admin/organization-settings/organization-settings-content.tsx`; `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/organization/page.tsx`; `src/components/admin/sidebar-menu.tsx`; `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/page.tsx`; `next.config.ts`; `docs/patterns/field-layout.md` (line ~30, in the `responsive` gotcha).
  - **Do:** `git mv` the page and fix its `PageProps` route literal and its header comment (`Paths: /orgs/[slug]/admin/organization-settings`). Set the content component's breadcrumbs to `[{ label: "Admin", href: route("/orgs/[slug]/admin", …) }, "Organisation Settings"]`. Remove the gear `<Protect>`/`<Button>`/`<Link>` from the Organisation page header, and its now-unused imports (`SettingsIcon`, maybe `Link`). Add the sidebar `NavSubItem` and the index `Item` (description: "Configure your organisation's settings and modules."), both after Organisation and gated as in Decisions. Add the redirect, with a one-line comment, next to the existing ones in `next.config.ts`. In `field-layout.md`'s `responsive` gotcha, replace the two example files: `admin/organization/settings/page.tsx` (its only page-embedded `responsive` field, D4H's Default Server, moves into a dialog in Task 4) and `user-profile-card.tsx` (it no longer exists). Use `admin/organization/--update/update-organization.tsx`, which has page-embedded `responsive` fields. Run `npx next typegen`.
  - **Done when:** `/orgs/<slug>/admin/organization-settings` renders the existing settings form. The old URL redirects there. The sidebar and admin index show the link for any member. The Organisation page has no gear button. `grep -rn "admin/organization/settings" src next.config.ts docs/patterns` finds only the redirect source. `npm run check` passes.

- [x] **2. `canEdit` plumbing, generic switch dialog, Personnel as display + dialogs; drop General** `visual` — feat(admin): show personnel settings read-only with per-setting dialogs
  - **Files:** `src/components/admin/organization-settings/update-setting-switch.tsx` (new); `update-setting-switch.test.tsx` (new); `personnel-settings.tsx`; `organization-settings-form.tsx`; `organization-settings-content.tsx`; `src/components/system/admin/organizations/organization-settings-content.tsx`; `general-settings.tsx` (deleted).
  - **Do:** Build `OrganizationSettings_UpdateSwitch_Dialog` per Decisions, following `docs/patterns/mutation-dialog.md` (Create/update, Recipe A) and modelled on `user-settings/update-date-format.tsx`. The body is a single horizontal `Field` with `Switch` + `FieldContent`/`FieldLabel`/`FieldDescription`. The footer is Cancel (`DialogCloseButton variant="outline"`) and a `MutationButton` "Save". `form.handleSubmit(onValid, onInvalid)` logs `onInvalid`. Add `canEdit: boolean` to `OrganizationSettingsForm`. Set it from `useHasPermission({ organization: ["update"] })` in the org content component and pass `canEdit` on the system-admin one. Rewrite `Personnel_SettingsCard` as a `Card` with two `DataItem` rows ("Link on invitation accept", "Link when a person is added"), each with Enabled/Disabled plus the muted explanation, and a `DataItemAction` holding the switch dialog only when `canEdit`. Delete `General_SettingsCard`, its section in the form and its entry in `getOrganizationSettingsFormSections`. Update the form's docstring: cards are now read-only displays whose edits go through per-setting dialogs.
  - **Done when:** both Personnel settings can be toggled through their dialogs on the org page and the system-admin page, and the value updates on close without a reload (the `settingsEffects` effect covers that). A `member` (no `organization: update`) sees the rows with no edit buttons, and `?action=update-personnel-link-on-accept` opens nothing for them. Back closes an open dialog. A new `update-setting-switch.test.tsx`, modelled on `src/components/skill-track/record-check-dialog.test.tsx`, asserts that saving sends exactly `{ organizationId, update: { slice, patch: { [field]: checked } } }`. `npm run check` passes.

- [x] **3. Rubbish Bin as display + dialog** — feat(admin): show rubbish bin retention read-only with an edit dialog
  - **Files:** `src/components/admin/organization-settings/rubbish-bin-settings.tsx`; `update-rubbish-bin.tsx` (new).
  - **Do:** Add a `canEdit` prop and pass it from `organization-settings-form.tsx`. The card shows one `SettingRow`: title "Keep deleted records for", the range explanation as `description`, `value` "N days", and the dialog as `action` when `canEdit`. Remove the Save/Reset footer. `OrganizationSettings_UpdateRubbishBin_Dialog` (`?action=update-rubbish-bin`) moves the existing number `InputGroup` field into the dialog body, with `zodResolver(OrganizationSettings.schema.shape.rubbishBin)`, its `FieldError`, and no `orientation` on the `Field` (`docs/patterns/field-layout.md`, dialog gotcha). Same pattern doc as Task 2.
  - **Done when:** the retention can be changed, and out-of-range input (0, 91) shows the field error and doesn't submit. The read-only view works as in Task 2. `npm run check` passes.

- [x] **4. D4H and Email integrations as `Feature_SettingsCard`s** — feat(admin): D4H and email integrations as enable/disable cards
  - **Files:** `src/components/admin/organization-settings/d4h-integration-settings.tsx`; `email-integration-settings.tsx`; `update-d4h-default-server.tsx` (new); `organization-settings-form.tsx`.
  - **Do:**
    - **D4H:** render `Feature_SettingsCard` (`slice="integrations.d4h"`, `kind="integration"`, title "D4H Integration") with one `SettingRow` as `children`: "Default Server", whose `value` is the server's `name` from `D4HServerList`. When `canEdit`, its `action` is `OrganizationSettings_UpdateD4HDefaultServer_Dialog` (`?action=update-d4h-default-server`). The dialog moves the existing `Select` over `D4HServerList` into its body and patches only `defaultServer`. That `Field` has no `orientation` inside the dialog (field-layout.md, dialog gotcha), and the `disabled={!integrationEnabled}` / `useWatch` go.
    - **Email:** `Feature_SettingsCard` with `slice="integrations.email"`, `kind="integration"`, title "Email Integration", and no children.
    - Keep the two exported card components as thin wrappers taking `organizationId`, `settings` and `canEdit`, or render `Feature_SettingsCard` straight from the form, whichever reads simpler.
    - Remove the header switches and the Save/Reset footers.
    - The default-server dialog follows Task 2's original pattern: Recipe A, as in `user-settings/update-date-format.tsx`.
  - **Done when:** Enable and Disable work on both cards. The server saves on its own and doesn't touch `syncToken` or the sync settings (read the `settings.updateOrganizationSettingsSlice` request body). The server row is hidden while D4H is disabled. The read-only view works. `npm run check` passes.

- [x] **5. Enable/disable cards for the settings-only modules** — feat(admin): enable/disable cards for the settings-only modules
  - Built in-session at the visual checkpoint. `Feature_SettingsCard` replaced the four D4H Views / I3 / Notes / Skill Package Builder cards (see the revised Decisions).

- [x] **6. Skill Track as display + dialogs** `visual` — feat(admin): show skill track result options read-only with an edit dialog
  - **Files:** `src/components/admin/organization-settings/skill-track-module-settings.tsx`; `update-skill-track-results.tsx` (new).
  - **Do:** Add a `canEdit` prop and pass it from the form. Render `Feature_SettingsCard` with `slice="modules.skill-track"`, `kind="module"`, and the existing title and description. Its `children` are:
    - a "Skill Check Result Options" sub-heading (the wording `content/docs/skill-track/index.mdx:50` uses), with the results dialog's pencil trigger beside it when `canEdit`, since the dialog edits all the options at once;
    - then one `SettingRow` per `SKILL_TRACK_CONFIGURABLE_RESULT_VALUES` entry: the value as title, and the label as `value`, or a muted "Disabled" when the option is off.

    Remove the header switch and the Save/Reset footer. `OrganizationSettings_UpdateSkillTrackResults_Dialog` (`?action=update-skill-track-results`, `<DialogContent size="lg">`) moves the existing per-result switch + label `Input` rows into the dialog body and patches only `results`. A slice patch is only partial one level down, so `results` has to go whole. The form resets from the full `settings.modules["skill-track"].results` and submits all ten keys, with the hidden Exempt/Expired/Provisional passed through untouched. Use `zodResolver(OrganizationSettings.schema.shape.modules.shape["skill-track"].pick({ results: true }))`. `SKILL_TRACK_CONFIGURABLE_RESULT_VALUES` and its comment stay in `skill-track-module-settings.tsx`, now exported, and the dialog imports them from there. Drop the `w-xl` on the old `FieldSet`, which doesn't fit a dialog. Same pattern doc as Task 2.

  - **Done when:** Enable/Disable and the result options save independently. A disabled result shows as "Disabled", and a relabelled one shows its new label. Clearing a label shows the schema's validation error inside the dialog. The dialog works full-screen at phone width. The read-only view works. `npm run check` passes.

- [x] **7. Docs** — docs(admin): list Organisation Settings in the Admin docs
  - **Files:** `content/docs/admin/index.mdx`; `content/docs/skill-track/index.mdx` (check only).
  - **Do:** Add an **Organisation Settings** bullet to "What's here": the organisation's settings and which modules are switched on. Everyone can see them; owners and admins can change them. Put it after Invitations, or wherever reads naturally with the existing list. Confirm the Skill Track path ("Admin → Organisation Settings → Skill Track Module → Skill Check Result Options") still matches the UI from Task 6, and adjust the wording if it doesn't. Also update the `description` frontmatter if it no longer covers the page.
  - **Done when:** the docs page renders at `/docs/admin` and mentions Organisation Settings. `npm run check` passes.

Between Task 1 and Task 6, the cards not yet converted still show live inputs to viewers. The server rejects their saves, and the branch merges as one PR, so that's accepted.

Visual checkpoints: after **Task 2** (done; it produced the revised Decisions and Task 5), and after **Task 6** (every card).

## Out of scope

- `DataItem` → `<dl>` semantics and the inline mobile variant (#351).
- Surfacing `general.publicDomain`, `modules.i3.storage`, or the D4H sync fields (`teamSync`, `teamMemberSync`, `syncToken`). None of them has UI today.
- Removing `general.publicDomain` from the schema.
- The `--update` page under `admin/organization/` (organisation details editing) and the Organisation page's own layout.
- Changing the settings router, the slice definitions, or `settingsEffects`.
