# Testing plan: person ↔ user linking

**Date:** 2026-09-14
**Covers:** the whole of [`docs/specs/person-user-linking.md`](../specs/person-user-linking.md)
— the §2 constraint fix, and Parts 1, 2 and 3 — plus the incidental changes the branch made
along the way.
**Branch:** `feat/person-user-linking`, worktree `.claude/worktrees/person-user-linking`.

All three parts are committed with unit coverage. **None of it has run in a browser.** §A is
the sharpest gap — the end-to-end path the feature exists to serve — but Parts 2 and 3 and
the new settings card are equally unobserved.

| #   | Area                                              | Automated          | Needs a human/browser                  |
| --- | ------------------------------------------------- | ------------------ | -------------------------------------- |
| A   | Invite → accept → link, end to end                | ✗                  | **yes — the headline gap**             |
| B   | The four `getInviteState` states in the dialog    | ✓ router           | yes (rendering)                        |
| C   | Part 2 — auto-link on invitation accept           | ✓ helper           | yes (through real accept)              |
| D   | Part 3 — auto-link on person create               | ✓ router           | yes                                    |
| E   | D4H team import auto-links                        | ✗                  | **yes — no automated coverage at all** |
| F   | Personnel settings card                           | ✓ store round-trip | yes (the card itself)                  |
| G   | Audit entries                                     | ✓ shape            | yes, **by SQL — no UI exists**         |
| H   | Invitations page after the role-fields extraction | ✗                  | yes                                    |
| I   | Everything with both switches off                 | partly             | yes                                    |
| J   | Re-invite (the dropped unique constraint)         | ✗ (SQL only)       | yes                                    |
| K   | Permission gating and the new hotkey              | ✗                  | yes                                    |
| §0  | Email delivery guard rail                         | ✓ unit             | yes — check the Resend dashboard       |

---

## 0. Setup

**The dev server must run from this worktree.** `.env.local` here points at the branch
database `avut_person_user_linking`; the main checkout still points at shared `avut`, which
does **not** have the migration. A dev server started in the wrong directory will either fail
or quietly exercise the old constraint.

```bash
cd .claude/worktrees/person-user-linking
grep POSTGRES_DATABASE .env.local     # expect avut_person_user_linking
npm run dev -- -p 3100                # 3000/3001 belong to the main checkout
```

A psql shell against that database, used throughout:

```bash
url="$(sed -nE 's/^POSTGRES_URL_NON_POOLING="?([^"]+)"?.*/\1/p' .env.local)"
psql "$url" -c '\d organization_invitations'   # personId should be an index, not a unique
```

Signing in follows [`.claude/skills/avut-test-in-browser`](../../.claude/skills/avut-test-in-browser/SKILL.md):
`window.avut.signIn(...)` with the admin test account, then `impersonateUser` to change
identity. You need `owner` or `admin` in the target org — the only roles holding
`invitation: ["create"]`.

**Both settings default off**, so §C and §D need them switched on in
`/orgs/<slug>/admin/organization/settings` → Personnel. §I is the check that off really means
off.

### No mail reaches a real person

The dev database holds records for **real people with their real email addresses**, and this
plan clicks "Send Invitation" and "Resend" repeatedly. `sendEmail` (`src/server/email.ts`) is
the single choke point every message passes through, and it now fails closed: unless
`VERCEL_ENV === "production"`, every `to`/`cc`/`bcc` is rewritten onto Resend's sink at
`delivered+<address>@resend.dev`.

So a message sent while testing is accepted by Resend, appears in its dashboard, and is handed
to no mailbox. Nothing needs to be switched on for this — it is the default everywhere except
the production deployment.

To confirm an invitation went to the right person without one being emailed, read the message
in the [Resend dashboard](https://resend.com/emails):

- the **subject** is prefixed `[dev → alex@example.com]` with the intended recipients;
- the **`X-AVUT-Intended-Recipients` header** carries the full list;
- the **recipient** is `delivered+alex_at_example.com@resend.dev` — the intended address
  encoded into the sink's tag, so the dashboard row is still readable at a glance.

Seeing a real address in the "To" column of that dashboard means the guard rail failed; stop
and treat it as a defect. `EMAIL_DELIVERY=live` is the only thing that disables it, and this
plan never sets it.

---

## A. Invite → accept → link (the unverified path)

The point of Part 1: the invitation carries `personId`, and
`organizationHooks.afterAcceptInvitation` applies it. Both halves are believed correct from
reading better-auth's `crud-invites.mjs` — that it spreads unknown body fields into the row —
but neither has been observed.

### A1. The invitation is created and carries `personId`

**Precondition:** a person in the org with **no** AVUT account:

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
2. ⋮ menu → **Invite to AVUT** should be present, above Archive.
3. Dialog reads _Invite to AVUT_, names the person's email, shows the role radios
   (defaulting to Member).
4. **Send Invitation.**

**Verify — the assertion that matters:**

```sql
SELECT id, email, role, status, "personId"
FROM organization_invitations
WHERE "personId" = '<person_id>' AND status = 'pending';
```

`personId` must be **non-null and equal to the person's id**. Null means better-auth dropped
the additional field and the whole feature is inert while every visible step still succeeds.
Also confirm the stored `email` is **lowercase** even when the person record is mixed case.

### A2. Accepting the invitation creates the link

Take the invitation id from A1 and hit the accept route directly — that is what the email's
link does.

1. Navigate to `/auth/accept-invitation/<invitation_id>`. It signs out any session, sets the
   `avut.invitation_to_accept` cookie, and redirects to `/auth/sign-up?email=…` (no account)
   or `/auth/sign-in?email=…`. Confirm the email is pre-filled.
2. Complete sign-up. Email verification is required and the OTP is **not** printed to the
   console — only "Sending verification OTP". Read it from the database (`storeOTP` is unset
   in `auth.ts`, so better-auth stores it plaintext):

   ```sql
   SELECT identifier, split_part(value, ':', 1) AS otp, "expiresAt"
   FROM user_verification ORDER BY "createdAt" DESC LIMIT 5;
   ```

   The stored `value` is `<otp>:<attempt-count>` — type only the part before the colon.

3. The app lands on `/auth/post-sign-in`, which accepts the pending invitation.

**Verify:**

```sql
SELECT ou.id, ou."userId", ou."personId", ou.role, u.email
FROM organization_users ou JOIN users u ON u.id = ou."userId"
WHERE ou."personId" = '<person_id>';
```

One row, `personId` set, `role` as chosen in A1. Then reload the person page: the **Linked
User Account** card renders and **Invite to AVUT** is gone from the ⋮ menu.

### A3. Mixed-case email survives the round trip

Why the dialog lowercases: `getEntryControl` looks invitations up by the session user's
(lowercase) email, so an invitation stored mixed-case is invisible to its recipient.

Pick or edit a person whose email has capitals (`Dana.Reed@Example.com`), invite them, sign up
as `dana.reed@example.com`. The invitation should still appear and be accepted, and `personId`
should land on the membership.

### A4. The explicit path ignores the setting

Turn `personnel.autoLinkOnInviteAccept` **off**, then run A1+A2. The link must still happen —
an invitation sent from a person's record is an admin's decision, not an automation.

---

## B. The dialog's four states

Router behaviour is covered by `personnel-router.test.ts`. What is untested is that each state
renders the right controls.

| State           | Setup                                             | Expect                                                                                          |
| --------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `NoUser`        | Person with no matching account (A1)              | Title _Invite to AVUT_, role fields, **Send Invitation**                                        |
| `UserExists`    | Email matches a user who is **not** a member here | Same, plus _"They already have an AVUT account but are not a member of this organization yet."_ |
| `AlreadyMember` | Email matches a user who **is** a member here     | Title _Link User Account_, **no role fields**, button **Link Account**                          |
| `Linked`        | Already-linked person                             | Menu item absent                                                                                |

`AlreadyMember` is the one to watch — it exists because better-auth rejects the invite in that
case. Pressing **Link Account** must write `organization_users.personId` and the Linked User
Account card must appear without a page reload (the mutation's cache effects).

```sql
-- an AlreadyMember candidate
SELECT p.id AS person, p.email, ou."userId"
FROM personnel p
JOIN users u ON lower(u.email) = lower(p.email)
JOIN organization_users ou ON ou."userId" = u.id AND ou."organizationId" = p."organizationId"
WHERE ou."personId" IS NULL AND p.status = 'Active'
LIMIT 5;
```

**Pending-invitation warning:** invite a person, reopen the dialog without accepting. Expect
_"An invitation is already pending (sent …). Sending a new one replaces it."_

---

## C. Part 2 — auto-link on invitation accept

The case A1 does **not** cover: an invitation created from the **Invitations page**, carrying
no `personId`, that finds its person by email on accept.

1. Settings → Personnel → **Link on invitation accept** on.
2. `/orgs/<slug>/admin/invitations` → **New Invitation**, using the email of an existing
   Active, unlinked person. (Confirm `personId IS NULL` on the created row — this is the whole
   difference from §A.)
3. Accept it as in A2.

**Expect:** the membership comes out with `personId` set, and an audit entry saying _matched
on email address_ (§G).

**Then the negative:** switch it off, repeat with another person. No link, no membership audit
entry — and the invitation must still be accepted normally.

**Failure isolation.** A linking failure must never fail the accept; the membership is already
committed when the hook runs. Hard to force deliberately — watch the dev-server console for
`Failed to link a person to User(...)` and confirm the user still lands in the org if it ever
appears.

---

## D. Part 3 — auto-link on person create

1. Settings → Personnel → **Link when a person is added** on.
2. Find a member of the org with no person attached:

   ```sql
   SELECT ou."userId", u.email FROM organization_users ou
   JOIN users u ON u.id = ou."userId"
   WHERE ou."organizationId" = '<org_id>' AND ou."personId" IS NULL;
   ```

3. `/orgs/<slug>/admin/personnel` → **New Person** with that email.

**Expect:** the person page shows the Linked User Account card immediately; the Personnel and
Users lists agree without a manual reload (the widened `personnelEffects.createPerson`).

**The important negative — an email match must never grant membership.** Create a person whose
email belongs to a user who is **not** a member of this org. Expect: person created, _no_
link, and **no new row in `organization_users`**:

```sql
SELECT * FROM organization_users WHERE "organizationId" = '<org_id>' AND "userId" = '<that_user>';
-- must stay empty
```

**Rollback.** `createPerson` now runs in one interactive transaction, so a failure in the link
step rolls back the person too. There is no easy way to force this from the UI; if a create
ever errors, confirm no orphan person row was left behind.

---

## E. D4H team import — no automated coverage at all

Part 3 put the auto-link in the shared `createPerson` helper, which the D4H team import also
calls. **The import therefore auto-links as a side effect, and nothing in the test suite
exercises that path.** It is also the only path that passes a `batchId`.

1. An org with D4H configured and a valid sync token, **Link when a person is added** on.
2. `/orgs/<slug>/admin/teams` → import a team whose D4H members include the email of an
   existing AVUT member of that org.
3. Confirm the import completes and creates people as before.

**Verify both entries joined the import's batch:**

```sql
SELECT e."objectType", e.action, e."batchId", b."operationKey"
FROM log_entries e LEFT JOIN log_batches b ON b.id = e."batchId"
WHERE e."organizationId" = '<org_id>'
ORDER BY e.sequence DESC LIMIT 20;
```

The `OrganizationMembership` link entry should carry the same `batchId` as the `Person` create
entries.

**Watch for:** the import loop now opens one interactive transaction per person instead of an
array transaction. On a large team, confirm it does not slow noticeably or hit a transaction
timeout.

---

## F. Personnel settings card

New UI, on `/orgs/<slug>/admin/organization/settings` under a new **Personnel** heading
between General and Integrations.

- Both switches read **off** on an org that has never set them.
- Toggling one shows **Reset**; Reset restores the saved values.
- **Save** persists; reload and the values stick.
- Each card saves independently — saving Personnel must not disturb unsaved edits in another
  card, or clobber other settings.

```sql
SELECT key, value FROM organization_config
WHERE "organizationId" = '<org_id>' AND key LIKE 'personnel.%';
```

Only the leaves that differ from the defaults should be materialised.

---

## G. Audit entries — verify by SQL

**There is no UI for this.** The person History page renders `NotImplemented` and its menu
item is disabled, so every audit assertion below is a query.

```sql
SELECT scope, "organizationId", "userId", "actorLabel", action, "objectType", "objectId",
       description, "batchId"
FROM log_entries
WHERE "objectType" = 'OrganizationMembership'
ORDER BY sequence DESC LIMIT 10;
```

| Trigger                | Expect in `description`                                   |
| ---------------------- | --------------------------------------------------------- |
| Part 1 invite accepted | `on invitation accept — the invitation named the person.` |
| Part 2 email match     | `on invitation accept — matched on email address.`        |
| Part 3 person create   | `on creation — matched on email address.`                 |

In all three, `userId` is the **acting human** — the accepting user for Parts 1 and 2, the
admin who created the person for Part 3 (_not_ the user being linked). `actorLabel` should read
`Name <email>`.

**The negative that matters:** when no link is made, there must be **no** membership entry.
Run the §C-off and §D-no-match cases and confirm nothing new appears above.

These entries are new — before this branch the explicit-`personId` path wrote none at all.

---

## H. Regression — the Invitations page

`create-invitation.tsx` was refactored onto the shared `InvitationRoleFields` (reached through
`useFormContext`). It is the main pre-existing behaviour this branch could have broken.

1. `/orgs/<slug>/admin/invitations` → **New Invitation**.
2. Email validation still fires (submit an invalid address; expect a field error plus the
   `onInvalid` console log).
3. Primary-role radios and every secondary-role checkbox render and toggle.
4. **Secondary roles are module-gated** — the likeliest regression. With I3 off, no I3 Editor
   checkbox; with Skill Track off, no Skills Assessor or Skill Package Author. Toggle a module
   in settings and re-open the dialog.
5. Send one; it appears in the list with `personId` **null**.

---

## I. Regression — both switches off

The promise is that an organization that does not opt in behaves exactly as it did before.

- Create a person whose email matches an existing member → **not** linked.
- Accept an invitation with no `personId` whose email matches a person → **not** linked.
- No `OrganizationMembership` audit entries from either.
- The D4H team import creates people and memberships as before, with no link entries.

---

## J. The dropped unique constraint

Proven in SQL against the branch database (a canceled and a pending invitation sharing a
`personId`), but not through the app — which is where the P2002 would have surfaced.

1. Invite person X from their page.
2. Without accepting, invite X **again** with a different role. **Expect success**;
   `cancelPendingInvitationsOnReInvite` cancels the first.

```sql
SELECT id, status, role, "personId" FROM organization_invitations
WHERE "personId" = '<person_id>' ORDER BY "createdAt";
```

Two rows — one `canceled`, one `pending` — sharing a `personId`. On `integration` this step
fails with a unique violation.

3. Second shape: accept an invitation, unlink the person on the user page, invite again. Also
   previously a P2002.

---

## K. Permission gating and the hotkey

`Invite to AVUT` is gated on `invitation: ["create"]`, which only `owner` and `admin` hold
(`memberAc` grants `invitation: []`).

- Impersonate a plain `member` → the menu item is **disabled**. Same for `skills-assessor`.
- The real guard is server-side: `getInviteState` requires `invitation: ["view"]`,
  `member: ["view"]`, `person: ["view"]`. Confirm a member calling it over tRPC is rejected,
  not merely not shown the button.
- **New hotkey:** `invite` was added to the `ActionHotkey` registry as **Alt+V** (Alt+I was
  already `import`). On the person page, Alt+V should open the invite dialog, and the shortcut
  should appear under Personnel in the `?` help overlay. Confirm it does not collide with
  another registered chord.

---

## L. Automated coverage, and what it cannot reach

**Covered:** `person-user-link.test.ts` (23 cases — both lookups, every no-op branch of the
linker, and both Part 2 triggers); `personnel-router.test.ts` (14 — `getInviteState`'s four
states, mixed case, pending invitations, and Part 3's link/no-link/no-membership cases);
`organization-settings-store.test.ts` (the `personnel` group round-trip and its off defaults).

**Not reachable by unit tests:**

- Whether better-auth actually persists `personId` through `inviteMember`. A property of the
  library's request pipeline; a mocked Prisma cannot see it. → §A1.
- `afterAcceptInvitation` itself. `src/server/auth.ts` imports `server-only` transitively, so
  the hook is not importable under jsdom — which is exactly why its logic lives in
  `person-user-link.ts` and the hook is a four-line call site. → §A2, §C.
- The D4H import path end to end. → §E.
- Anything rendered. → §B, §F, §H.
- `prisma-mock` ignores the `{ equals: … }` filter object on string fields, so queries written
  that way return `null` in tests while working in Postgres. The branch avoids that shape;
  `getPersonByEmail` still uses it and is therefore untestable. See
  [`person-email-normalisation.md`](../specs/person-email-normalisation.md).
- `prisma-mock` reports an unset optional column as `undefined` rather than `null`, so assert
  on _what is linked_ rather than on a column's empty value.
