# Bundled skill-package library

Importable skill packages that ship as `.json` files in the repo. Used by the **System Admin →
Skill Packages** screen to seed an organization or move a package between AVUT instances
(whose databases are separate, so `SkillPackageSubscription` can't reach across them).

See issue #115 and `docs/ideas/2026-09-10-skill-package-export-import.md`.

## Adding a package

1. Author the package in the `skill-package-builder` module on some instance.
2. Export it: call `skillPackageBuilder.exportPackage` (returns the `SkillPackageExport`
   envelope) and save the JSON here, e.g. `water-rescue.json`.
3. Register it in `RAW_LIBRARY` in [`index.ts`](./index.ts) — a static `import` so the
   bundler traces the file.

## Format

Each file matches the shared `SkillPackageExport` Zod schema
(`src/lib/schemas/skill-package-export.ts`): a versioned envelope wrapping the authoring tree
(`SkillPackage → SkillGroup → Skill`) only — no checks, sessions, subscriptions, or overrides.

## Import semantics

Create-or-sync, keyed on the record IDs in the file:

- Package ID absent on the target → the tree is created.
- Package ID present and owned by the target org → groups/skills are upserted by ID, and any
  active group/skill under the package that the file omits is **archived** (never deleted —
  `SkillCheck.skillId` cascades and would take assessment history with it).
- Package ID owned by a different org → the import is refused.

Imported packages always land `published: false`; publishing on the target is a separate step.

`example-starter-package.json` is a placeholder to demonstrate the flow — delete it once real
library packages exist.
