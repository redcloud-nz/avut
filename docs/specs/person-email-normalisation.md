# Spec: Normalise `Person.email`

**Date:** 2026-09-14
**Status:** Draft

Store `personnel.email` lowercased, so that "one person per email address per
organization" — an invariant the schema already claims — becomes true.

Motivated by, but independent of,
[`docs/specs/person-user-linking.md`](person-user-linking.md), whose §3.1 currently
carries a two-row table of email-matching strategies that this change collapses to one.

---

## 1. The problem

`prisma/schema.prisma` says:

```prisma
@@unique([organizationId, email]) // Only one person per email address in an organization
```

**That comment is false.** Postgres unique indexes are case-sensitive, so two person rows
in one organization may differ only by case. Verified against the branch database:

```sql
INSERT INTO personnel (…, email, …) VALUES (…, 'dup@example.com', …), (…, 'DUP@Example.com', …);
-- INSERT 0 2
```

The application does not catch it either. Both conflict pre-checks use an exact match:

- `personnel.createPerson` — `personnel-router.ts:90`
- `personnel.updatePerson` — `personnel-router.ts:479`

So `Dana.Reed@example.com` can be added to an organization that already has
`dana.reed@example.com`, and nothing objects. The two records then accumulate their own
team memberships, skill checks, and I3 issued items — one human, split across two
identities, with no UI that reveals the split.

### Knock-on costs elsewhere

- `getPersonByEmail` (`personnel-router.ts:573`) must use `{ equals, mode: "insensitive" }`,
  which cannot use the index and — because `prisma-mock` ignores the `{ equals: … }` filter
  object entirely — **cannot be unit-tested at all**.
- `findLinkablePerson` (`src/server/person-user-link.ts`) loads every Active unlinked person
  in the organization and folds case in JS, for the same reason.
- The person→user direction already lowercases its needle because `User.email` *is*
  normalised (better-auth does it at sign-up). The asymmetry is purely `Person.email`'s.

---

## 2. Scale of the change

Everything that writes `Person.email` is in one file:

| Site | `personnel-router.ts` | Change |
| --- | --- | --- |
| `createPerson` procedure — conflict check | `:90` | lowercase the needle |
| `createPerson` procedure — write | `:113` | lowercase the value |
| `createPerson` helper — write (the D4H import path) | `:533` | lowercase the value |
| `updatePerson` — conflict check | `:479` | lowercase the needle |
| `updatePerson` — write | — | lowercase the value |

A Zod `.toLowerCase()` on `PersonData.modifiableSchema.email` is **not sufficient on its
own**: the D4H team import builds its object in code and passes it to the `createPerson`
helper unparsed (`teams-router.d4h.ts:357`), so the helper must normalise too. Doing both is
right — the schema catches every parsed path, the helper catches the one that isn't.

Collapsing the duplicated `createPerson` procedure body onto the shared helper (already
listed in the linking spec §6) reduces this to two write sites.

Reads that change: `getPersonByEmail` drops `mode: "insensitive"` for an indexed exact match;
`findLinkablePerson` collapses from an org-wide scan to an indexed exact match.

---

## 3. Options considered

### A. Store lowercase — **chosen**

Normalise on write, backfill existing rows. The column stays plain `text`.

- The existing unique index becomes meaningful with no index change.
- Every lookup is a genuine exact match, so **`prisma-mock` and Postgres agree**. This is
  decisive for this codebase: the mock silently mismatches on both
  `mode: "insensitive"` and `citext`, so any strategy that relies on database-side case
  folding is untestable here.
- Cost: the stored value loses its original casing.

### B. `citext` column

Postgres's case-insensitive text type. Prisma 7 does support `@db.Citext` (verified), and
`citext` 1.6 is available on the local server.

Genuinely attractive — it preserves display casing, fixes both conflict checks with **no
application change at all**, and makes the invariant a database guarantee rather than a
convention. Rejected on one point: `prisma-mock` does not emulate `citext`, so a test
asserting that a mixed-case person is matched would **fail in the mock while working in
production**. That is the same class of trap as `mode: "insensitive"`, just inverted, and it
would push the linking automations' coverage back out of reach. Secondary concerns: it needs
`CREATE EXTENSION citext` privileges in every environment, and it is an unusual column type
for tooling to meet.

Worth revisiting if the project ever moves off `prisma-mock` to a real test database.

### C. Functional unique index on `lower(email)`

Keeps stored casing and enforces uniqueness, but Prisma cannot express an expression index
in PSL, so it would live in raw SQL outside Prisma's model and risk drift on every
`migrate dev`. It also leaves the application-level conflict checks wrong — they would still
exact-match and report success right up until the database rejected the insert. Rejected.

---

## 4. The migration

Two statements, and the first is a guard, not a formality.

```sql
-- Refuse to proceed if lowercasing would merge two distinct people.
DO $$
DECLARE dupes int;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT 1 FROM personnel GROUP BY "organizationId", lower(email) HAVING count(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION
      'Cannot normalise personnel.email: % organization/email group(s) would collide. Resolve the duplicates first (see docs/specs/person-email-normalisation.md §5).', dupes;
  END IF;
END $$;

UPDATE personnel SET email = lower(email) WHERE email <> lower(email);
```

**Run this against production before writing the migration**, because it decides whether §5
is needed at all:

```sql
SELECT "organizationId", lower(email) AS email, count(*), array_agg(id)
FROM personnel GROUP BY 1, 2 HAVING count(*) > 1;
```

Dev database at the time of writing: **148 personnel, 0 mixed-case, 0 collisions.** The
backfill is a no-op there, and `users` is already fully lowercase (12 rows) because
better-auth normalises.

### Should the invariant be enforced, not just established?

A `CHECK (email = lower(email))` would make it impossible for a future write site to
reintroduce the problem. It is not expressible in PSL, so it would be raw SQL in the
migration and invisible to `schema.prisma`.

**Verify before committing to it:** confirm that a subsequent `prisma migrate dev` produces
an empty diff rather than proposing to drop the constraint, and that `migrate reset` replays
it. If Prisma is happy, add it; if it causes drift, rely on the schema transform plus the
helper and note the convention in `AGENTS.md`.

---

## 5. If production has duplicates

This is the only hard part, and it is **not** a migration problem — it is a merge decision a
human has to make. Two person rows for the same human may each own:

- `TeamMembership` rows (and `TeamMembership_D4H` snapshots)
- `SkillCheck` rows as assessee *and* as assessor
- `SkillCheckSession` assessee/assessor links
- `I3IssuedItem` rows
- at most one `OrganizationUser` link each
- at most one `OrganizationInvitation` each (now that its `personId` unique is gone)

Merging means choosing a survivor and re-pointing all of the above, which is a separate
piece of work with its own audit story. **If the production check returns any rows, stop and
scope that first** — do not let the migration make the choice.

If it returns nothing, this spec is a same-day change.

---

## 6. What it unlocks

- The schema comment becomes true, and duplicate personnel by casing become impossible.
- Both conflict pre-checks start working.
- `getPersonByEmail` becomes index-backed **and unit-testable** for the first time.
- `findLinkablePerson` loses its org-wide scan.
- The linking spec's §3.1 two-row strategy table collapses to a single rule: lowercase the
  needle, match exactly, in both directions. Its out-of-scope note goes away.

---

## 7. Non-goals

- **`User.email`.** Already lowercase by construction; better-auth owns that write path and
  should keep owning it.
- **`OrganizationInvitation.email`.** Separately not normalised, which is why an invitation
  typed mixed-case on the Invitations page is invisible to `getEntryControl`. Real, related,
  and its own fix — the invite-from-person dialog already lowercases what it sends.
- **Merging existing duplicates** (§5) — scoped only if production turns any up.
- Display of the original casing. Accepted loss; see §8.

---

## 8. Risks

- **Display changes.** A carefully typed `Dana.Reed@Example.com` renders as
  `dana.reed@example.com` on the person page, personnel list, and in invitation copy.
  Cosmetic, but visible to users who care about their own name's capitalisation.
- **RFC 5321 pedantry.** The local part of an address is formally case-sensitive. No mail
  provider in practical use honours that, and better-auth already bets on it for every AVUT
  user account, so this is consistent rather than novel.
- **D4H.** Sync is currently read-only into AVUT, so nothing is written back. If write-back
  is ever added, it would send the lowercased form — worth remembering then, not now.
- **Irreversible.** The original casing is not recoverable after the backfill. If that
  matters, the down-migration story is "there isn't one", which is another argument for
  running §4's production check with real attention.

---

## 9. Testing

- A router test that `createPerson` rejects a person whose email differs from an existing
  one only by case — the bug this spec exists to fix, currently unwritable.
- The same for `updatePerson` changing an email into a case-variant of another person's.
- `getPersonByEmail` finds a person when the needle is mixed case — possible for the first
  time once the stored side is normalised.
- `person-user-link.test.ts`'s "matches a person record whose email is mixed case" case
  becomes "matches regardless of the casing the caller passes", since the stored side can no
  longer vary.
- Post-migration assertion, against the branch database:
  `SELECT count(*) FROM personnel WHERE email <> lower(email);` → 0.

---

## 10. Order

| Step | Notes |
| --- | --- |
| 1 | Run §4's duplicate check against **production**. If it returns rows, stop and scope §5. |
| 2 | Own branch + `npm run db:branch person-email-normalisation`. Not folded into the linking branch. |
| 3 | Schema transform on `PersonData.modifiableSchema.email`, plus the helper and both conflict checks. |
| 4 | Guarded migration (§4). Decide the `CHECK` constraint after verifying Prisma tolerates it. |
| 5 | Simplify `getPersonByEmail` and `findLinkablePerson`; update the linking spec §3.1. |
| 6 | Tests (§9). |

---

## 11. Decisions

| Question | Decision |
| --- | --- |
| Normalise, or make the database case-insensitive? | Normalise (store lowercase). `citext` is the better design in the abstract but is invisible to `prisma-mock`, which would cost the linking automations their test coverage. |
| Where does normalisation happen? | Zod schema **and** the shared `createPerson` helper — the D4H import bypasses the schema. |
| Enforce with a `CHECK` constraint? | Only if Prisma tolerates it without drift; verify first. |
| What if production has case-duplicates? | Stop. Merging is a separate piece of work with a human decision in it; the migration must refuse rather than choose. |
| Preserve original casing anywhere? | No. Accepted loss. |
| Part of the person↔user linking branch? | No — independent value, own migration, own production check. |
