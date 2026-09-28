-- Hand-written data-preserving reshape migration (#286 Phase 2).
-- Prisma's own diffing can't express "move rows into a differently-shaped table",
-- so this migration is written by hand rather than generated from a schema diff.

-- Copy every d4h_access_tokens row into provider_credentials, preserving its id
-- (so linkTokenId/syncTokenId values on team_d4h/organization_d4h still resolve),
-- folding the sibling `serverCode` column into the discriminated-union `metadata`
-- JSON alongside the `provider` discriminant.
INSERT INTO "provider_credentials" (
    "id",
    "provider",
    "organizationId",
    "userId",
    "groupId",
    "label",
    "token",
    "status",
    "expiresAt",
    "metadata",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    'D4H'::"Provider",
    "organizationId",
    "userId",
    NULL,
    "label",
    "token",
    "status",
    "expiresAt",
    jsonb_set(coalesce("metadata", '{}'::jsonb), '{provider}', '"D4H"') ||
        jsonb_build_object('serverCode', "serverCode"),
    "createdAt",
    "updatedAt"
FROM "d4h_access_tokens";

-- Repoint the FKs that referenced d4h_access_tokens at provider_credentials instead.
-- The referenced ids are unchanged (copied verbatim above), so the columns themselves
-- don't need touching, only which table their FK constraint targets.
ALTER TABLE "organization_d4h" DROP CONSTRAINT "organization_d4h_syncTokenId_fkey";
ALTER TABLE "organization_d4h" ADD CONSTRAINT "organization_d4h_syncTokenId_fkey"
    FOREIGN KEY ("syncTokenId") REFERENCES "provider_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "team_d4h" DROP CONSTRAINT "team_d4h_linkTokenId_fkey";
ALTER TABLE "team_d4h" ADD CONSTRAINT "team_d4h_linkTokenId_fkey"
    FOREIGN KEY ("linkTokenId") REFERENCES "provider_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- d4h_access_tokens is now fully superseded by provider_credentials.
DROP TABLE "d4h_access_tokens";
