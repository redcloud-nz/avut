# Spec: Person ↔ user linking

**Date:** 2026-09-14
**Status:** Draft

How a `Person` record gets attached to a `User` account. Today this is a manual
step buried on the user detail page; this spec adds an invite path from the
person side and two email-match automations, each gated by a new organization
setting.

Source idea: [`docs/ideas/2026-09-14-streamline-person-user-linking.md`](../ideas/2026-09-14-streamline-person-user-linking.md).
That idea's fourth part — offering membership at signup on an email match — is
**not** being built; see §9.

---

## 1. What exists today

The link is `OrganizationUser.personId` — nullable, `@unique`, `onDelete: SetNull`.

| Surface | File | Behaviour |
| --- | --- | --- |
| Manual link/unlink | `users.linkPerson` / `users.unlinkPerson` (`src/trpc/routers/users-router.ts:63,252`) | Admin picks a person from `personnel.listUnlinkedPersonnel` on the **user** detail page. The only way to create a link today. |
| Invite creation | `src/components/admin/invitations/create-invitation.tsx` | Calls `authClient.organization.inviteMember` directly — no tRPC, no audit entry. Email + roles only. |
| Invite accept | `organizationHooks.afterAcceptInvitation` (`src/server/auth.ts:130-145`) | **Already copies `invitation.personId` onto the new `OrganizationUser`.** Unguarded `updateMany`, no audit entry. |
| Person detail page | `src/components/admin/personnel/person-content.tsx` | Renders a read-only "Linked User Account" card when `personnel.getLinkedUser` returns a row. No action to create the link. |
| Person dropdown | `src/components/admin/personnel/person-menu.tsx` | Edit / Archive / Restore / Delete. |

Two facts verified against `node_modules/better-auth` (1.7.3) that the plan leans on:

- `createInvitation` spreads unknown body fields straight into the invitation row
  (`plugins/organization/routes/crud-invites.mjs:199-210`), and `personId` is declared
  `input: true` in `auth.ts`. **`authClient.organization.inviteMember({ …, personId })`
  works as-is** — Part 1 needs no new server code for the invite itself.
- The same route rejects an invite with `USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION`
  when a member already has that email (`crud-invites.mjs:124-127`). Part 1 must branch
  on this rather than always inviting.

---

## 2. Blocking defect: `OrganizationInvitation.personId @unique`

`personId` on the invitation table is globally `@unique` (`prisma/schema.prisma:255`), but
invitation rows are **never deleted** — `cancelPendingInvitationsOnReInvite: true` sets
`status: "canceled"` and keeps the row, and accepted invitations persist too.

So the *second* person-scoped invite for the same person — a re-invite, or an invite after
an unlink — hits a P2002 on a constraint the user cannot see or clear. Part 1 is unusable
until this is fixed.

The constraint people actually want is "at most one **pending** invitation per person",
which is a partial unique index and not expressible in the Prisma schema. Therefore:

> **Drop `@unique` from `OrganizationInvitation.personId`; replace it with `@@index([personId])`.**
> "One pending invite per person" is enforced in application code, riding on better-auth's
> existing one-pending-invitation-per-email-per-org guarantee.

This is a migration, so the branch must `npm run db:branch person-user-linking` first and
ask before `migrate dev`. (Fallback if we want to avoid a migration: before inviting,
null out `personId` on any non-pending invitation for that person. Uglier, leaves the
constraint as a trap for the next caller — not recommended.)

---

## 3. Shared foundation

### 3.1 The matching rule, defined once

A person is **linkable** to a user when *all* of:

1. Same organization.
2. `Person.status === "Active"`.
3. their email addresses match, compared case-insensitively.
4. `Person.organizationUser` is `null` — the person is not already linked.
5. That user's `OrganizationUser` for the org has `personId === null` — the user is not
   already linked to a different person there.

**Rule 3 is never implemented with `mode: "insensitive"`** (revised while building Parts 1
and 3; the original draft said to use it). `prisma-mock` ignores the `{ equals: … }` filter
object on a string field entirely — not just the `mode` key — so a query written that way
returns `null` in every test while working in Postgres. That is a silent gap, not a failing
test. How rule 3 is satisfied therefore depends on which side is the column:

| Direction | Implementation | Why |
| --- | --- | --- |
| user email → **person** (`findLinkablePerson`) | narrow to org + `Active` + unlinked in SQL, fold case in JS | `Person.email` is admin-typed and unnormalised, so the **column** may be mixed case. There is no functional index on `lower(personnel.email)`, so Postgres would scan that candidate set either way — the JS fold costs nothing extra and is testable. |
| person email → **user** (`findLinkableMember`, `getInviteState`) | lowercase the needle, match the column exactly | `User.email` is lowercase by construction: better-auth normalises it at sign-up (`api/routes/sign-up.mjs:165`) and in the OAuth link path (`oauth2/link-account.mjs:92`), which then compares `userInfo.email.toLowerCase()` against the stored value. An exact match also uses the unique index on `users.email`. |

The pre-existing `getPersonByEmail` (`personnel-router.ts`) still uses `mode: "insensitive"`
for the first direction and is therefore not unit-testable. Normalising `Person.email` at
write time would collapse both rows into one index-backed exact match, and remains **out of
scope** (see §8).

Rules 4 and 5 are also the two `@unique` constraints, so violating them is a P2002 rather
than a silent overwrite. Every automation below checks them explicitly and **no-ops** on
failure — an automation never steals an existing link and never surfaces an error to a user
who did not ask for the link.

### 3.2 New module: `src/server/person-user-link.ts`

Not `server-only`, Prisma injected by the caller — same rationale as
`organization-settings-store.ts`, so it is exercisable from the jsdom test environment
against `createMockPrisma()`.

```ts
export type PersonUserLinkPrisma = Pick<PrismaClient, "person" | "organizationUser" | "user">;

/** The Active, unlinked person in `organizationId` whose email matches a user's, or null. */
export function findLinkablePerson(
  prisma: PersonUserLinkPrisma,
  args: { organizationId: string; email: string },
): Promise<Person | null>;

/**
 * The opposite direction, for Part 3: the existing **member** of `organizationId` whose email
 * matches a person's and who is not already linked. A user who is not a member is never
 * returned — linking them would mean granting membership on an email match.
 */
export function findLinkableMember(
  prisma: PersonUserLinkPrisma,
  args: { organizationId: string; email: string },
): Promise<{ user: User; organizationUserId: string } | null>;

/**
 * Set `OrganizationUser.personId`, but only while both sides are still unlinked.
 * Returns the membership id it wrote, or null if nothing was written.
 */
export function tryLinkPersonToMember(
  prisma: PersonUserLinkPrisma,
  args: { organizationId: string; userId: string; personId: string },
): Promise<string | null>;
```

`tryLinkPersonToMember` re-reads both sides rather than trusting the caller, then writes with
`updateMany({ where: { id, personId: null }, data: { personId } })` and treats `count === 0`
as "already linked, do nothing" — so a manual link landing in between wins the race instead
of raising P2002 from inside an unattended hook. It returns the membership id rather than a
boolean because the caller needs it as the audit entry's `objectId`.

### 3.3 Settings

Add a top-level `personnel` group to `organizationSettingsSchema`
(`src/lib/schemas/organization-settings.ts`) — personnel lives under the always-on `admin`
module, so it is not a `modules.*` key:

```ts
personnel: z.object({
    autoLinkOnInviteAccept: z.boolean().default(false),
    autoLinkOnPersonCreate: z.boolean().default(false),
}),
```

- Add `personnel: {}` to `OrganizationSettings.default()`. `flatten`/`fromRecords` are
  generic over the schema, so the store and the audit diff need no change.
- New `Personnel_SettingsCard` (`src/components/admin-settings/personnel-card.tsx`),
  modelled on `email-integration-card.tsx`: two `<Switch>` fields, own sub-form, own save
  button, `useOrganizationSettingsMutation`. Slot it into `OrganizationSettingsForm` in a
  new "Personnel" section between General and Integrations.
- **Both default to `false`** so no existing organization changes behaviour on deploy.

### 3.4 Audit logging

Every automatic link is a state change on `OrganizationMembership` and gets an entry. Both
automations have a real human actor, so **no `LogBatch` is needed** (the idea file guessed
otherwise):

| Automation | Actor | Written via |
| --- | --- | --- |
| Part 2 — invite accept | the accepting user | `recordLogEntry` directly (the better-auth hook is outside any tRPC procedure) |
| Part 3 — person create | the admin creating the person | `ctx.logEvent` inside the existing `$transaction` |

Entries use `action: "Update"`, `objectType: "OrganizationMembership"`, `objectId` the
`OrganizationUser.id`, and a description naming the person and the trigger, e.g.
`Linked person (pQ3…, Dana Reed) to user (u7K…) automatically on invitation accept.`
Direct `recordLogEntry` calls are the sanctioned path — the prohibition in `AGENTS.md` is
on hand-rolled `prisma.logEntry.create`, which this is not.

The D4H-import path (§6) passes its `batchId` through, so import-triggered links join the
import's batch.

---

## 4. Part 1 — Invite a person from their own page

**Goal:** an admin looking at a person record can get that person a user account without
leaving the page or retyping the email.

### Behaviour

A new **"Invite to AVUT"** action in `AdminModule_PersonMenu`, shown only when
`personnel.getLinkedUser` is `null`, gated on `{ invitation: ["create"] }`. It opens a
`?action=invite` dialog (Recipe A of `docs/patterns/mutation-dialog.md`) prefilled with the
person's email (read-only) and the same primary/secondary role controls as
`create-invitation.tsx`.

On submit the dialog branches on a new query, `personnel.getInviteState`:

| State | Dialog shows | Action |
| --- | --- | --- |
| No user account with that email | Normal invite form | `authClient.organization.inviteMember({ email, role, organizationId, personId, resend: false })` |
| User exists, **already a member** of this org | "Dana already has an account in this organization" + a **Link** button, roles hidden | `users.linkPerson({ userId, personId })` — the existing mutation, no invitation |
| User exists, not a member | Normal invite form, note that they already have an AVUT account | invite as above |
| Person already linked | Action not offered | — |

The middle row is required, not a nicety: better-auth rejects the invite outright in that
case (§1), and linking is what the admin actually wanted.

### Work

- `prisma/schema.prisma` — the §2 constraint change + migration.
- `personnel.getInviteState` — new `organizationProcedure({ invitation: ["view"], member: ["view"], person: ["view"] })` query returning
  `{ state: "Linked" | "AlreadyMember" | "UserExists" | "NoUser"; user; pendingInvitation }`.
  A flat object rather than a discriminated union, so the dialog can show the pending-invitation
  warning alongside any state. Alphabetical position: before `getLinkedUser`.
- `src/components/admin/personnel/invite-person.tsx` — the dialog.
- `person-menu.tsx` — the action, `["update", "delete", "invite"]` added to the
  `parseAsStringLiteral` literal, `useHasPermission({ invitation: ["create"] })`.
- `personnelEffects` — invalidate `getInviteState` and `getLinkedUser` after linking;
  invalidate the better-auth invitations query key used by `invitations-list.tsx`.

No change to the accept side — `afterAcceptInvitation` already applies `personId`.

---

## 5. Part 2 — Auto-link on invitation accept

**Goal:** an invitation sent the ordinary way (from the Invitations page, with no person
attached) still links up if the org already has a person with that email.

### Behaviour

In `afterAcceptInvitation`, after the existing `invitation.personId` branch:

1. If `invitation.personId` was set, the explicit link already happened — stop.
2. Otherwise, read the org's settings; if `personnel.autoLinkOnInviteAccept` is off, stop.
3. `findLinkablePerson(prisma, { organizationId, email: user.email })`; if null, stop.
4. `tryLinkPersonToMember(...)`; on success write the audit entry.

### Work — **done**

- All of it lives in `linkPersonOnInvitationAccept` (`src/server/person-user-link.ts`); the
  hook in `src/server/auth.ts` is a call site. Keeping the logic out of `auth.ts` is what
  makes it testable — that module imports `server-only` transitively.
- The explicit-`personId` branch moved onto `tryLinkPersonToMember` too, which fixes its
  unguarded `updateMany` (today it throws P2002 if that person is already linked to someone
  else) and gives it the audit entry it never had.
- Keep the existing `revalidateOrganizationUser(user.id)` call, unconditional.

Three decisions that were not in the original draft:

- **Settings are read uncached** (`readOrganizationSettings`, not `getOrganizationSettings`).
  An admin who turns the switch on and immediately has someone accept should get the new
  behaviour, and a `"use cache"` read inside a POST handler is a needless risk for a query
  that runs once per accepted invitation.
- **The link and its audit entry share one interactive transaction**, so the entry can never
  claim a link that did not happen. That matters more here than in a tRPC procedure, because
  `tryLinkPersonToMember` is *allowed* to write nothing when it loses a race —
  `$transaction([...])` would commit the entry regardless. (`prisma-mock` supports the
  callback form, so this stays testable.)
- **The hook never fails the accept.** The membership is already committed by the time it
  runs, so a linking failure is logged and swallowed rather than thrown — otherwise the user
  sees an error for an invitation that did in fact work.

---

## 6. Part 3 — Auto-link on person create

**Goal:** adding a person for someone who already has an account in the org links them
immediately.

### Behaviour

Inside the shared `createPerson` helper (`personnel-router.ts:414`), after the person row
is written: if `personnel.autoLinkOnPersonCreate` is on, look for an `OrganizationUser` in
this org whose user's email matches the new person's, case-insensitively, and whose
`personId` is null — and link it.

**Membership is never granted.** A user who exists but is not a member of the org is left
alone; they still need Part 1's invite. This is the decision from intake and is what keeps
an email match from being an authorisation decision.

### Work

- `createPerson` gains the link step and a second `ctx.logEvent`, both inside the existing
  `$transaction([...])`, with the `batchId` passed through.
- **`personnel.createPerson` (the procedure at `personnel-router.ts:74`) currently duplicates
  the helper's body instead of calling it.** Collapse it onto `createPerson(ctx, personId, create)`
  so the new behaviour exists in one place — otherwise manual creation and D4H import diverge.
  The procedure keeps its own email-conflict pre-check.
- `teams-router.d4h.ts:357` needs no change; it already calls the helper, so a D4H team
  import auto-links as a side effect and its entries join the import batch.
- `personnelEffects.createPerson` — also invalidate `users.listPersonLinks` and
  `personnel.getLinkedUser`.

### Explicit non-goal

`updatePerson` changing an email does **not** trigger a link. An email edit is usually a
correction, and silently binding an account to it is surprising. Revisit only if asked.

---

## 7. Conflict matrix

Every row is a no-op-and-move-on, never an error shown to an end user.

| Situation | Result |
| --- | --- |
| Person already linked to another user | Automation skips. Part 1 does not offer the action. |
| User already linked to a different person in the org | Automation skips. Part 1's link button reports the conflict (`users.linkPerson` already throws `CONFLICT`). |
| Two people in one org with the same email | Impossible — `Person @@unique([organizationId, email])`. |
| Emails differ only in case | Treated as a match (§3.1). |
| Person is Archived or Deleted | Not linkable. |
| Invite to a person whose user is already a member | Part 1 links instead of inviting (§4). |
| Re-invite the same person | Works once §2 lands; before that it is a P2002. |
| Race: manual link lands between read and write | `updateMany … where personId: null` returns 0; automation skips. |
| Person deleted after linking | `onDelete: SetNull` already clears `OrganizationUser.personId`. |

---

## 8. Out of scope

- **Membership offers at signup (the idea's part 4).** Dropped as disproportionate: it
  needs a third list on `EntryControl`, new org-selector UI, and an `authenticatedProcedure`
  that grants membership to a non-member — the only place in this design where an email
  match becomes an authorisation decision, and so the only place carrying real security
  weight. Parts 1–3 cover the common cases; someone who signs up without an invite still
  gets linked the moment an admin invites them (Part 1) or the org's data catches up
  (Part 2). Revisit if orgs actually ask for self-service joining.
- Normalising `Person.email` at write time — now specced separately in
  [`person-email-normalisation.md`](person-email-normalisation.md), which also records that
  the `@@unique([organizationId, email])` invariant is currently false. Landing it collapses
  §3.1's two-row strategy table to a single rule and removes `findLinkablePerson`'s scan.
  `User.email` needs nothing; better-auth already normalises it.
- Auto-linking on `updatePerson` (§6).
- Bulk "link all matching" admin action.
- Auditing invitation creation. No `OrganizationInvitation` value exists in `LogObjectType`
  and Part 1 does not add one — invitations remain unlogged, as they are today.

### Unrelated bug noticed while reading

`OrgSelector_Card` (`src/components/cards/org-selector.tsx`) renders each pending
invitation as `<Item asChild>` wrapping three children and with no link, so those rows
render wrong and do nothing when clicked. Not touched by this spec; worth its own fix.

---

## 9. Testing

`src/server/person-user-link.test.ts` against `createMockPrisma()` — the matching rule
(§3.1) row by row, and `tryLinkPersonToMember`'s no-op on a lost race.

**Confirmed during Part 1:** `prisma-mock` does not implement `mode: "insensitive"` — and in
fact ignores the whole `{ equals: … }` filter object on a string field, matching only the
bare-scalar shorthand. A query written either way returns `null` in tests while working in
Postgres, which is worse than a plain failure. §3.1's lowercase-the-needle rule exists partly
to keep these paths testable.

Router tests live in `personnel-router.test.ts` — `getInviteState`'s four states plus the
mixed-case and pending-invitation cases (**done**); later, `createPerson` links / does not
link across the setting and the member-vs-non-member cases.

**Done so far:** `src/server/person-user-link.test.ts` (16 cases covering both lookups and
every no-op branch of the linker) and a `personnel` round-trip case in
`organization-settings-store.test.ts` that also pins both switches defaulting off.

The end-to-end path Part 1 serves is not reachable from unit tests at all — see
[`docs/plans/person-user-linking-testing.md`](../plans/person-user-linking-testing.md).

`auth.ts`'s hook is not directly testable (it imports `server-only` transitively), which is
the argument for keeping its logic entirely in `person-user-link.ts` and leaving the hook as
a four-line call site.

---

## 10. Implementation order

| Phase | Contents | Notes |
| --- | --- | --- |
| 0 | `db:branch person-user-linking`; §2 schema change + migration ✅ | Needs explicit go-ahead before `migrate dev` |
| 1 | `person-user-link.ts` + tests; `personnel` settings group; `Personnel_SettingsCard` ✅ | No behaviour change yet — both switches default off |
| 2 | **Part 1** — `getInviteState`, invite dialog, menu action ✅ | Independently shippable and the highest-value piece |
| 3 | **Part 2** — rewrite `afterAcceptInvitation` ✅ | Also fixes the unguarded `updateMany` and adds its missing audit entry |
| 4 | **Part 3** — `createPerson` helper; collapse the duplicated procedure body | Gives D4H import auto-linking for free |

Phases 2–4 are independent of each other once 0 and 1 land, so they can be separate PRs.

---

## 11. Decisions

| Question | Decision |
| --- | --- |
| Does an email match ever grant membership? | **No.** Parts 2 and 3 only fill in a link on a membership that already exists. |
| Part 3, user exists but is not a member | Do nothing. Invite via Part 1. |
| Membership offers at signup | **Dropped** — complexity out of proportion to the benefit (§8). |
| Default setting values | Both `false`. |
| Email comparison | Lowercase the needle, match the column exactly (§3.1). No column normalisation. |
| `getInviteState` output shape | Flat `{ state, user, pendingInvitation }`, not a discriminated union. |
| `OrganizationInvitation.personId @unique` | Dropped, replaced by a plain index (§2). |
| Audit batching | None — both automations have a human actor. D4H-import links join the import's existing batch. |
| Does the explicit `personId` path check the setting? | No. An invitation sent from a person's record is an admin's decision, not an automation. |
| Settings read for Part 2 | Uncached, so a just-flipped switch takes effect immediately. |
| Link + audit atomicity | One interactive transaction — the write is conditional, so an array transaction would log a link that may not have happened. |
| A linking failure on accept | Logged and swallowed. The membership is already committed; failing the accept would misreport a working invitation. |
| Invitation creation audit entries | Still none, unchanged from today. |
