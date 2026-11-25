# Kit check: send per-member forms and collect responses

**Date:** 2026-11-25
**Issue:** [#578](https://github.com/redcloud-nz/avut/issues/578) (stage 2 of #576)
**Branch:** `feat/kit-check-send`, worktree `.claude/worktrees/kit-check-send`
**DB:** adds a migration. `npm run db:branch kit-check-send` before the first `migrate dev` (task 2), with every connection to `avut` closed; `npm run db:unbranch` after merge.
**Written against:** integration @ b5fb87d5

Email each D4H member of the chosen teams their own kit-check form, built from an I3 bundle and pre-filled from D4H. The member answers with no AVUT account, through a link carrying a hashed token. Their answers autosave as a draft and are submitted when they're done. A system admin sends, tracks and resends from an unlinked page.

## Decisions

Settled 2026-11-25 (posted on #578):

1. **Token lifetime:** 14 days per token from send. Resend revokes the old token (replaces its hash), issues a new one and restarts the 14 days.
2. **Reminders:** none in v1. Per-member resend only.
3. **Sizes:** a template's variants are its size list (variant names already carry the size, as stage 1's demo assumes: picking a variant is picking the size). A template with no variants gets a free-text size field, optional. No new template field.
4. **Stage 1's mocked template settings are out of scope:** no `allowOwn`/"Using my own", no `optional` "might have" section, no considered items (`proposals`). Stage 2 sends the plain bundle form: held items, missing templates, extra rows, comments. The server rejects `has: "own"`. Follow-up issues are drafted for them at the end (see Parked).

Added by the user (relayed 2026-11-25): **the member form autosaves a draft**, like the I3 forms, rather than being submit-only.

From reading the code:

5. **Answers live on a `FormInstance`** (`formKey: "kit-check"`, no user), linked 1:1 from its `KitCheckRequest`. This replaces the issue's "response lines per request" table, so it needs the user's OK and a note on #578. No `FormInstanceItem`s: the answer is one `KitCheckResponseData` JSON (held answers keyed by D4H item id, missing answers keyed by template id, extra rows, comments), validated by a Zod schema on every save and submit. Each answer already carries what the issue's lines asked for (has, need via `replace`/`wantVariantId`, size, serial, notes), and the extra rows are the free rows. The instance's `formData` is the **working copy**. At submit, the answers are also copied to `KitCheckRequest.submittedData`, which is **the submitted answer**: what the track page shows and what stage 3 reads (decision 10).
6. **Pre-fill is snapshotted at send, not computed on open.** The send runs as the admin with their personal D4H token, computes `compareBundle()` per member and stores: the bundle's templates once on the `KitCheck` (`templates` JSON), each member's held items on their request (`heldItems` JSON), and the Draft `FormInstance` with the pre-filled answer (held lines `has: "yes"`). Why: the public page then never calls D4H, so it has no D4H failure mode and needs no org-owned D4H credential for d4h-i3. And the form stays stable between visits. That matters because held answers are keyed by D4H item id, and a recomputed held list would orphan saved answers.
   6a. **Templates are per team** (settled during task 3). Which lines are comparable depends on the team (`compareBundle` excludes `not-in-team` lines through `listFitsForD4HTeam(teamId)`). So each member is asked about their own team's comparable lines, the same ones the bundle matrix shows for that team. `KitCheck.templates` holds a map from D4H team id to that team's `KitCheckTemplate[]` (still one JSON column; no migration change), and the public read picks the request's team. - **Variants:** the service loads `I3TemplateVariant` rows (id, name, D4H brand/model) itself. The bundle lines carry only brand/model pairs, and `I3Bundles` stays as it is. It offers the variants that have a D4H record and are in the team's `listFitsForD4HTeam` `variantIds`, with `label` set to the variant's `name`. - **A held item's `variantId`:** the variant whose D4H brand and model both equal the item's. When no variant matches exactly, it's `null`. - **Template `category`:** the line's `d4h.categoryTitle`. - **Held item `description`:** brand and model titles when D4H has them, otherwise the item's `ref`. - **`problems`:** `"serial"` when the quality check reports a missing serial; `"variant"` when brand or model is missing or the item matches no variant (`not-a-variant`/`should-be-blank`).

7. **Opening the link changes nothing on GET.** Email link scanners open every URL (see the D4H nag opt-out page). The page only reads. The client calls `publicForms.openKitCheckByToken` once on mount, and the first `saveKitCheckDraftByToken` also stamps `openedAt` if it's unset. So "opened" holds up even when a JavaScript-running scanner fires the mount call, and when the mount call is lost.
8. **Autosave over a token.** The `forms` router's procedures are org procedures and need a session, so the kit check gets token procedures on `publicForms`, named like the nag ones: `getKitCheckByToken` (query), `openKitCheckByToken`, `saveKitCheckDraftByToken`, `submitKitCheckByToken`, `reopenKitCheckByToken`. Each hashes the token (`hashLinkToken`, `src/server/link-token.ts`) and finds the request with that hash and `expiresAt > now`. The read returns `{ state: "not-found" } | { state: "ok", … }`, as `getOptOutByToken` does, so the page renders a card rather than hitting an error boundary. The mutations throw `NotFoundError("This link has expired or isn't valid.")`. Unknown, replaced and expired tokens get the same answer. The debounced-save core of `useDraftFormAutosave` moves to a shared hook that takes the save mutation, so the I3 forms and the kit check share it (the hook itself is tied to the `forms` router's mutations).
9. **In-flight saves at submit**, as `Forms.saveInstance` and the form processor handle them. The draft save writes with `updateMany({ where: { id, formStatus: "Draft" } })` and throws `ConflictError` on a count of 0. The submit writes `formData` with `formStatus: "Submitted"` through `update({ where: { id, formStatus: "Draft" } })` inside the array `$transaction`, so a save landing after it is refused, and a second submit (two tabs) throws and rolls the whole transaction back, log entry included. The client calls the hook's `cancel()` before submitting. The submit doesn't run through `FormProcessingPipeline`: there are no stages, its final write uses the global client and sets `Processed`, and it can't share a `$transaction` with the log entry.
10. **Resubmitting before expiry.** The submitted page shows the summary, plus a "Change my answers" button while the token is live. `reopenKitCheckByToken` sets the instance back to `Draft`. `submittedData` and `submittedAt` stay, so the last submitted answers survive an edit that's never finished. Autosave resumes on `formData`. Submitting again replaces `submittedData` and restamps `submittedAt`. The track page shows a reopened request as "Editing since <time> (submitted <time>)", and its answers dialog shows `submittedData`. After expiry, the page says the link has expired, and the stored answers stay. Kit-check instances are the first that go from non-draft back to Draft: update the comment at `src/server/services/forms.ts:134` to say so. They're user-less, so nothing that relies on that rule sees them.
11. **Logging.** New log object types `KitCheck` and `KitCheckRequest`, mapped to the `d4h-i3` module in `src/lib/schemas/log-entry.ts`. Draft saves aren't logged (as with the `forms` router). Submit and reopen log against `KitCheckRequest` through `unattendedOrgContext`, with a `public-form-submission` batch whose `actorLabel` is the member's name and team, like v0.13.2's public forms. The admin's actions use `ctx.logEvent` under a new `kit-check-send` operation batch:
    - create logs the `KitCheck` and each `KitCheckRequest`;
    - each send's outcome (`Sent` or `Failed`) is one entry on that request, paired with the status write;
    - resend logs one entry with its outcome.
12. **Recipients:** every D4H member of each chosen team, Operational and Non-operational (`getD4HTeamMembers`), one request per (D4H team, member). A member with no D4H email gets a request with delivery `NoEmail`, so the track page shows who couldn't be reached, which is exactly what the paper sheet lost. A member in two chosen teams gets two requests (D4H member ids are per team).
13. **Delivery and progress are separate.**
    - `deliveryStatus` holds the last send: `Pending` (claimed, send not confirmed), `Sent`, `Failed` or `NoEmail`. As in the nag runner, the token hash and `expiresAt` are written just before `sendEmail`. On failure they're cleared and the status goes to `Failed`.
    - Progress is derived and never overwritten by delivery: `openedAt`, `submittedAt`, and the instance's `formStatus`. The track page shows, per request: Not opened / Opened / Submitted / Editing.
    - **Resend keeps the draft.** The existing `FormInstance`, its draft answers, `submittedData` and the progress timestamps are left alone. Only the token is replaced (the old link stops working) with a fresh 14 days. The member picks up where they left off.
    - Resend is allowed for any delivery but `NoEmail`. It issues a new token, `expiresAt` and `sentAt`, then runs the same send step. A failed resend sets only `deliveryStatus: Failed` and clears the token, so the member's progress and answers stay. `sentAt` changes only on a successful send.
    - A request stuck in `Pending` (the loop died mid-run) can be resent like a `Failed` one.
14. **Sending is sequential, in the mutation.** Expected sizes are tens of members. Sends are spaced `SEND_SPACING_MS` apart, and `sendEmail`, `sleep` and `createLinkToken` are injected dependencies for tests, both as in the nag runner (`src/server/services/d4h-nag-runner.ts`). One failure marks that request `Failed` and the loop carries on. The mutation returns counts (sent, failed, no email).
15. **Access.** Every `kitChecks` procedure is system-admin only: `organizationProcedure({}, { allowSystemAdmin: true })`, plus a middleware that throws FORBIDDEN when `ctx.isSystemAdmin` is false. An org member without the Better Auth `admin` role is refused even with every org role. The admin pages read only `kitChecks` procedures, `listD4HTeams` and `listBundles` included, because `d4hApi.listTeams` needs `d4hEquipment: ["view"]` without the admin bypass. The D4H reads also need the caller's personal D4H token in the org, PRECONDITION_FAILED without one. The new page shows a "needs your personal D4H token: add one in User Settings › D4H" state rather than an error.
16. **Where the code lives.**
    - The admin pages are in the `d4h-i3` module, at `/orgs/[slug]/d4h-i3/kit-checks`, `/kit-checks/new` and `/kit-checks/[kit_check_id]`. They're unlinked (no sidebar, index or dashboard entry), and their UI is in `src/modules/d4h-i3/components/kit-checks/`.
    - Server: service `src/server/services/kit-checks.ts`, router `src/trpc/routers/kit-checks-router.ts` (`kitChecks`), effects `src/client/kit-checks-effects.ts`. The public procedures go on `publicForms`, kept alphabetical.
    - The member form stays in `src/components/kit-check/`.
    - Moves to the shared layer: `compareBundle()` and the item-quality rules go to flat files, `src/lib/i3-bundle-compare.ts` and `src/lib/i3-item-quality.ts` (beside `src/lib/i3-template-fit.ts`), because `src/server` can't import `src/modules`. The form's completeness rules go to `src/lib/kit-check-validate.ts`, so the server can check a submit.
    - The answer and snapshot shapes are defined once, as Zod schemas in `src/lib/schemas/kit-check.ts`. `src/lib/kit-check-types.ts` (moved from `src/components/kit-check/` in task 1) imports and re-exports the inferred types; the demo-only extras (`allowOwn`, `optional`, proposals) stay as optional fields.
17. **Public form bot check.** `submitKitCheckByToken` checks BotID and joins `PUBLIC_FORM_BOT_PROTECTED_PATHS`. Save, open and reopen don't: they fire often, and the token already gates them. The kit check isn't added to `PUBLIC_FORMS`, which is for forms whose organisation comes from a slug. Its doc comment is reworded to say so.

## Tasks

### Review group A1: data layer (schema, snapshot, reads)

- [x] **1. Move the bundle comparison and kit-check rules to the shared layer** `mechanical` (refactor(kit-check): move bundle comparison and kit-check rules to the shared layer)
  - **Files:** `src/modules/d4h-i3/lib/bundle-compare.ts` → `src/lib/i3-bundle-compare.ts`, `src/modules/d4h-i3/lib/item-quality.ts` → `src/lib/i3-item-quality.ts`, `src/components/kit-check/kit-check-validate.ts` → `src/lib/kit-check-validate.ts`, `src/components/kit-check/kit-check-types.ts` → `src/lib/kit-check-types.ts` (`src/lib` is the leaf layer and can't import from components, lint), their tests, and every importer (`bundle-matrix.tsx`, `bundle-member-comparison.tsx`, `item-quality-badge.tsx`, `issued-type-content.tsx`, the kit-check form and summary, anything else `grep` finds).
  - **Do:** `git mv` the files and their tests; update imports. No behaviour change. Don't rewrite dated plans in `docs/plans/`.
  - **Done when:** `npm run check` passes; `grep -rn "d4h-i3/lib/bundle-compare\|d4h-i3/lib/item-quality\|kit-check/kit-check-validate" src` finds nothing.

- [x] **2. Schema, migration, IDs, answer schemas, log vocabulary** (feat(kit-check): add kit check schema, migration and answer schemas)
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_kit_checks/`, `src/lib/schemas/kit-check.ts` (new) + test, `src/components/kit-check/kit-check-types.ts`, `src/lib/forms.ts`, `src/lib/operations.ts`, `src/lib/schemas/log-entry.ts`, `src/lib/public-forms.ts` (comment only).
  - **Do:**
    - `KitCheck`: `id`, `organizationId` (cascade), `bundleId String?` (FK `I3Bundle`, `onDelete: SetNull`, so a purged bundle doesn't block the Rubbish bin, `src/server/services/trash.ts`), `bundleName` (snapshot), `d4hTeams Json` (`[{ id, title }]`), `templates Json` (snapshot, decision 6), `status RecordStatus @default(Active)`, `sentById String?` (FK `User`, SetNull), `createdAt`, `updatedAt`. Index on `organizationId`. Map `kit_checks`.
    - `KitCheckRequest`: `id`, `organizationId` (cascade), `kitCheckId` (cascade), `d4hTeamId Int`, `d4hTeamTitle`, `d4hMemberId Int`, `memberName`, `email String?`, `heldItems Json` (snapshot), `tokenHash String? @unique`, `expiresAt DateTime?`, `deliveryStatus KitCheckDeliveryStatus`, `sentAt`, `openedAt`, `submittedAt` (all `DateTime?`), `submittedData Json?` (decision 10), `formInstanceId String @unique` (FK `FormInstance`, cascade), `createdAt`, `updatedAt`. `@@unique([kitCheckId, d4hTeamId, d4hMemberId])` (no separate `kitCheckId` index). Map `kit_check_requests`.
    - `enum KitCheckDeliveryStatus { Pending Sent Failed NoEmail }`.
    - Relations named `"<model>_to_<model>"` as elsewhere (`"kit_check_to_organization"`, `"kit_check_request_to_kit_check"`, …), with back-relations on `Organization`, `I3Bundle`, `User`, `FormInstance`.
    - `src/lib/forms.ts`: the `kit-check` form key beside `I3IssueItemsForm`.
    - `src/lib/schemas/kit-check.ts`: `KitCheckId`, `KitCheckRequestId` (as other schema files define ids), `KIT_CHECK_TOKEN_DAYS = 14`, the token input schema (length-capped like `linkTokenSchema`), and Zod schemas for the template and held-item snapshots and for the answer, `KitCheckResponseData` (held, missing, extras, comments; `has` limited to `"yes" | "no" | null`; string length and record-size caps so a public save can't store an unbounded blob). `kit-check-types.ts` re-exports the inferred types, keeping the demo-only fields optional, and `KitCheckResponse.proposals` becomes optional.
    - `src/lib/operations.ts`: `"kit-check-send": { label: "Kit check send" }`.
    - `src/lib/schemas/log-entry.ts`: `KitCheck` and `KitCheckRequest` in `logObjectTypeValues`, mapped to `"d4h-i3"` in `moduleByObjectType`.
    - Run `npm run db:branch kit-check-send` (ask the user to stop their dev server and Prisma Studio first), then, **with permission**, `npm run prisma migrate dev --name kit_checks`.
  - **Done when:** the migration applies on `avut_kit-check-send`; a schema test parses a stage-1-shaped answer and rejects `has: "own"` and an oversized one; the demo still typechecks; `npm run check` passes.

- [x] **3. Snapshot helper and recipient preview** (feat(kit-check): add kit check snapshot helper and recipient preview)
  - **Files:** `src/server/services/kit-checks.ts` (new) + test, `src/trpc/routers/kit-checks-router.ts` (new) + test, `src/trpc/routers/_app.ts`, `src/server/d4h-api/equipment.ts`, `src/trpc/routers/d4h-api-router.ts`.
  - **Do:** follow `src/server/services/CLAUDE.md`, `src/trpc/CLAUDE.md` and `.claude/rules/testing.md`.
    - The router's base procedure (decision 15).
    - Extract the issued-item filter (`owner.id === teamId`, location a Member) from `d4hApi.listTeamIssuedEquipment` into `src/server/d4h-api/equipment.ts`, and use it from both places.
    - `listD4HTeams` (the caller's token's teams) and `listBundles` (the org's Active bundles, through the `I3Bundles` service).
    - `buildKitCheckSnapshot`, a pure helper. It turns a bundle's comparable lines into `KitCheckTemplate[]`: category, name, variants as `{ id, label }`, `requireSN`, `sized: variants.length === 0`, `sizeOptional: true`, `sizeOptions: []`, no `allowOwn`/`optional` (decision 3). It turns a member's comparison row into `KitCheckHeldItem[]`, one per counted item: D4H item id, template id, brand/model or ref as description, serial, matched variant id, and `problems` from the item's quality. It also gives the pre-filled `KitCheckResponseData`, with each held item `has: "yes"`.
    - `previewRecipients({ bundleId, d4hTeamIds })`: per team, its members with name, email (trimmed, `null` when blank, as the nag runner reads it) and how many bundle lines they hold; plus the lines the comparison excludes and why. It uses the caller's D4H token, `getD4HTokenMetadata` (a team the token can't reach is NOT_FOUND), `fetchD4HTeamEquipmentItems` plus the extracted filter, `getD4HTeamMembers`, `I3Templates.listFitsForD4HTeam`, `I3Bundles.getWithLines` and `compareBundle()`. Task 5 reuses the same computation.
  - **Done when:** router tests cover FORBIDDEN for an org owner without the admin role, PRECONDITION_FAILED with no D4H token, and NOT_FOUND for a team the token can't reach; snapshot tests cover variants, no variants, serials and items with problems; `d4hApi.listTeamIssuedEquipment`'s tests still pass; `npm run check` passes.

- [x] **4. Admin reads** (feat(kit-check): add kit check admin reads)
  - **Files:** `src/server/services/kit-checks.ts` + test, `src/trpc/routers/kit-checks-router.ts` + test.
  - **Do:**
    - `listKitChecks`: each check's bundle name, teams, sent by and when, and counts by delivery and progress.
    - `getKitCheck({ kitCheckId })`: the check with its requests. Per request: member, team, email, delivery status, sent/opened/submitted times, expiry, and the instance's `formStatus` (so the page can show Editing). Never `tokenHash`.
    - `getKitCheckAnswers({ requestId })`: the snapshot templates and held items, `submittedData`, the instance's `formData` and `formStatus`.
    - Another org's check or request is NOT_FOUND.
  - **Done when:** tests cover the shapes, NOT_FOUND across orgs, and no `tokenHash` in any output; `npm run check` passes.

### Review group A2: data layer (send, public procedures)

- [ ] **5. Create and send**
  - **Files:** `src/server/services/kit-checks.ts` + test, `src/trpc/routers/kit-checks-router.ts` + test, `src/emails/kit-check-request.tsx` (new) + test, `src/client/kit-checks-effects.ts` (new).
  - **Do:**
    - The email, `KitCheckRequestEmail` (React Email, following `d4h-attendance-reminder.tsx`): greeting with the member's name, who's asking, the bundle and team, the link (`${baseUrl}/forms/kit-check/<token>`) and when it expires. Plain wording.
    - A send step shared with resend. It runs `createLinkToken()`; writes `tokenHash`, `expiresAt` (now + 14 days) and `deliveryStatus: Pending`; sends with `sendEmail` and `orgReplyTo`. On success, one `$transaction` sets `Sent` and `sentAt` with its log entry. On failure, one sets `Failed`, clears `tokenHash` and `expiresAt`, and logs. Dependencies are injected as in the nag runner (decision 14).
    - `createKitCheck({ bundleId, d4hTeamIds })`:
      - computes as the preview does;
      - in one `$transaction`, creates the `KitCheck` and, per member, a Draft `FormInstance` (`userId: null`, pre-filled answer) and a `KitCheckRequest` (`Pending`, or `NoEmail` with no email), with `ctx.logEvent` entries under a `kit-check-send` batch (`docs/patterns/transactional-writes.md`);
      - then runs the send step for each `Pending` request in turn, spaced `SEND_SPACING_MS` apart;
      - returns `{ kitCheckId, sent, failed, noEmail }`.
    - Mutation effects in `src/client/kit-checks-effects.ts` for `listKitChecks` and `getKitCheck`.
  - **Done when:** tests cover: requests and drafts created per member; `NoEmail` for blank emails; a failed send leaves `Failed` with no hash while the rest send; sends are spaced; the email test renders the link and expiry; `npm run check` passes.

- [ ] **6. Resend**
  - **Files:** `src/server/services/kit-checks.ts` + test, `src/trpc/routers/kit-checks-router.ts` + test, `src/client/kit-checks-effects.ts`.
  - **Do:** `resendRequest({ requestId })` refuses `NoEmail` with a domain error that maps to BAD_REQUEST. Otherwise, whatever the delivery (`Pending` included), it runs the send step, which replaces the old hash (decision 1). Progress and answers are untouched (decision 13). Effects as for create.
  - **Done when:** tests cover: resend replaces the hash, so the old token no longer resolves, and restarts expiry; a failed resend of a submitted request leaves `submittedAt`, `submittedData` and the instance alone; a stuck `Pending` request can be resent; `NoEmail` is refused; `npm run check` passes.

- [ ] **7. Public token procedures**
  - **Files:** `src/server/services/kit-checks.ts` (or `kit-check-public.ts` beside it) + test, `src/trpc/routers/public-forms-router.ts` + a new test, `src/lib/public-forms.ts`, `src/client/public-forms-effects.ts` (new, or beside the jacket form's queries if a file exists), `src/server/services/forms.ts` (comment only, decision 10).
  - **Do:** `publicProcedure`s taking the capped token schema, kept alphabetical in the router, sharing one lookup (decision 8).
    - `getKitCheckByToken` returns `{ state: "not-found" }` or `{ state: "ok", … }`. The ok state carries the subject (member name, team title, bundle name, requested by: the sender's name, or "the team equipment officer" when the sender is gone), the templates, the held items, the instance's `formData` and `formStatus`, `submittedData`, `submittedAt` and `expiresAt`. Nothing else about the org or other members.
    - `openKitCheckByToken` stamps `openedAt` if unset. Idempotent.
    - `saveKitCheckDraftByToken({ token, formData })` parses `formData` with `KitCheckResponseData` and writes with `updateMany` where `formStatus` is Draft, CONFLICT on 0 (decision 9). It stamps `openedAt` if unset. Not logged.
    - `submitKitCheckByToken({ token, formData })` checks BotID first, as `submitJacketInterest` does. It parses `formData` and checks completeness with `src/lib/kit-check-validate.ts` (BAD_REQUEST if incomplete). Then one array `$transaction`: the instance `update` where Draft, setting `formData` and `formStatus: "Submitted"`; the request's `submittedData` and `submittedAt`; and the log entry through `unattendedOrgContext` with a `public-form-submission` batch (decision 11). Add `/trpc/publicForms.submitKitCheckByToken` to `PUBLIC_FORM_BOT_PROTECTED_PATHS`.
    - `reopenKitCheckByToken` sets Submitted → Draft and is logged the same way (decision 10).
    - Effects: submit and reopen invalidate `getKitCheckByToken`. Saves don't, so the open form isn't re-seeded.
  - **Done when:** tests cover:
    - an unknown, a replaced and an expired token each give `not-found`, and the mutations NOT_FOUND with the same message;
    - open is idempotent;
    - a save stamps `openedAt`;
    - a save after submit is CONFLICT;
    - a second submit throws and writes no log;
    - an incomplete submit is BAD_REQUEST;
    - reopen keeps `submittedData`, and submitting again replaces it and restamps `submittedAt`;
    - a bot verdict is FORBIDDEN (`vi.mock("botid/server")`).

    `npm run check` passes.

### Review group B: admin pages (visual), then checkpoint 1

The admin pages come before the member form, so the member form's checkpoint has real tokens, sent from the UI.

- [ ] **8. Kit checks list and send page** `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h-i3/kit-checks/page.tsx`, `…/kit-checks/new/page.tsx`, `src/modules/d4h-i3/components/kit-checks/kit-check-list.tsx`, `kit-check-new.tsx` (new), `OPT_OUT_ROUTES` in `src/components/docs/help-cards.test.ts`.
  - **Do:** follow `docs/patterns/detail-page-data-fetching.md` (page shell, prefetch + `HydrateClient`, `useSuspenseQuery`). Run `npx next typegen` after adding the pages.
    - The list is top-level, so it has no trail. It's a `Kaga` table of checks (bundle, teams, sent, counts) with a New button.
    - The new page has the trail `Kit Checks`. Pick a bundle (`kitChecks.listBundles`) and one or more D4H teams (`kitChecks.listD4HTeams`), then show a recipients preview per team (name, email or a "No email" badge, items of the bundle held) and the excluded lines with why.
    - Send asks for confirmation, stating how many emails go out, and that outside production they go to the Resend sink.
    - After the send, go to the check's page with a toast of the counts.
    - No personal D4H token: show the "add one in User Settings › D4H" state (decision 15).
    - Unlinked: no sidebar, index or dashboard entry.
  - **Done when:** a system admin can preview and send on the branch DB (mail lands in the Resend sink); an org admin without the system role is refused; `npm run check` passes.

- [ ] **9. Track page: progress, answers, resend** `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h-i3/kit-checks/[kit_check_id]/page.tsx`, `src/modules/d4h-i3/components/kit-checks/kit-check-content.tsx`, `kit-check-answers-dialog.tsx`, `kit-check-resend-dialog.tsx` (new), `OPT_OUT_ROUTES`.
  - **Do:** a detail page with the trail `Kit Checks`.
    - Header: bundle, teams, sent by and when, and counts.
    - A `Kaga` table of requests: member, team, email, delivery (Sent / Failed / No email / Sending), progress (Not opened / Opened / Submitted / "Editing since … (submitted …)", decision 10), sent/opened/submitted times and expiry.
    - Row actions, as `?action=` dialogs per `docs/patterns/mutation-dialog.md`:
      - **View answers** renders `KitCheck_Summary` over the snapshot and `submittedData`. With nothing submitted yet, it shows "Not submitted yet" above the current draft.
      - **Resend** asks for confirmation. It's hidden for `NoEmail`.
  - **Done when:** progress moves as the member form is used; resend sends a new link and the old one stops working; `npm run check` passes.

**Checkpoint 1:** send to a test D4H team on the branch DB, with mail in the Resend sink, and look over the list, new and track pages.

### Review group C: member form (visual), then checkpoint 2

- [ ] **10. Shared debounced autosave hook** `mechanical`
  - **Files:** `src/hooks/use-debounced-autosave.ts` (new), `src/modules/d4h-i3/components/form-shared.tsx`.
  - **Do:** move the debouncer, `handleChange` (reset a settled mutation, then `maybeExecute`) and `cancel()` out of `useDraftFormAutosave` into `useDebouncedAutosave`, which takes the save function and the mutation's status/reset (wait defaults to 2000 ms). `useDraftFormAutosave` keeps its signature and calls it. No behaviour change for the I3 forms.
  - **Done when:** `npm run check` passes; the I3 Issue Items form still autosaves (shown at checkpoint 2).

- [ ] **11. Make the member form controllable** `visual`
  - **Files:** `src/components/kit-check/kit-check-form.tsx`, `kit-check-summary.tsx`, `src/lib/kit-check-validate.ts` + test.
  - **Do:**
    - Add `initialResponse?: KitCheckResponse` (state starts from it) and `onChange?: (response: KitCheckResponse) => void`, called with the whole response after every edit.
    - Add a footer slot and a `submitting` prop, so the page can show the save status beside the submit button and disable it while submitting.
    - The demo keeps working unchanged.
    - With no `optional` templates and no proposals, the form shows neither section and its section numbers have no gaps.
    - A template with no variants and `sized: true, sizeOptional: true` shows the free-text size field.
  - **Done when:** the demo at `/forms/kit-check/demo` behaves as before; a test covers validation with a no-variant sized template; `npm run check` passes.

- [ ] **12. Public page `/forms/kit-check/[token]`** `visual`
  - **Files:** `src/app/(public)/forms/kit-check/[token]/page.tsx`, `src/components/kit-check/kit-check-member.tsx` (new). No `OPT_OUT_ROUTES` entry: that list covers only authenticated pages.
  - **Do:** follow the D4H nag opt-out page: `robots` noindex and `referrer: "no-referrer"`. A token that fails the input schema gets the invalid card without a call. Otherwise `prefetch(trpc.publicForms.getKitCheckByToken…)` and `HydrateClient`. Nothing changes on GET (decision 7). Run `npx next typegen`. The client component:
    - **`not-found`:** a plain card, "This link has expired or isn't valid. Ask whoever sent it for a new one.", and nothing else.
    - **On mount:** calls `openKitCheckByToken` once.
    - **Draft:**
      - `KitCheck_Form`, with `initialResponse` from `formData` plus `proposals: {}`;
      - `onChange` goes to the shared autosave hook over `saveKitCheckDraftByToken`;
      - a `SaveStatusIndicator`, and the link's expiry date;
      - a reopened draft says the earlier answers stand until they submit again;
      - submit calls `cancel()`, then `submitKitCheckByToken` on its own, not batched (see the note in `src/lib/public-forms.ts`), then shows the submitted view.
    - **Submitted:** `KitCheck_Summary` of `submittedData`, "Thanks", and "Change my answers" (`reopenKitCheckByToken`) while the link is live.
  - **Done when:** with a token from checkpoint 1's send:
    - the page pre-fills held lines;
    - it autosaves (a reload keeps the answers);
    - it submits, reopens and resubmits;
    - an expired and an unknown token show the same card;
    - `npm run check` passes.

**Checkpoint 2:** the member form at phone and desktop widths, opened from a link in the Resend sink; the track page following it; the I3 Issue Items form still autosaving.

## Docs impact

None for the guides: the admin pages are unlinked and system-admin only, and the member form is reached by email. No help card; the admin routes go on `OPT_OUT_ROUTES`.

## Out of scope

- Reminders (decision 2); bulk resend.
- Stage 1's mocked settings: "Using my own", "might have" items, considered items (decision 4).
- The needs report, CSV and D4H fixes (stage 3, #576). Stage 3 reads `submittedData`, and its CSV will reuse `csvCell`'s formula escaping.
- Closing or deleting a kit check from the UI (`status` exists for later).
- Moving the bundle pages to team scope (#574, which waits on this; it will import from the new `src/lib/i3-*` paths).
- General scoped access codes (redcloud-nz/avut-ideas#32).

## Parked

Follow-ups to draft at the end (ask before filing):

- I3 template setting "Members may use their own" (`allowOwn`), and the form's "Using my own" answer.
- I3 bundle lines marked optional ("things you might have"), and the form's section for them.
- Considered items (proposals) on a kit check, to gauge interest in kit not yet in I3.

## Review notes
