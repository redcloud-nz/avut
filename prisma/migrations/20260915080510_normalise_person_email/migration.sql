-- Normalise `personnel.email` to lowercase.
--
-- `@@unique([organizationId, email])` carries the comment "Only one person per email address in
-- an organization", but Postgres unique indexes are case-sensitive, so until now two rows in one
-- organization could differ only by case — one human split across two identities, each
-- accumulating its own team memberships, skill checks and issued items.
--
-- See docs/specs/person-email-normalisation.md.

-- Refuse to proceed if lowercasing would merge two distinct people. Which of two records
-- survives, and where their memberships, skill checks and issued items end up, is a human
-- decision with its own audit story (spec §5) — this migration must not make it silently.
DO $$
DECLARE dupes int;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT 1 FROM personnel GROUP BY "organizationId", lower(email) HAVING count(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION
      'Cannot normalise personnel.email: % organization/email group(s) would collide. Resolve the duplicates first (see docs/specs/person-email-normalisation.md section 5).', dupes;
  END IF;
END $$;

UPDATE personnel SET email = lower(email) WHERE email <> lower(email);

-- Keep it true. Prisma cannot express a CHECK in PSL, so this is invisible to schema.prisma;
-- it is here so a future write site that forgets to normalise fails loudly instead of quietly
-- reintroducing case-duplicate people.
ALTER TABLE personnel ADD CONSTRAINT personnel_email_lowercase CHECK (email = lower(email));
