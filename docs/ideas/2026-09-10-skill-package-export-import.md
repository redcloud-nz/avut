# Skill package export / import

**Project:** avut
**Date:** 2026-09-10 14:20
**Source:** brainstorm session

## Idea

A `.json` export/import mechanism for the skill-package authoring tree
(`SkillPackage → SkillGroup → Skill`), so packages authored in one AVUT instance
(local dev) can be moved to another (preview, production) where
`SkillPackageSubscription` cannot reach because the databases are separate. The
same file format doubles as a way to ship a small library of reusable starter
packages in the repo.

Import is **create-or-sync** keyed on stable record IDs: a package ID belongs to
exactly one org per instance. If the incoming package ID already exists and
belongs to the current org, its groups/skills are upserted by ID and anything no
longer in the file is **archived** (never hard-deleted — `SkillCheck` cascades on
`skillId` and would take real assessment history with it). If the package ID
exists under a _different_ org, import stops with an error. Imported packages
always land `published: false`.

## Context / motivation

- Export/import of the authoring tree only — **no** checks, sessions, or
  subscriptions, and no downstream override rows.
- Subscriptions already handle cross-org sharing _within_ one instance; they do
  nothing across deployments. The immediate pain is "I have packages on local, I
  want them on preview and prod."
- Secondary value: a curated set of generally-useful packages that any org could
  be seeded from.
- No file-upload mechanism exists in the app yet, which shapes the v1 delivery
  (see Options).

## Options considered

**ID strategy on import**

- _Stable IDs, one-org-per-package, foreign owner = error_ — **chosen.** Cleanest
  round-trip: re-importing updates the same rows and a diff is meaningful. The
  user explicitly does not want the same package existing twice in one DB.
- _Mint fresh `nanoId16` IDs on every import, match by a `sourceId` provenance
  field_ — set aside. Needed only if one DB must hold multiple copies of a
  package (e.g. seeding a repo template into many orgs), which is out of scope.

**Deletions during sync**

- _Hard-delete rows absent from the file_ — rejected; `SkillCheck.skillId` is
  `onDelete: Cascade`, so a prod re-import could silently destroy assessment
  history.
- _Archive absent rows (`status: Archived`)_ — **chosen** for v1, accepting that
  it can leave archived cruft. A future diff/preview UI would make this safer and
  more transparent.
- _Additive only (never remove)_ — set aside; packages do lose skills over time
  and the target would drift.

**`published` / `status` on arrival**

- Always `published: false` — **chosen.** A prod import must be deliberately
  published afterward.

**Delivery of the "useful others" library**

- _Ship `.json` files in the repo, import restricted to Better Auth `admin`
  (system role) via the `system-admin` module_ — **chosen for v1**, because there
  is no file-upload path yet. Admin picks a bundled file + a target org and runs
  the import.
- _Real in-app file upload on the skill-package-builder pages_ — the eventual
  shape, deferred until a general upload mechanism exists.

## Open questions

- **Export side.** How is the `.json` produced in v1? Options: a
  `skillPackageBuilder: ["read"]` tRPC query that returns the envelope for a
  page/CLI to save; a copy-to-clipboard button; or also a system-admin-only
  screen. Not yet decided.
- **Tag vocabulary collision.** Tags travel inline as `String[]`. Once #38 lands
  (per-object-type allowed tag lists, tracking issue #91), an imported package
  may carry tags the target org's vocabulary disallows. Import-time behaviour
  (strip / warn / auto-add to vocab) is undecided.
- **`properties` JSON.** Currently free-form `Json`. Does the envelope schema
  validate it, or pass it through opaquely?
- **Diff / preview UI.** The user wants "a UI display of any changes being made"
  before committing an import. Nice-to-have for v1, likely a fast-follow.
- **Multi-package import.** Whether a single file / single action can carry more
  than one package (would make the import a `LogBatch` with an entry per
  package rather than a single entry).

## Notes

- Schema: `prisma/schema.prisma:437` (`SkillPackage`), `:458` (`SkillGroup`),
  `:479` (`Skill`). All carry `tags String[]`, `properties Json`, `status
RecordStatus`, plus `sequence` / `defaultInclude` / (`Skill` also `frequency`,
  `defaultRequired`). `SkillPackage.published Boolean`.
- Existing authoring router: `src/trpc/routers/skill-package-builder-router.ts`
  — procedures alphabetical, `organizationProcedure({ skillPackageBuilder: [...] })`,
  writes paired with `ctx.logEvent` inside `ctx.prisma.$transaction([...])`.
- Import procedure would be `systemAdminProcedure` with the `organizationId`
  logEvent arm (`ctx.logEvent({ organizationId, action: "Create" | "Update",
objectType: "SkillPackage", objectId })`). A single-package import is one
  package-shaped event → **one** log entry (the group/skill row writes are an
  implementation detail, per AGENTS.md batch guidance), so no `LogBatch` unless
  multi-package import is added.
- `systemAdminProcedure`: `src/trpc/init.ts:175`. System-admin module:
  `src/lib/modules.ts:138`, route `/system-admin`, gated on Better Auth `admin`.
- Envelope shape to define as a Zod schema in `src/lib/schemas/` (shared): e.g.
  `{ formatVersion, exportedAt, package: { id, name, description, tags,
properties, groups: [{ id, …, skills: [{ id, … }] }] } }`. `formatVersion` for
  forward-compat.
- Bundled library files could live at e.g. `prisma/skill-packages/*.json` or
  `src/server/skill-packages/`.
- Cross-org sharing that this is _not_ replacing: `SkillPackageSubscription` +
  `SkillGroupOverride` / `SkillOverride` (`prisma/schema.prisma:573`).
- Related: tags tracking issue #91 (sub-issues #38–#41).
