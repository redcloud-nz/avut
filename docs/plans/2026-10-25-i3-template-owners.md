# D4H I3 template record owners

**Date:** 2026-10-25
**Issue:** [#454](https://github.com/redcloud-nz/avut/issues/454) (part of #456, milestone v0.12 - dunedin)
**Branch:** `feat/i3-template-owners`, worktree `.claude/worktrees/i3-template-owners` (dev server on its `.dev-port`, 3102)
**DB:** no migration. Shared `avut` is fine.
**Written against:** integration @ e5467032

I3 templates are org-wide, but the D4H records they point at (category and type on the
template, brand and model on each variant) are each owned by one D4H team or by the D4H
organisation the teams share. This branch makes each record's owner visible where it's picked
and shown, checks it against the recipient's team when issuing, and adds an org setting that
limits the pickers to organisation-owned records.

## Decisions

- **Templates stay org-wide.** No per-template team (ruled out in the issue).
- **Owners are resolved from D4H when needed, not stored.** No migration and no backfill. The
  snapshot titles on `I3Template_D4H` and `I3TemplateVariant_D4H` stay as they are.
- **One owner resolution, which keeps the record's real owner.** A single server function,
  `resolveCatalogueOwner`, turns a raw D4H `owner` (`{ resourceType, id }`) into
  `{ resourceType, id, title }`.
  - It always keeps the raw `resourceType` and `id`, and resolves only the `title`.
  - A `Team` owner's title comes from the token's `d4HTeams`. When the team is out of reach, it
    falls back to "Another D4H team".
  - An `Organisation` owner's title comes from `getD4HTokenMetadata().d4HOrganisations`, falling
    back to "D4H organisation".
  - It never substitutes the listing team or its organisation. Today's
    `team` / `team.owner!` substitution in `listEquipment*` goes, so the owner on those outputs
    now always means the real owner.
- **What "fits" means.** A record fits D4H team T when it is in T's own listing _and_ its real
  owner is T (`Team`, id T) or T's organisation (`Organisation`, id `T.owner.id`). A template fits T
  when its category and kind both fit. A variant fits T when its brand and model both fit, and
  the variant's template fits too. A template with no D4H configuration fits no team. Whether a
  template fits doesn't depend on which other teams the token reaches.
- **The rule lives in pure code in `src/lib/`**, so the server check (processor) and the
  server-computed filter for the Issue form share it. The client never re-implements it. It
  reads the answer from a procedure.
- **Setting:** `modules["d4h-i3"].organisationRecordsOnly`, boolean, default `false`. It sits
  next to `storage` in `organizationSettingsSchema`. It only changes what the template and variant
  pickers offer. It doesn't change issuing.
- **Flagged templates stay usable for their own team** while the setting is on. The fit check
  already keeps them to the team that owns their records. The flag shows on the templates list
  and the template page only while the setting is on, and it is a hint to edit the template.
- **"Organisation-owned" means the AVUT org's linked D4H organisation.** The linking spec
  (`src/server/d4h-link-invariants.ts`, §4.3) allows an AVUT org's linked teams to come from one
  D4H organisation only, stored as `Organization_D4H.d4hOrganisationId`. The client reads it from
  `trpc.teams.getOrganizationD4H`.
  - With the setting on, the pickers offer only records whose owner is `Organisation` with that
    id. Records owned by any other D4H organisation the token reaches are hidden, the same as
    team-owned ones.
  - The setting's promise then holds: a new template fits every D4H team linked to this org.
  - When there's no `Organization_D4H` row, or the org is in org-less-team mode
    (`d4hOrganisationId` null), the setting has no organisation to match. The switch is disabled
    with a note ("Needs this organisation linked to a D4H organisation"), and the pickers ignore
    the setting.
  - The fit rule at issue time is unchanged. It matches each team to its own organisation.
  - (This replaces an earlier "any D4H organisation" decision. Confining all of I3 to linked
    teams is parked.)
- **Editing a flagged template with the setting on:** the picker still lists the record that's
  currently selected, even when the setting would filter it out, so renaming a template doesn't
  force a new category. The option carries the same "team-owned" marker as the flag. Every other
  team-owned option is hidden.
- **Pickers group by owner** the way `D4HTeamMemberSelect` groups by team (#449): sticky
  `SelectLabel` group headers, with organisation groups first and then teams A–Z. The trigger
  shows the owner in muted text after the title. When every option has the same owner, groups
  and the trigger suffix are left out. All four record types use one shared, generic select.
  Shared controls take `organisationOnlyId: number | null` as a prop: the linked D4H
  organisation id when the setting is on and a link exists, otherwise `null`. They never read a
  module's settings themselves.
- **Issue form:** the Add Item and Edit Item dialogs offer only templates and variants that fit
  the recipient's team, from a new `i3.listTemplateFits({ teamId })` query. **Add Item** is
  disabled until a recipient is chosen. An item already in the list that doesn't fit (for
  example, after the recipient changed) gets a warning on its row, and **Submit** is disabled
  while any item doesn't fit, as it already is for the create-permission warning.
- **Submission re-checks on the server** in a new processor stage before anything is created in
  D4H. `runStages` in `src/server/form-processor.ts` returns straight after a stage error, so no
  later stage runs and nothing is POSTed. `submitIssueItemsForm` rethrows the first stage
  error's message, which the client toasts as "Form processing failed: …".
- **Owner display** (template page, variants table, pickers) uses the catalogue pages'
  `D4HModule_Owner`, moved to the shared layer, since a module can't import another module. A
  `Team` owner links only when the team is in the token's reach.
- **Non-suspending queries are deliberate here**, an exception to the `useSuspenseQuery` rule in
  `docs/conventions-checklist.md`. Owner data on the template page and list, and the Issue form's
  fit query, use `useQuery`. The page renders straight away, and a D4H failure (no token, for
  instance) leaves owners and flags out rather than blanking the page. The existing brand and
  model selects already work this way.

## Tasks

### Review group A — data layer

- [x] **1. One catalogue owner resolution, plus per-list and per-team fetchers** — `feat(d4h): resolve catalogue record owners and fetch catalogues per team (#454)`
  - **Files:** `src/server/d4h-api/equipment.ts`, `src/server/d4h-api/equipment.test.ts`,
    `src/trpc/routers/d4h-api-router.ts`, `src/trpc/routers/d4h-api-router.test.ts`
  - **Do:** In `equipment.ts`, add the following.
    - `resolveCatalogueOwner(rawOwner, metadata)`, where `metadata` is
      `{ d4HTeams, d4HOrganisations }` from `getD4HTokenMetadata`, following the rule in
      Decisions.
    - One fetcher per list, each for one team. Each GETs its endpoint in team context, parses the
      results with the matching `inputSchema`, resolves every owner with `resolveCatalogueOwner`,
      and returns records shaped like the output `schema`. On a failed GET it throws with the
      message shape the router uses today.
      - `fetchD4HTeamEquipmentCategories(accessToken, teamId, metadata)`
      - `fetchD4HTeamEquipmentKinds(…)`
      - `fetchD4HTeamEquipmentBrands(…)`
      - `fetchD4HTeamEquipmentModels(…)`
    - `fetchD4HTeamEquipmentCatalogue(accessToken, teamId, metadata)`, which runs all four in
      parallel and returns `{ categories, kinds, brands, models }`.

    Rewrite `listEquipmentBrands`, `listEquipmentCategories`, `listEquipmentKinds` and
    `listEquipmentModels` in the router to map their own fetcher over `d4HTeams`. De-duplicate
    and sort exactly as they do today (kinds stay unsorted). Each procedure still makes one GET
    per team.

  - **Done when:**
    - New `equipment.test.ts` cases cover a `Team`-owned record listed by its own team, a record
      owned by a reachable team but listed by another, a record owned by an _unreachable_ team
      (it keeps its real id and gets the fallback title), an `Organisation`-owned record whose
      organisation is in `d4HOrganisations`, and one whose organisation isn't.
    - New router cases (two teams, one record listed by both) check de-duplication, sort order
      (kinds unsorted) and the output shape for all four procedures. The router has no such
      tests today.
    - `npm run check` passes.

- [x] **2. Fit rule and the `organisationRecordsOnly` setting** — `feat(i3): add template fit rule and organisationRecordsOnly setting (#454)`
  - **Files:** `src/lib/i3-template-fit.ts` (new), `src/lib/i3-template-fit.test.ts` (new),
    `src/lib/schemas/organization-settings.ts`, `src/lib/schemas/organization-settings.test.ts`
  - **Do:** Write pure functions, with no server imports:
    - `isOrganisationOwned(owner)`
    - `catalogueRecordFitsTeam(record | undefined, team)`, where `team` is
      `{ id, owner?: { id } | null }`. It returns false for `undefined`, which means the record
      isn't in the team's listing.
    - `templateFitsTeam(templateD4H | null, catalogue, team)` and
      `variantFitsTeam(variantD4H | null, templateD4H | null, catalogue, team)` (as built: the
      template's records are needed for "the template fits too"). They look up `categoryId`/`kindId`
      or `brandId`/`modelId` by id in the catalogue from task 1. Type it structurally, so the
      client can import this file. A `null` D4H config doesn't fit.
    - `isOwnedByOrganisation(owner, d4hOrganisationId)`: true only for an `Organisation` owner
      with that id.
    - `usesOtherRecords(templateD4H, { categories, kinds }, d4hOrganisationId)` and
      `variantUsesOtherRecords(variantD4H, { brands, models }, d4hOrganisationId)` for the flag.
      They're true when any referenced record that's found isn't owned by that organisation,
      whether it's team-owned or owned by another organisation. A record that isn't found doesn't
      flag.

    Add `organisationRecordsOnly: z.boolean().default(false)` to `modules["d4h-i3"]`, with a
    short JSDoc comment saying it limits the template and variant pickers and doesn't change
    issuing.

  - **Done when:** unit tests cover every branch of the fit rule:
    - owned by T
    - owned by another reachable team
    - owned by an unreachable team but listed by T (doesn't fit)
    - owned by T's organisation
    - owned by another organisation
    - missing from T's listing
    - a `null` config
    - a variant whose template doesn't fit

    The flag helpers are tested with a team-owned record, a record owned by another organisation,
    and one owned by the linked organisation. The settings default test includes the new key, and
    `npm run check` passes.

- [x] **3. `I3Templates` fit service + `i3.listTemplateFits` procedure** — `feat(i3): add template fit service and listTemplateFits procedure (#454)`
  - **Files:** `src/server/services/i3-templates.ts`, `src/server/services/i3-templates.test.ts`,
    `src/trpc/routers/i3-router.ts`, `src/trpc/routers/i3-router.test.ts`
  - **Do:** Add two service functions. Both take `OrgServiceContext`.
    - `getD4HTeamFitContext(ctx, { accessToken, teamId })` returns `{ team, catalogue }`. It reads
      `getD4HTokenMetadata(toD4HCredentialRef(accessToken))` and throws `NotFoundError` when
      `teamId` isn't in `d4HTeams`, as `listEquipmentItemContents` does. It fetches the
      catalogue with `fetchD4HTeamEquipmentCatalogue`.
    - `listFitsForD4HTeam(ctx, { accessToken, teamId })` builds on it. It loads the org's
      non-Deleted templates with `d4h` and `variants.d4h`, using the same `where` as the
      router's `listTemplates` procedure, and returns `{ templateIds, variantIds }`: the ids that
      fit, using task 2's rule.

    Add `listTemplateFits: organizationProcedure({ i3Item: ["issue"] })` to the router, in
    alphabetical place, before `listTemplates`. Its input is `{ teamId: z.number() }` and its
    output is `{ templateIds: I3TemplateId[], variantIds: I3TemplateVariantId[] }`. It gets the
    token with `getConfiguredD4HAccessToken` and calls `listFitsForD4HTeam`. Follow
    `src/trpc/CLAUDE.md` and `src/server/services/CLAUDE.md`. It's read-only, so there's no
    `logEvent`.

  - **Done when:** service tests (prisma-mock, D4H fetchers mocked) cover a fitting template, a
    misfit template, a variant misfit under a fitting template, a Deleted template excluded, and
    an unreachable team → `NotFoundError`. A router test shows the permission gate. `npm run
check` passes.

- [x] **4. Issue processor re-checks fit before creating equipment** — `feat(i3): re-check template fit before issuing items to D4H (#454)`
  - **Files:** `src/forms/i3-issue-items/processor.ts`, `src/forms/i3-issue-items/processor.test.ts`,
    `src/trpc/messages.ts`
  - **Do:** Add a `CheckTemplateFit` stage after `ProcessItems` and before
    `CreateEquipmentInD4H`. It calls `I3Templates.getD4HTeamFitContext` for
    `ctx.formData.recipient.teamId`, then applies `templateFitsTeam`/`variantFitsTeam` to the
    `items` that `ProcessItems` already loaded, with no second template query. On the first
    misfit, it throws an `Error` whose message comes from a new `Messages` entry, for example
    `"Hi-vis vest (Large)" can't be issued to Rescue Team B: its D4H records belong to another
team.` Put the variant name in brackets only when the item has one. The pipeline stops at a
    stage error (see Decisions), so nothing else is needed to keep the POST from running.
  - **Done when:** processor tests cover the passing case (POST called), a misfit template and a
    misfit variant. In both misfit cases the POST isn't called and the error names the template,
    the variant and the team. `npm run check` passes.

_End of group A: review with `avut-code-reviewer`._

### Review group B — settings and pickers (visual checkpoint after task 8)

- [x] **5. D4H I3 module settings card with the new switch** — `feat(i3): D4H I3 settings card with organisation-owned records switch (#454)` — `visual`, `mechanical`
  - **Files:** `src/components/organization-settings/d4h-i3-module-settings.tsx` (new),
    `src/components/organization-settings/organization-settings-form.tsx`
  - **Do:** Build `D4HI3Module_SettingsCard`, which wraps the D4H I3 `Feature_SettingsCard`.
    Follow `skill-track-module-settings.tsx` for the wrapper, but accept `isModuleEnabled` and
    forward it, as the current card in the form does. The card's child is one `SettingRow`,
    following `personnel-settings.tsx`.
    - Title: "Organisation-owned records only".
    - Description: "When creating or editing templates, offer only the D4H categories, types,
      brands and models owned by your D4H organisation, so every new template can be issued in
      every team."
    - Value: an `OrganizationSettings_SettingSwitch` with `slice="modules.d4h-i3"` and
      `field="organisationRecordsOnly"`, or a `SettingEnabledBadge` when the user can't edit.
    - When the org has no linked D4H organisation (`getOrganizationD4H` returns null or
      `d4hOrganisationId: null`), disable the switch and add the note "Needs this organisation
      linked to a D4H organisation". The system admin settings page has no current
      organisation, so read the link with the `organizationId` the card already gets. Check that
      the procedure's `allowSystemAdmin` option covers it, and add the option if it doesn't.
      `OrganizationSettings_SettingSwitch` may need a `disabled` prop. Add one if so.

    Swap the new card into the form in place of the plain one, keeping the same `id` and flag
    gate.

  - **Done when:** the switch saves and survives a reload, on both the org admin and system admin
    settings pages, and it's disabled with the note for an org with no linked D4H organisation.
    `npm run check` passes.

- [x] **6. Move the owner display to the shared layer** — `refactor(d4h): move the owner display to the shared layer (#454)` — `mechanical`
  - **Files:** `src/modules/d4h/components/catalogue/owner.tsx` → `src/components/d4h/d4h-owner.tsx`
    (rename the export `D4HOwner`), plus every file importing it (`grep -rn D4HModule_Owner src`)
  - **Do:** `git mv` the file and rename the component.
    - Add a `variant?: "full" | "compact"` prop. `full` is today's output: the owner, then
      "(Team)"/"(Organisation)" in muted text. `compact` is the owner title alone, in muted text
      with no link, for use inside select options and triggers.
    - Add `linkable?: boolean` (default `true`). A `Team` owner renders `D4HTeamLink` only when
      it's true. Catalogue callers pass whether the owner's id is among the token's teams (from
      `listAccessibleTeams`, or whatever team list the page already has), as
      `type-content.tsx` already does for items.
    - Update the imports.
  - **Done when:** the catalogue pages look as they did before, except that an unreachable team
    owner isn't a link. `grep -r "D4HModule_Owner" src` returns nothing. `npm run check` passes.

- [x] **7. Generic grouped D4H catalogue select + four wrappers** — `feat(d4h): grouped D4H catalogue select with category, type, brand and model wrappers (#454)` — `visual`
  - **Files:** `src/components/controls/d4h-catalogue-select.tsx` (new),
    `src/lib/d4h-catalogue-options.ts` (new), `src/lib/d4h-catalogue-options.test.ts` (new),
    `src/components/controls/d4h-equipment-category-select.tsx` (new),
    `src/components/controls/d4h-equipment-type-select.tsx` (new),
    `src/components/controls/d4h-equipment-brand-select.tsx`,
    `src/components/controls/d4h-equipment-model-select.tsx`
  - **Do:** - **Grouping helper.** Write a pure `groupCatalogueOptions(records, { organisationOnlyId,
selectedId })` in `src/lib/d4h-catalogue-options.ts`. It returns ordered groups:
    organisation owners first, then teams A–Z, with records A–Z inside each. Each record carries
    an `otherOwnerMarker` flag. When `organisationOnlyId` isn't null, the helper drops every
    record not owned by that organisation (task 2's `isOwnedByOrganisation`) except
    `selectedId`, which stays with `otherOwnerMarker: true`. - **Generic select.** Build `D4HCatalogueSelect<T extends { id; title; owner }>` with props
    `records`, `value: number | null`, `onChange(record)`, `placeholder`, `organisationOnlyId`
    and the existing `slotProps` shape. It renders the helper's groups with sticky
    `SelectLabel` + `SelectSeparator`, as `D4HTeamMemberSelect` does. When there's more than one
    group, the trigger shows the title plus a `compact` `D4HOwner`. With a single group there
    are no labels and no suffix. - **Brand and model selects.** Rewrite them as thin wrappers that keep their current props
    and their `useQuery` + pending/error/success `match`. Each gets a new
    `organisationOnlyId?: number | null` prop (default `null`), passed through. The model select keeps
    its brand filter. - **Category and type selects.** Add wrappers in the same style. The type select takes
    `categoryId` and filters kinds by `kind.category.id`, as `create-template.tsx` does inline
    today. Use the "D4H Type" wording for kinds in UI copy.
  - **Done when:** the helper's tests cover ordering, a single group, the organisation-only filter
    (including hiding a record owned by another organisation) and keeping a selected record that
    the filter would drop. `npm run check` passes. Task 8 checks the components
    in the browser.

- [x] **8. Use the shared selects in the four template/variant dialogs** — `visual`, `mechanical`
  - **Files:** `src/modules/d4h-i3/components/templates/create-template.tsx`,
    `update-template.tsx`, `add-variant.tsx`, `update-variant.tsx`
  - **Do:** In the create and update template dialogs, replace the inline category and kind
    `Select`s with the task 7 wrappers. Keep each `onChange` behaviour: set `…Title`, and reset
    the kind when the category changes. Drop the `useSuspenseQueries` for categories and kinds
    that are no longer needed. In all four dialogs, pass `organisationOnlyId`. When
    `organization.settings.modules["d4h-i3"].organisationRecordsOnly` is on (from
    `useOrganization()`), that's the `d4hOrganisationId` from `trpc.teams.getOrganizationD4H`.
    Otherwise it's `null`, which is also the value when the org has no link. Put that derivation
    in one small hook in `src/modules/d4h-i3/lib/`, and reuse the hook in task 9.
  - **Done when:** with several D4H teams, the four dialogs group options by owner. With the
    setting on (task 5's switch), only organisation-owned options show, plus a flagged template's
    current selection, which is marked. `npm run check` passes.

_End of group B: review with `avut-code-reviewer`, then the visual checkpoint (settings card and the
four dialogs)._

### Review group C — template pages, Issue form (visual checkpoint after task 11)

- [x] **9. Owners and team-owned flag on the template page and list** — `visual`
  - **Files:** `src/modules/d4h-i3/components/templates/template-content.tsx`,
    `template-variants.tsx`, `templates-list.tsx`
  - **Do:**
    - **Template page.** It _always_ fetches `listEquipmentCategories`/`Kinds` (in
      `template-content`) and `listEquipmentBrands`/`Models` (in `template-variants`) with
      `useQuery`. Show a `compact` `D4HOwner` after the Category and Type links, and after each
      variant's brand and model links, matched by id. While the lists are pending, or if they
      fail, show the title alone.
    - **Flag on the page.** When task 8's hook gives an organisation id, show a warning badge
      ("Not organisation records") in the Template Details card header if `usesOtherRecords` is
      true, and a small marker on any variant row where `variantUsesOtherRecords` is true. The
      badge's tooltip says the template can only be issued to teams that own its records, and
      should be edited to use the D4H organisation's records.
    - **Templates list.** It fetches all four lists only while the hook gives an id (`enabled`),
      and shows the same badge in the Name cell when the template _or any of its variants_ uses
      other records.
  - **Done when:**
    - Owners show on the template page for a template with records from two teams, with the
      setting on or off.
    - With the setting on, the flag appears on the list and on the page for a template with
      team-owned records (including a variant-only case), and not for one with only organisation
      records.
    - With D4H unreachable, both pages still render.
    - `npm run check` passes.

- [ ] **10. Issue form offers only templates that fit the recipient** — `visual`
  - **Files:** `src/modules/d4h-i3/components/issue-items-form-content.tsx`
  - **Do:**
    - **The query.** In the parent `D4HI3Module_IssueItems_FormInstance_Content`, which owns
      `recipient`, `recipientTeam`, `lacksCreatePermission` and Submit, query
      `i3.listTemplateFits({ teamId: recipient.teamId })` with `useQuery`, enabled when
      `recipient.teamId > 0`.
    - **Misfits.** `useWatch` the `items` and compute the misfits: items whose template or
      variant isn't in the fit set, counted only once the query has succeeded. Disable Submit
      while there are any, alongside `lacksCreatePermission`.
    - **Passing it down.** Pass the fit set (or `undefined` while it loads), the team title and
      the misfit indexes to `D4HI3_Issue_ItemsSection`.
    - **Item list.** **Add Item** is disabled until a recipient is chosen, with a hint ("Choose a
      recipient first"). `AddItemDialog` and `EditItemDialog` both list only fitting templates
      and variants. If nothing fits, the dialog says so in place of an empty select: "No templates
      can be issued to <team>." A misfit row gets a warning line ("Can't be issued to <team>").
    - **Query error.** Show a warning `Alert` ("Couldn't check templates against D4H") and leave
      Submit enabled. Task 4's server re-check still guards.
  - **Done when:**
    - Picking recipients in two different teams changes the templates offered in both dialogs.
    - Switching the recipient after adding an item flags that item and disables Submit.
    - A misfit that reaches the server shows task 4's message as the toast. To force one, edit
      the template's D4H records after adding the item, before the query refetches.
    - `npm run check` passes.

- [ ] **11. Update the D4H I3 help card** — `mechanical`
  - **Files:** `content/help/d4h-i3.mdx`
  - **Do:** Follow `content/README.md`'s help-card rules.
    - Add to the **Issue Items** bullet: only templates whose D4H records belong to the
      recipient's team or its organisation are offered, and an item that doesn't fit blocks
      **Submit**.
    - Add to the **Templates** bullet: each record shows the D4H team or organisation that owns
      it, and the **Organisation-owned records only** setting limits the pickers.
    - The card is already 286 words, over the 250-word maximum. Trim the whole card to 250 words
      or fewer (`wc -w` on the body) and keep its voice. The longer explanation belongs in the
      guide, through the docs issue.
  - **Done when:** the body is 250 words or fewer, and the card renders in the `?help=` sheet.
    `npm run check` passes.

_End of group C: review with `avut-code-reviewer`, then the visual checkpoint (template page and
list, Issue form)._

## Docs impact

The I3 template dialogs, template page and list, Issue Items and org settings → Modules all
change. That means the guides and screenshots for I3 Templates, Issue Items and organisation
settings.

## Out of scope

- Storing owners on templates (decided against: no migration).
- Caching the per-team D4H catalogue fetch. If it's slow, follow up with `"use cache"` and the
  credential's `d4hApiCacheTag`.
- Applying the template ref format when issuing (#27).
- Confining D4H I3 as a whole (recipients, pickers, issued types) to the D4H teams linked to
  AVUT teams. See Parked.
- Blocking flagged templates while the setting is on.

## Parked

- **Scope D4H I3 to the org's linked D4H teams.** Every I3 list (the recipient select, catalogue
  pickers, issued types, the fit query) currently fans out over every D4H team the user's
  personal token reaches. That includes teams that aren't linked to any AVUT team in this org.
  Confining them to linked teams (`Team_D4H`) would change what every I3 user sees, and probably
  belongs with the D4H module too. Raised during #454 planning, 2026-10-25.

## Review notes

- **Group A, task 1:** `fetchD4HTeamCatalogueList` (`src/server/d4h-api/equipment.ts`) sends no `size` query, so a large catalogue could be truncated. The fit check then refuses records missing from the team listing. Pass `query: { size: 10000 }` as `fetchD4HTeamEquipmentList` does, or confirm in a comment that D4H returns these lists unpaginated.
- **Group A, task 4:** reword `Messages.i3ItemDoesNotFitTeam` neutrally, for example `…can't be issued to <team>: its D4H records aren't owned by <team> or its D4H organisation.`, since a misfit can also be another organisation's record, or a record missing from the listing. Update the processor test strings to match.
- **Group B, task 7:** when the selected id isn't in the fetched D4H list at all (the record was deleted in D4H), the catalogue select's trigger is blank. Let the wrappers take an optional fallback title (the template or variant's snapshot `…Title`), and show it in muted text with the marker.
- **Group B, task 7:** `D4HCatalogueSelect` has no empty state. When it has no groups, render a disabled hint inside `SelectContent`: "No records owned by your D4H organisation" when `organisationOnlyId != null`, otherwise "None available". This happens in practice, for example in the model select under a kept team-owned brand.
- **Group B, task 5:** in `d4h-i3-module-settings.tsx`, a failed `getOrganizationD4H` query shows the "Needs this organisation linked…" note. On `isError`, leave the switch disabled and leave the note out. Also end the note with a full stop. Add a `teams-router.test.ts` case for `getOrganizationD4H` with `allowSystemAdmin`: a system admin with no membership gets the link, a missing org gets NOT_FOUND, and a non-member who isn't an admin is refused.
