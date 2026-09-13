# Spec: Person ↔ user linking

**Date:** 2026-09-14
**Status:** Draft

How a `Person` record gets attached to a `User` account. Today this is a manual
step buried on the user detail page; this spec adds an invite path from the
person side and three email-match automations, each gated by a new
organization setting.

Source idea: [`docs/ideas/2026-09-14-streamline-person-user-linking.md`](../ideas/2026-09-14-streamline-person-user-linking.md).

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
| Entry screen | `getEntryControl` (`src/server/entry-control.ts`) + `OrgSelector_Card` | Lists memberships and pending invitations at `/orgs/--select-org`. |

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
3. `Person.email` equals `User.email`, compared case-insensitively.
4. `Person.organizationUser` is `null` — the person is not already linked.
5. That user's `OrganizationUser` for the org has `personId === null` — the user is not
   already linked to a different person there.

Rule 3 uses `{ equals: email, mode: "insensitive" }`, matching the existing
`getPersonByEmail` (`personnel-router.ts:466`). Neither `Person.email` nor `User.email` is
normalised at write time; normalising the columns is a separate change and **out of scope**
(see §9).

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

/** The Active, unlinked person in `organizationId` whose email matches, or null. */
export function findLinkablePerson(
  prisma: PersonUserLinkPrisma,
  args: { organizationId: string; email: string },
): Promise<Person | null>;

/** The orgs where `email` matches a linkable person. Powers Part 4. */
export function findLinkableOrganizations(
  prisma: PersonUserLinkPrisma,
  args: { email: string },
): Promise<{ organization: Organization; person: Person }[]>;

/**
 * Set `OrganizationUser.personId`, but only if that row is still unlinked and the person
 * is still unlinked. Returns whether the link was made; never throws on a lost race.
 */
export function tryLinkPersonToMember(
  prisma: PersonUserLinkPrisma,
  args: { organizationId: string; userId: string; personId: string },
): Promise<boolean>;
```

`tryLinkPersonToMember` writes with `updateMany({ where: { …, personId: null }, data: { personId } })`
and treats `count === 0` as "already linked, do nothing", so a concurrent manual link wins
rather than erroring.

### 3.3 Settings

Add a top-level `personnel` group to `organizationSettingsSchema`
(`src/lib/schemas/organization-settings.ts`) — personnel lives under the always-on `admin`
module, so it is not a `modules.*` key:

```ts
personnel: z.object({
    autoLinkOnInviteAccept: z.boolean().default(false),
    autoLinkOnPersonCreate: z.boolean().default(false),
    offerMembershipOnEmailMatch: z.boolean().default(false),
}),
```

- Add `personnel: {}` to `OrganizationSettings.default()`. `flatten`/`fromRecords` are
  generic over the schema, so the store and the audit diff need no change.
- New `Personnel_SettingsCard` (`src/components/admin-settings/personnel-card.tsx`),
  modelled on `email-integration-card.tsx`: three `<Switch>` fields, own sub-form, own save
  button, `useOrganizationSettingsMutation`. Slot it into `OrganizationSettingsForm` in a
  new "Personnel" section between General and Integrations.
- **All three default to `false`** so no existing organization changes behaviour on deploy.

### 3.4 Audit logging

Every automatic link is a state change on `OrganizationMembership` and gets an entry. All
three automations have a real human actor, so **no `LogBatch` is needed** (the idea file
guessed otherwise):

| Automation | Actor | Written via |
| --- | --- | --- |
| Part 2 — invite accept | the accepting user | `recordLogEntry` directly (the better-auth hook is outside any tRPC procedure) |
| Part 3 — person create | the admin creating the person | `ctx.logEvent` inside the existing `$transaction` |
| Part 4 — offer accepted | the accepting user | `recordLogEntry` directly (see §7.3) |

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
  `{ kind: "no-user" } | { kind: "member"; userId } | { kind: "user-not-member"; userId } | { kind: "linked" }`.
  Alphabetical position: between `getLinkedUser` and `getPerson`.
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

### Work

- Rewrite the hook body in `src/server/auth.ts` to call the §3.2 helpers. The existing
  explicit-`personId` branch also moves onto `tryLinkPersonToMember`, which fixes its
  current unguarded `updateMany` (today it will throw P2002 if that person is already
  linked to someone else) and gives it the audit entry it never had.
- Keep the existing `revalidateOrganizationUser(user.id)` call, unconditional.
- Settings are read with `getOrganizationSettings(organizationId)` (cached).

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
alone; they still need Part 1's invite (or Part 4's offer). This is the decision from
intake and is what keeps an email match from being an authorisation decision.

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

## 7. Part 4 — Standing join offers

**Goal:** someone signs up (or signs in) and is offered membership of an organization that
already has a person record with their email.

### 7.1 Why not a fabricated invitation

The obvious implementation — write an `OrganizationInvitation` at signup and let the
existing accept flow do the rest — fails on two counts: `inviterId` is a required FK with
no honest value, and `sendInvitationEmail` would fire a "someone invited you" email that
nobody sent. Instead the offer is **computed on read**, and accepting it is its own
mutation.

A consequence worth naming: this makes offers *standing*, not signup-only. A user who
signed up last year sees the offer the next time they hit the org selector, once the org
turns the setting on. That is a superset of the requested behaviour and simpler than
pinning it to the signup moment.

### 7.2 Surfacing

Extend `EntryControlSelect.data` with a third list:

```ts
offers: { organization: OrganizationData; personName: string }[];
```

`getEntryControl` populates it from `findLinkableOrganizations(prisma, { email: session.user.email })`,
filtered to orgs with `personnel.offerMembershipOnEmailMatch` on and excluding orgs the
user already belongs to or has a pending invitation for.

`OrgSelector_Card` renders a "Join an organization" section below Pending Invitations:
*"<Org> has a personnel record for <name> with your email address."* plus an **Accept** button.
The section is absent when `offers` is empty, so nothing changes for the common case.

> While here, fix the adjacent bug: the Pending Invitations `<Item asChild>` block wraps
> multiple children and has no link, so those rows render wrong and do nothing.

### 7.3 Accepting

New `organizations.acceptMembershipOffer` — **`authenticatedProcedure`**, because the caller
is by definition not yet a member and `organizationProcedure` would reject them. It takes
`{ organizationId }` and re-derives everything server-side; the client sends no person id
and no role.

Guards, all re-checked inside the mutation (the read that produced the offer is not trusted):

1. The org's `personnel.offerMembershipOnEmailMatch` is on.
2. `findLinkablePerson(prisma, { organizationId, email: ctx.user.email })` returns a person.
3. The caller's email is verified (`user.emailVerified`) — otherwise an unverified signup
   with someone else's address could self-join.
4. The caller has no existing `OrganizationUser` for that org.

Then, in one `$transaction`: create the `OrganizationUser` with `role: "member"` and
`personId` set (the `addOrganizationMember` shape at `system-admin-router.ts:122-140`), plus
two log entries — `Create` on `OrganizationMembership` and the link description. Afterwards
`revalidateOrganizationUser(ctx.userId)`.

Because this is an `authenticatedProcedure`, `ctx.logEvent` would file the entry under the
user's own timeline; the event belongs to the organization. Write it with `recordLogEntry`
directly, `scope: "organization"`, actor = the calling user. **If a second case like this
appears, give `authenticatedProcedure`'s `logEvent` an optional organization arm instead of
repeating this.**

### 7.4 Accepted tradeoff

The offer tells the user that a named organization holds a person record with their email.
That organization put the address there, and the behaviour is off by default and org
opt-in, so this is acceptable. It is the reason the setting exists rather than the feature
being unconditional.

---

## 8. Conflict matrix

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

## 9. Out of scope

- Normalising `Person.email` / `User.email` at write time (or a citext column). The
  case-insensitive query is the whole mitigation here.
- Auto-linking on `updatePerson` (§6).
- A per-person opt-in flag for Part 4 — ruled out at intake in favour of the org setting alone.
- Bulk "link all matching" admin action. Falls out cheaply from `findLinkableOrganizations`
  if wanted later.
- Auditing invitation creation. No `OrganizationInvitation` value exists in `LogObjectType`
  and Part 1 does not add one — invitations remain unlogged, as they are today.

---

## 10. Testing

`src/server/person-user-link.test.ts` against `createMockPrisma()` — the matching rule
(§3.1) row by row, and `tryLinkPersonToMember`'s no-op on a lost race.

**Risk:** `prisma-mock` may not implement `mode: "insensitive"`. Check this first; if it
does not, the helper takes a small comparison seam the tests can exercise, rather than the
tests silently passing on an exact match.

Router tests extend the existing files:

- `personnel-router.test.ts` — `createPerson` links / does not link across the setting and
  the member-vs-non-member cases; `getInviteState`'s four results.
- A new `organizations-router` test for `acceptMembershipOffer`, one test per guard in §7.3
  — especially the unverified-email and already-a-member rejections.

`auth.ts`'s hook is not directly testable (it imports `server-only` transitively), which is
the argument for keeping its logic entirely in `person-user-link.ts` and leaving the hook as
a four-line call site.

---

## 11. Implementation order

| Phase | Contents | Notes |
| --- | --- | --- |
| 0 | `db:branch person-user-linking`; §2 schema change + migration | Needs explicit go-ahead before `migrate dev` |
| 1 | `person-user-link.ts` + tests; `personnel` settings group; `Personnel_SettingsCard` | No behaviour change yet — all switches default off |
| 2 | **Part 1** — `getInviteState`, invite dialog, menu action | Independently shippable and the highest-value piece |
| 3 | **Part 2** — rewrite `afterAcceptInvitation` | Also fixes the unguarded `updateMany` and adds its missing audit entry |
| 4 | **Part 3** — `createPerson` helper; collapse the duplicated procedure body | Gives D4H import auto-linking for free |
| 5 | **Part 4** — `EntryControl.offers`, selector UI, `acceptMembershipOffer` | Largest and most security-sensitive; do it last |

Phases 2–5 are independent of each other once 0 and 1 land, so they can be separate PRs.

---

## 12. Decisions

| Question | Decision |
| --- | --- |
| Does an email match ever grant membership? | **No** — except when the user themselves accepts an offer (Part 4). Parts 2 and 3 only fill in a link on a membership that already exists. |
| Part 3, user exists but is not a member | Do nothing. Invite via Part 1, or let Part 4 offer it. |
| Part 4 trust model | Org-level setting only; no per-person flag. Email must be verified. |
| Part 4 mechanism | Computed offers, not fabricated invitations (§7.1). |
| Default setting values | All three `false`. |
| Role granted by Part 4 | `member`, matching the column default. Not configurable for now. |
| Email comparison | Case-insensitive query; no column normalisation. |
| `OrganizationInvitation.personId @unique` | Dropped, replaced by a plain index (§2). |
| Audit batching | None — all three automations have a human actor. D4H-import links join the import's existing batch. |
| Invitation creation audit entries | Still none, unchanged from today. |
