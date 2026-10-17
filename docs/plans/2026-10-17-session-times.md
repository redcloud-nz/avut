# Session start/end times in the org's time zone

**Date:** 2026-10-17
**Issue:** [#361](https://github.com/redcloud-nz/avut/issues/361) (milestone v0.12 - dunedin)
**Branch:** `feat/session-times`, worktree `.claude/worktrees/session-times`
**DB:** no migration. Runs against shared `avut`. The only `prisma/schema.prisma` change is `///` comments, followed by `npx prisma generate`.
**D4H:** not involved (no token path).
**Written against:** integration @ 12d0c8d1

A skill check session gets a real start and end, defined in an **org time zone**, with times on quarter hours. Approved sessions become fully read-only. `startsAt`/`endsAt` already exist on `SkillCheckSession`, so nothing changes in the schema. Only the meaning of the two columns changes.

## Decisions

- **No migration.** `startsAt`/`endsAt` keep their columns, and their meaning is defined against `OrganizationSettings.general.timeZone` (IANA, default `Pacific/Auckland`). The table in #361 is the contract: an all-day session runs from local midnight to local midnight N calendar days later, a timed session has a start and an optional end, and a timed session with no end stores `endsAt = null`. Document this as `///` comments on the model.
- **All-day is derived:** both ends fall on local midnight in the org's zone, and `endsAt > startsAt`. There's no `allDay` column.
- **The API shape.** `SkillCheckSession.schema` replaces `date` with `startsAt` (ISO, required) and `endsAt` (ISO, nullable).
  - `fromRecord` falls back to `createdAt` when the row's `startsAt` is null, and maps `endsAt` to `null` when it's null or equal to `startsAt`. Existing rows store `endsAt = startsAt`, so the API only ever sees `null` for "no end", and diffing an untouched legacy row doesn't report a spurious change.
  - The write paths always write `startsAt`, and write `null` for "no end".
- **A null stored `startsAt` vs the lock.** The `createdAt` fallback is for display only. Anything that compares against the column uses the **raw stored value**:
  - `lockUnapprovedSession`'s option becomes `expectedStartsAt: Date | null` and matches `startsAt: null` when it's null.
  - `requireSessionAssessor` exposes the raw column next to the parsed session (e.g. `storedStartsAt`), so `setSessionSkillCheck` locks on it. `setSessionSkillCheck` still stamps `checkedAt` from the API `startsAt`, which is the fallback.
  - `updateSession`'s `startChanged` compares against the raw stored value too. A first save of a null-start session writes `startsAt` and re-stamps its checks, which makes the row normal.
- **The schemas:**
  - `SkillCheckSession.modifiableSchema` stays the **unrefined** `.pick({ name, startsAt, endsAt, notes })`, and `updateSession` diffs through it.
  - A new `SkillCheckSession.inputSchema = modifiableSchema.superRefine(...)` checks two things. First, both instants are on a quarter hour (`getTime() % 900_000 === 0`, which holds in every IANA zone and rules out stray seconds). Second, `endsAt > startsAt` when present. Quarter hours plus `>` give the 15-minute minimum.
  - `createSession` and `updateSession` use `inputSchema` in `.input()`. Nothing derives `.pick`/`.omit` from it, because Zod 4 throws on `.pick()` of a refined object.
- **ISO strings are always UTC.** `TZDate#toISOString()` writes an offset, which `z.iso.datetime()` rejects and which would break `diffObject`'s string comparison. Everything that produces an API string goes through `new Date(x.getTime()).toISOString()`.
- **The server doesn't need the org's zone.** Quarter-hour checks and ordering are zone-independent. Only display and the picker read the zone.
- **Checks are re-stamped on any `startsAt` change**, a time-only change included, in the same transaction as today's date change. Changing only `endsAt` doesn't re-stamp. The output field `dateChanged` becomes `startChanged`, and the client effect writes `checkedAt: updated.startsAt`.
- **Approved sessions are read-only.**
  - `updateSession` calls `assertSessionUnlocked` before its no-changes early return, and always runs one `$transaction` that opens with `lockUnapprovedSession` and contains the `ctx.logEvent`, with `rethrowSessionLocked`.
  - The dialog's `dateLocked` state goes. Edit is disabled in the session menu for an approved session, and the Session Details card's edit button is hidden.
  - Changing anything means Reopen, then approve again.
- **One time-zone validator.** `isValidTimeZone` moves out of `user-settings.ts` into `src/lib/schemas/time-zone.ts`, which both `display.timeZone` and `general.timeZone` use. `general` needs no object-level default: `defaultSkeleton` supplies `{}`, and `fromRecords` layers stored rows over `default()`.
  - `timeZoneOptions()` moves from `src/modules/user-settings/` to `src/components/controls/time-zone-options.ts`. It's shared, and `src/lib` can't import the `SearchableSelectOption` type.
- **Timing logic is pure and lives in `src/lib/session-timing.ts`:**
  - `sessionTiming(startsAt, endsAt, orgZone)` returns `{ kind: "allDay", days } | { kind: "timed", end? }`.
  - `formatSessionWhen(startsAt, endsAt, { orgZone, prefs })` renders "Sat 2 Feb 2026 · all day", "Sat 7 – Sun 8 Feb 2026" or "Tue 4 Feb 2026 · 7:00pm – 9:00pm".
    - The date part uses a fixed written pattern with weekday and year (`EEE d MMM yyyy`). It deliberately ignores the viewer's `dateFormat` preference, because the weekday matters for a session.
    - Times follow the viewer's `timeFormat` preference.
    - A timed session gets the zone abbreviation appended when `orgZone !== prefs.timeZone`.
    - The abbreviation comes from `Intl.DateTimeFormat("en-NZ", { timeZoneName: "short" })`, pinned to `en-NZ` so SSR and the browser agree and NZ zones read "NZDT"/"NZST". Other zones may render as "GMT-4", which is fine.
  - `sessionInstants(formState, orgZone)` returns UTC ISO strings, and `sessionFormState(startsAt, endsAt, orgZone)` goes the other way, snapping **both** ends to a quarter hour.
  - `snapToQuarter(date)` rounds to the nearest quarter hour, and `isQuarterHour(date)` tests for one.
  - Calendar-day arithmetic uses `addDays` on a `TZDate`, never `+24h`, because NZ DST days are 23 and 25 hours long.
- **The picker's form state:** `{ date: "yyyy-MM-dd", allDay: boolean, days: number (1–14), startTime: "HH:mm", endTime: "HH:mm" | null }`.
  - Time selects step in 15 minutes.
  - An `endTime` before `startTime` means the next day. An `endTime` equal to `startTime` isn't allowed: the end select leaves it out, and `sessionInstants` rejects it. So a timed session lasts under 24h, and anything longer is an all-day, multi-day session.
  - A new session defaults to today in the org's zone, all day, 1 day. This matches the old "date defaults to today".
  - Opening the edit form on a legacy off-quarter time snaps it, so the user sees the change before saving.
  - The picker always shows which zone it's in ("Times in Pacific/Auckland (NZDT)").
- **The sessions list** gets a **When** column (rendered with `formatSessionWhen`, sorted by `startsAt`). The default sort stays `updatedAt` desc, which is what the help card describes.
- **Changing the org's zone** doesn't re-anchor anything. The settings dialog warns that existing all-day sessions will start reading as timed.

## Tasks

### Review group A: data layer

- [x] **Task 1: Org time zone setting (schema)** — feat(settings): org time zone setting (general.timeZone)
  - **Files:** `src/lib/schemas/time-zone.ts` (new), `src/lib/schemas/user-settings.ts`, `src/lib/schemas/organization-settings.ts`, plus tests (`src/lib/schemas/time-zone.test.ts`, and extend `settings-schema.test.ts` or an org-settings test).
  - **Do:** Move `isValidTimeZone` into `time-zone.ts` and export `TimeZone.schema` (`z.string().refine(isValidTimeZone, "Unknown IANA time zone")`). Use it for `display.timeZone`. Add `general.timeZone: TimeZone.schema.default("Pacific/Auckland")` to `OrganizationSettings`. Don't add an object-level default to `general`.
  - **Done when:**
    - `OrganizationSettings.default().general.timeZone === "Pacific/Auckland"`.
    - Records holding only `general.publicDomain` resolve `timeZone = "Pacific/Auckland"` through `fromRecords`.
    - The `general` slice patch rejects an unknown zone.
    - Tests cover all three, and `npm run check` passes.

- [x] **Task 2: `src/lib/session-timing.ts`** — feat(skill-track): session timing helpers in the org's time zone
  - **Files:** `src/lib/session-timing.ts` (new), `src/lib/session-timing.test.ts` (new).
  - **Do:** Implement `sessionTiming`, `formatSessionWhen`, `sessionInstants`, `sessionFormState`, `snapToQuarter` and `isQuarterHour` as in Decisions. Use `TZDate` and `addDays` from `@date-fns/tz`/`date-fns`, as `src/lib/datetime.ts` does.
  - **Done when:** tests cover every row of #361's table, plus:
    - a multi-day all-day session across both NZ DST changes (first Sunday of April, last Sunday of September)
    - a timed session crossing midnight
    - `endsAt === null`
    - a legacy `endsAt === startsAt`
    - an all-day session viewed in a different zone (it still reads as all-day, because it's judged in the org's zone)
    - the zone abbreviation shown only when the zones differ, with exact strings ("NZDT")
    - `snapToQuarter` on `11:35:20.203` → `11:30` and on `17:55:31.162` → `18:00`
    - `sessionFormState` snapping both ends
    - `sessionInstants` returning strings that end in `Z`, and rejecting `endTime === startTime`
    - `sessionInstants` ∘ `sessionFormState` round-tripping, plus the spring-forward gap (a 02:15 start on the last Sunday of September), with whatever behaviour the code chooses asserted explicitly
  - Then `npm run check` passes.

- [x] **Task 3: Approved sessions are read-only (server)** — feat(skill-track): approved sessions are read-only
  - **Files:** `src/trpc/routers/skill-check-sessions-router.ts` (`updateSession`), `src/trpc/routers/skill-check-sessions-router.test.ts`, `src/modules/skill-track/components/update-session.tsx` (drop `dateLocked`).
  - **Do:**
    - `updateSession` calls `assertSessionUnlocked(existing)` before the `changes.length == 0` early return.
    - Every write runs in one `$transaction`: `lockUnapprovedSession`, the session update, the conditional `checkedAt` re-stamp, then `ctx.logEvent`, with `.catch(rethrowSessionLocked)`. The `!dateChanged` branch without a lock goes.
    - Update the procedure's JSDoc.
    - In the dialog, remove `dateLocked` and its field description. The server now refuses any edit of an approved session.
  - **Done when:**
    - The existing test that still edits an approved session's name and notes is **inverted**: it now expects CONFLICT.
    - A no-op update of an approved session is also refused.
    - An approval racing the update is refused (P2025 → locked).
    - `npm run check` passes.

- [x] **Task 4: Session API on `startsAt`/`endsAt`** — feat(skill-track): session API on startsAt/endsAt
  - **Files:**
    - `src/lib/schemas/skill-check-session.ts`
    - `src/trpc/routers/skill-check-sessions-router.ts`
    - `src/server/services/skill-checks.ts`
    - `src/client/skill-check-sessions-effects.ts`
    - the tests for those (`skill-check-sessions-router.test.ts`, `skill-check-sessions-effects.test.ts`)
    - minimal glue in `src/modules/skill-track/components/{create-session,update-session,session-content}.tsx`
    - comment wording in `prisma/schema.prisma` (`///` on `SkillCheckSession.startsAt`/`endsAt` and on `SkillCheck.checkedAt`; then `npx prisma generate`), `src/lib/schemas/skill-check.ts:57` and `src/trpc/routers/skill-checks-router.ts:381`
  - **Do:**
    - **Schema:** `schema`, `modifiableSchema`, `inputSchema` and `fromRecord` as in Decisions, using `isQuarterHour` from Task 2.
    - **`createSession`:** Takes `inputSchema` and writes `startsAt`/`endsAt` (`endsAt` may be null). Fix its stale `@param`s.
    - **`updateSession`:**
      - Takes `inputSchema` and diffs through `modifiableSchema.parse(existing)`.
      - `startChanged` compares against the raw stored `startsAt`, and only that triggers the `checkedAt` re-stamp.
      - Returns `startChanged`.
    - **Service:**
      - `lockUnapprovedSession`'s option becomes `expectedStartsAt: Date | null`.
      - `requireSessionAssessor` also returns the raw stored `startsAt`.
      - Update the doc comments on `lockUnapprovedSession`, `rethrowSessionChanged` and `sessionChangedError`.
    - **`setSessionSkillCheck`:** Stamps `checkedAt` from `session.startsAt` and locks with `expectedStartsAt: storedStartsAt`.
    - **Effects:** `startChanged` and `checkedAt: updated.startsAt`.
    - **UI glue, only enough to compile and save:**
      - The dialogs use `inputSchema` and keep the current `DatePicker`, mapped to `startsAt` with `endsAt: null`.
      - Create defaults to `startOfDay(new Date()).toISOString()`.
      - Update seeds `startsAt` with `snapToQuarter(session.startsAt)`.
      - `session-content.tsx` shows `formatDate(session.startsAt)`.
      - Task 7 replaces all of this.
  - **Done when:**
    - Router tests cover:
      - create with null and non-null `endsAt`
      - off-quarter and `end <= start` rejected on create and update
      - a time-only `startsAt` change re-stamps checks
      - an `endsAt`-only change doesn't
      - a legacy off-quarter session (with `endsAt === startsAt`) saved with a snapped start and a new name
      - **recording a check on a session whose stored `startsAt` is null succeeds**, stamping `checkedAt = createdAt`
    - The effects test covers `startChanged`.
    - `npm run check` passes.

_End of review group A._

### Review group B: UI (one visual checkpoint at the end)

- [ ] **Task 5: Org time zone on the organisation settings page**
  - **Files:**
    - `src/components/controls/time-zone-options.ts` (new, `timeZoneOptions()` moved from `src/modules/user-settings/components/update-timezone.tsx`)
    - `src/modules/user-settings/components/update-timezone.tsx`
    - `src/components/organization-settings/general-settings.tsx` (new card)
    - `src/components/organization-settings/update-time-zone.tsx` (new dialog)
    - `src/components/organization-settings/organization-settings-form.tsx` (a "General" section first, and its entry in `getOrganizationSettingsFormSections`)
    - `content/help/admin/organization.mdx`
  - **Do:**
    - The card follows `rubbish-bin-settings.tsx`: a `SettingRow` for "Time zone" showing the zone and today's offset.
    - The dialog follows `update-rubbish-bin.tsx` and `docs/patterns/mutation-dialog.md` (`?action=update-time-zone`), with a `SearchableSelect` like the user one. It saves `{ slice: "general", patch: { timeZone } }` through `useOrganizationSettingsMutation`.
    - The dialog says that session times are entered and shown in this zone, and warns that changing it makes existing all-day sessions read as timed.
    - Update the help card.
  - **Done when:** an admin can view and change the zone, a non-editor sees it read-only, and `npm run check` passes.
  - `visual`, `mechanical`

- [ ] **Task 6: Session page: Edit off for approved sessions**
  - **Files:** `src/modules/skill-track/components/session-menu.tsx`, `src/modules/skill-track/components/session-content.tsx`, `content/help/skill-track/session.mdx`.
  - **Do:**
    - The Edit action is `disabled` when `isApproved`, as Record already is on the session page. Replace the comment explaining why it wasn't.
    - Hide the Session Details card's edit trigger for an approved session.
    - The help card loses "Its name and notes stay editable", and says that approving locks everything until it's reopened.
  - **Done when:** an approved session offers no way to open the edit dialog, a Draft one does, and `npm run check` passes.
  - `visual`, `mechanical`

- [ ] **Task 7: Start/end picker in the create and update session dialogs**
  - **Files:**
    - `src/modules/skill-track/components/session-when-picker.tsx` (new)
    - `src/modules/skill-track/components/create-session.tsx`
    - `src/modules/skill-track/components/update-session.tsx`
    - `content/help/skill-track/sessions.mdx`
  - **Do:**
    - Build a controlled picker over the form state in Decisions:
      - a start date (the `Calendar` popover, as in `DatePicker`, but over a `yyyy-MM-dd` string rather than an instant)
      - an "All day" `Switch`
      - all day: a day count (1–14) with the derived end date shown
      - timed: start-time and end-time `Select`s in 15-minute steps, with the end optional ("No end time"), the start time left out of the end options, and labels in the viewer's `timeFormat`
      - a zone hint
    - Each dialog's form holds `{ name, notes, when: FormState }` and converts with `sessionInstants(when, orgZone)` on submit into an `inputSchema` payload.
    - The update dialog seeds `when` from `sessionFormState(...)`, which snaps legacy off-quarter times.
    - The create dialog defaults to today in the org's zone, all day.
    - Read `orgZone` from `useOrganization().settings.general.timeZone`.
    - Follow `docs/patterns/mutation-dialog.md` for everything else in the dialogs.
    - Update the sessions help card's "the date defaults to today" passage.
  - **Done when:**
    - Creating all-day (1 and 3 days), timed with end, timed without end, and timed across midnight each saves and reopens showing the same values.
    - Editing a legacy off-quarter session shows the snapped time.
    - `npm run check` passes.
  - `visual`

- [ ] **Task 8: Show session times on the detail page and the sessions list**
  - **Files:** `src/modules/skill-track/lib/use-format-session-when.ts` (new), `src/modules/skill-track/components/session-content.tsx`, `src/modules/skill-track/components/sessions-list.tsx`.
  - **Do:**
    - The hook binds `formatSessionWhen` to `useOrganization()`'s zone and `usePreferences()`'s `display` settings.
    - The Session Details "Date" row becomes "When".
    - The list gains a **When** column after Name, following `checks-list.tsx`'s `checkedAt` column: an accessor on `startsAt`, cell `formatSessionWhen`, sortable, not filterable. The default sort stays `updatedAt` desc.
  - **Done when:** both pages render the three shapes correctly for a viewer in the org's zone and in another zone, the column sorts chronologically, and `npm run check` passes.
  - `visual`, `mechanical`

_End of review group B. Visual checkpoint: the org settings General card, a Draft and an approved session page, the create and edit dialogs in each mode, and the sessions list._

## Before shipping

- Run #361's read-only data check against **production**: no sessions on org-local midnight, how many are off-quarter, and how many have a null `startsAt`/`endsAt`. The user runs it, or approves it. Nothing in this branch writes data, and null `startsAt` rows are handled either way.

## Docs impact

Sessions take a start and an optional end, or run all day across one or more days, in the org's time zone, and approved sessions can't be edited until they're reopened. This touches the Skill Track sessions guide and the organisation settings guide (new General → Time zone), with new screenshots of the New Session dialog, the session page, the sessions list and the org settings page.

## Out of scope

- Taking start and end times from a linked D4H exercise (#361 follow-up).
- A per-session time zone override.
- Re-anchoring existing sessions when the org's zone changes.
- Append-only notes or comments on approved sessions.
- Showing session times in reports, the competency matrix or check history. Those keep `checkedAt` (= `startsAt`) in the viewer's zone, so an all-day session's checks still show a day early to a viewer west of the org. Displaying them in the org's zone is a separate change.
- Timed sessions of 24h or more. Those are all-day sessions.

## Parked

- **Lost-race tests run on an already-approved session.** In `skill-check-sessions-router.test.ts`, the `guarded` loop of lost-race tests runs after the `approveSession` race test, which leaves `racedSession` at `Include` (prisma-mock runs the rest of a failed transaction). They still assert that the lock was called, but the session isn't Draft, so the pre-check may be what refuses. Give them their own Draft session, as Task 3 did for `updateSession` (`racedUpdate`).

## Review notes

- **Task 4, `updateSession` audit diff for a session with no stored start.** The diff currently runs against the parsed session, whose `startsAt` falls back to `createdAt`. As a result, a first save can log `prev = createdAt` instead of `null`, or log an `Update` with `changes: []` while the checks are re-stamped. Diff against the raw stored start instead: `{ ...SkillCheckSession.modifiableSchema.parse(existing), startsAt: record.startsAt?.toISOString() ?? null }`. Then drop the `!startChanged` special case from the early return, and assert the log entry's `startsAt null → value` change in the "writes the start of a session with none stored" test.
- **Task 2, `sessionInstants` doc comment.** In zones where DST starts at midnight (America/Santiago, Asia/Beirut), local midnight doesn't exist, so an all-day session there reads as timed. Note this in the comment. NZ isn't affected.
