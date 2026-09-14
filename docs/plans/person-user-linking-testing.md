# Testing plan: person ↔ user linking

**Date:** 2026-09-14
**Covers:** [`docs/specs/person-user-linking.md`](../specs/person-user-linking.md) Part 1
(invite a person from their own record) and the §2 constraint fix.
**Branch:** `feat/person-user-linking`, worktree `.claude/worktrees/person-user-linking`.

Part 1 is committed with unit coverage of `personnel.getInviteState`, but **the end-to-end
path it exists to serve has never been run** — nobody has watched an invitation created from
a person record actually arrive, be accepted, and produce a link. §A is that gap; everything
else is the surrounding surface.

| # | Area | Automated today | Needs a human/browser |
| --- | --- | --- | --- |
| A | Invite → accept → link, end to end | ✗ | **yes — the headline gap** |
| B | The four `getInviteState` states in the dialog | ✓ (router only) | yes (rendering) |
| C | Invitations page after the role-fields refactor | ✗ | yes |
| D | Re-invite (the dropped unique constraint) | ✗ (proven in SQL only) | yes |
| E | Permission gating | ✗ | yes |

---

## 0. Setup

**The dev server must run from this worktree.** `.env.local` here points at the branch
database `avut_person_user_linking`; the main checkout still points at shared `avut`, which
does **not** have the migration. A dev server started in the wrong directory will fail on
`organization_invitations_personId_idx` or silently exercise the old constraint.

```bash
cd .claude/worktrees/person-user-linking
npm run dev -- -p 3100          # 3000/3001 belong to the main checkout
```

Confirm the target database before anything else:

```bash
grep POSTGRES_DATABASE .env.local     # expect avut_person_user_linking
```

A psql shell against that database, used throughout below:

```bash
url="$(sed -nE 's/^POSTGRES_URL_NON_POOLING="?([^"]+)"?.*/\1/p' .env.local)"
psql "$url" -c '\d organization_invitations'   # personId should be an index, not a unique
```

Signing in follows [`.claude/skills/avut-test-in-browser`](../../.claude/skills/avut-test-in-browser/SKILL.md):
`window.avut.signIn(...)` with the admin test account, then `impersonateUser` to change
identity. You need an account with `owner` or `admin` in the target org — those are the only
roles holding `invitation: ["create"]`.

---

## A. Invite → accept → link (the unverified path)

This is the whole point of Part 1: the invitation carries `personId`, and
`organizationHooks.afterAcceptInvitation` (`src/server/auth.ts`) copies it onto the new
membership. Both halves are believed correct from reading better-auth's
`crud-invites.mjs` — that it spreads unknown body fields into the row — but neither has been
observed.

### A1. The invitation is created and carries `personId`

**Precondition:** a person in the org with **no** AVUT account. Find or make one:

```sql
SELECT p.id, p.name, p.email
FROM personnel p
LEFT JOIN organization_users ou ON ou."personId" = p.id
LEFT JOIN users u ON lower(u.email) = lower(p.email)
WHERE p.status = 'Active' AND ou.id IS NULL AND u.id IS NULL
LIMIT 5;
```

**Steps**

1. Open `/orgs/<slug>/admin/personnel/<person_id>`.
2. Open the ⋮ menu. Expect **Invite to AVUT** present, above Archive.
3. Select it. The dialog should read *Invite to AVUT*, name the person's email, and show
   the primary-role radios (Owner/Admin/Member, defaulting to Member).
4. Leave Member selected, press **Send Invitation**.

**Expect:** success toast, dialog closes.

**Verify — this is the assertion that matters:**

```sql
SELECT id, email, role, status, "personId"
FROM organization_invitations
WHERE "personId" = '<person_id>' AND status = 'pending';
```

`personId` must be **non-null and equal to the person's id**. A null here means better-auth
dropped the additional field and the whole feature is inert — everything downstream would
still "work" while silently producing no link.

Also check the stored `email` is **lowercase**, even if the person record is mixed-case.

### A2. Accepting the invitation creates the link

Don't wait for the email — take the invitation id from A1 and hit the accept route directly,
which is what the email's link does anyway.

**Steps**

1. In the browser, navigate to `/auth/accept-invitation/<invitation_id>`.
   - It signs out any current session, sets the `avut.invitation_to_accept` cookie, and
     redirects to `/auth/sign-up?email=…` (no account) or `/auth/sign-in?email=…` (account
     exists). Confirm the email is pre-filled.
2. Complete sign-up. Email verification is required (`requireEmailVerification: true`), and
   the OTP is **not** printed to the console — only "Sending verification OTP". Read it from
   the database (`storeOTP` is unset in `auth.ts`, so better-auth stores it in plain text):

   ```sql
   SELECT identifier, split_part(value, ':', 1) AS otp, "expiresAt"
   FROM user_verification ORDER BY "createdAt" DESC LIMIT 5;
   ```

   The stored `value` is `<otp>:<attempt-count>` — type only the part before the colon.
3. After verification the app lands on `/auth/post-sign-in`, which accepts the pending
   invitation, then redirects.

**Verify:**

```sql
SELECT ou.id, ou."userId", ou."personId", ou.role, u.email
FROM organization_users ou JOIN users u ON u.id = ou."userId"
WHERE ou."personId" = '<person_id>';
```

One row, `personId` set, `role` = what was chosen in A1.

4. Reload `/orgs/<slug>/admin/personnel/<person_id>`. The **Linked User Account** card
   should now render, and **Invite to AVUT** should be gone from the ⋮ menu.

### A3. Mixed-case email survives the round trip

The reason the dialog lowercases the address: `getEntryControl` looks invitations up by the
session user's (lowercase) email, so an invitation stored mixed-case is invisible to its
recipient.

**Steps:** pick (or edit) a person whose email has capitals — `Dana.Reed@Example.com`.
Invite them, then sign up as `dana.reed@example.com`.

**Expect:** the invitation still appears and is accepted; `personId` lands on the membership.
Before this change the invitation row would have been stored mixed-case and the pending-
invitation lookup in `getEntryControl` would have missed it.

---

## B. The dialog's four states

Router-level behaviour is covered by `src/trpc/routers/personnel-router.test.ts`. What is
untested is that each state renders the right controls.

| State | How to set it up | Expect in the dialog |
| --- | --- | --- |
| `NoUser` | Person with no matching account (A1) | Title *Invite to AVUT*, role fields, **Send Invitation** |
| `UserExists` | Person whose email matches a user who is **not** a member of this org | Same, plus the note *"They already have an AVUT account but are not a member of this organization yet."* |
| `AlreadyMember` | Person whose email matches a user who **is** already a member here | Title *Link User Account*, **no role fields**, button **Link Account** |
| `Linked` | Already-linked person | Menu item absent; dialog not reachable |

`AlreadyMember` is the one worth care — it exists because better-auth rejects the invite in
that case. Verify pressing **Link Account** writes `organization_users.personId` and that the
Linked User Account card appears without a page reload (the mutation's cache effects).

Find an `AlreadyMember` candidate:

```sql
SELECT p.id AS person, p.email, ou."userId"
FROM personnel p
JOIN users u ON lower(u.email) = lower(p.email)
JOIN organization_users ou ON ou."userId" = u.id AND ou."organizationId" = p."organizationId"
WHERE ou."personId" IS NULL AND p.status = 'Active'
LIMIT 5;
```

**Pending-invitation warning:** invite a person (A1), reopen the dialog without accepting.
Expect *"An invitation is already pending (sent …). Sending a new one replaces it."*

---

## C. Regression — the Invitations page

`create-invitation.tsx` was refactored onto the shared `InvitationRoleFields`. It is the only
behaviour in this branch that existed before and could have broken.

1. `/orgs/<slug>/admin/invitations` → **New Invitation**.
2. Email field still validates (submit an invalid address; expect a field error, and the
   `console.error` from the `onInvalid` handler).
3. Primary-role radios and every secondary-role checkbox still render and toggle.
4. **Secondary roles are module-gated** — the regression most likely to slip through. In an
   org with I3 **off**, the I3 Editor checkbox must be absent; with Skill Track **off**,
   Skills Assessor and Skill Package Author must be absent. Toggle a module in
   `/orgs/<slug>/admin/organization/settings` and re-open the dialog.
5. Send an invitation; confirm it appears in the list and that `personId` is **null** (this
   path must not attach a person).

---

## D. The dropped unique constraint

Proven in SQL against the branch database (two invitations, one canceled and one pending,
sharing a `personId`), but not through the app — which is where the P2002 would actually
have surfaced.

1. Invite person X from their page (A1).
2. Without accepting, invite X **again** with a different role.
3. **Expect:** success. `cancelPendingInvitationsOnReInvite` cancels the first; the second is
   created carrying the same `personId`.

```sql
SELECT id, status, role, "personId" FROM organization_invitations
WHERE "personId" = '<person_id>' ORDER BY "createdAt";
```

Two rows — one `canceled`, one `pending` — both with the same `personId`. On `integration`
this step fails with a unique-violation.

4. Second shape of the same bug: accept an invitation, unlink the person from the user page,
   then invite them again. Also previously a P2002.

---

## E. Permission gating

`Invite to AVUT` is gated on `invitation: ["create"]`, which only `owner` and `admin` hold.

- Impersonate a plain `member` of the org → the menu item is **disabled**.
- Impersonate `skills-assessor` → also disabled.
- The real guard is server-side: `getInviteState` requires `invitation: ["view"]`,
  `member: ["view"]`, `person: ["view"]`. Confirm a member calling it over tRPC is rejected
  rather than merely not shown the button.

---

## F. Automated coverage, and what it cannot reach

**Covered** (`personnel-router.test.ts`, 8 cases): all four states, the mixed-case person
email, pending-invitation surfacing, absent pending invitation, NOT_FOUND for a foreign
person.

**Not reachable by unit tests, hence §A:**

- Whether better-auth actually persists `personId` through `inviteMember`. This is a property
  of the library's request pipeline, not of our code — a mocked Prisma can't see it.
- `afterAcceptInvitation`. `src/server/auth.ts` pulls in `server-only` transitively, so the
  hook is not importable in jsdom. This is the argument in the spec for moving its logic into
  `person-user-link.ts` when Part 2 lands, leaving the hook a thin call site.
- `prisma-mock` ignores the `{ equals: … }` filter object on string fields entirely, so any
  query written that way returns `null` in tests while working in Postgres. Part 1 avoids the
  shape; `getPersonByEmail` still uses it and is therefore **not** unit-testable.

---

## G. Forward — what Parts 2 and 3 will add

Not yet built; listed so the coverage is planned rather than retrofitted.

- **Part 2 (auto-link on accept):** unit-test `person-user-link.ts` directly. Browser check:
  with `personnel.autoLinkOnInviteAccept` on, an invitation created from the *Invitations*
  page (no `personId`) still links on accept when a person shares the email; with it off, it
  does not. Also confirm the audit entry now written by that path.
- **Part 3 (auto-link on create):** router tests for the setting on/off and the
  member-vs-non-member split. Browser check: create a person whose email matches an existing
  **member** → linked immediately; matches a **non-member** → not linked, and the person
  page offers Invite. Plus a D4H team import, which reaches the same helper and should link
  matching members as a side effect with its entries in the import's log batch.
- **Regression for both:** with both settings off (the defaults), behaviour must be
  byte-identical to today.
