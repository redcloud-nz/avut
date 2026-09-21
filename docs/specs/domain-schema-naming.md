# Spec: Standardize domain schema naming on the `XData` suffix

**Date:** 2026-09-21
**Status:** Draft

## What problem does this solve?

`src/lib/schemas/` has ~40 domain schema files that all follow the same structural pattern — a namespace object exposing `.schema`, `.modifiableSchema`, and `.fromRecord()`, plus a branded `XId` type — but the naming is inconsistent. `Person`, `Team`, `Organization`, `TeamMembership`, `User`, and `UserSession` export their namespace object as `XData` (`PersonData`, `TeamData`, …), while `Skill`, `SkillCheck`, `SkillGroup`, `SkillPackage`, `SkillCheckSession`, `SkillPackageSubscription`, `FormInstance`/`FormInstanceItem`, `I3Template`/`I3TemplateVariant`, `OrganizationUser`, and `D4HAccessToken`/`D4HAccessToken_ServerOnly` export the bare entity name instead, despite having the identical shape.

The bare-name files all carry `import { X as XRecord } from "@/generated/prisma/client"` purely to free up the name `X` for the schema export. That alias is dead weight: `XData` never collides with the Prisma-generated `X` type in the first place, so those files could import the Prisma type unaliased. The inconsistency also means there's no way to guess the right export name for a new domain schema from the existing pattern — a new contributor has a coin flip.

There's also no pattern doc describing this schema shape at all. `docs/patterns/` covers data-fetching and mutation-dialog conventions but nothing about the domain schema shape itself, which is likely why the naming drifted in the first place.

## Proposed solution

1. Rename the outlier schema namespace objects to the `XData` convention: `Skill` → `SkillData`, `SkillCheck` → `SkillCheckData`, `SkillGroup` → `SkillGroupData`, `SkillPackage` → `SkillPackageData`, `SkillCheckSession` → `SkillCheckSessionData`, `SkillPackageSubscription` → `SkillPackageSubscriptionData`, `FormInstance`/`FormInstanceItem` → `FormInstanceData`/`FormInstanceItemData`, `I3Template`/`I3TemplateVariant` → `I3TemplateData`/`I3TemplateVariantData`, `OrganizationUser` → `OrganizationUserData`, `D4HAccessToken`/`D4HAccessToken_ServerOnly` → `D4HAccessTokenData`/`D4HAccessTokenData_ServerOnly`. Drop the now-unnecessary `as XRecord` import alias in each of these files. Carry the derived `Modifiable<X>` type names through mechanically (`ModifiableSkill` → `ModifiableSkillData`, etc.) — no new naming decision there.
2. Update every call site referencing the old bare names — trpc routers, components, tests.
3. Add `docs/patterns/domain-schema.md` codifying the shape: the `{schema, modifiableSchema, fromRecord}` namespace object, the branded `XId` pattern (`zodNanoId16().brand()`), the `XRef` pattern for cross-entity references, and the naming rule itself — `XData` suffix for anything with a `fromRecord` wrapping a Prisma model; bare names reserved for `XId`/`XRef`/enums and other non-record-wrapper schemas (`OrganizationRole`, `LogAction`, `RecordStatus`, `DateRange`, etc.), which stay as they are.

Schemas that aren't Prisma-record wrappers (`Notification`, `SyncPlan`, `DateRange`, `SkillPackageExport`, `OrganizationSettings`) are out of scope — they don't have the `fromRecord`+alias pattern this spec is about.

## Alternatives considered

- A `Model` suffix instead of `Data` — rejected because `schema.prisma` already calls its own entity definitions "models" (`model Person { ... }`), so `PersonModel` would read as "the Prisma model" rather than "the Zod domain wrapper," which is the opposite of the goal.
- Leaving the naming as-is and only writing the pattern doc — rejected because the doc would have to document two conventions instead of one, defeating the point of writing it.

## Related module

N/A — this is an internal code convention that cuts across every module's schemas, not tied to one.

## Resolved decisions

| Decision | Outcome |
| --- | --- |
| Suffix to standardize on | `XData` (not `Model`, not leaving as-is) |
| Scope | Only schemas with a `fromRecord` wrapping a single Prisma model; enums, `XId`, `XRef`, and computed/non-record schemas are unaffected |
| `Modifiable<X>` naming | Follows the renamed schema object mechanically (`ModifiableSkill` → `ModifiableSkillData`) |
| Pattern doc | New `docs/patterns/domain-schema.md`, written alongside the rename |
