# Skill Package Builder Module

An authoring tool for creating and managing skill packages — structured collections of skills organised into groups — that can be published for use by the Skills module.

---

## Status

Implemented.

---

## Roles & Permissions

Permission subject: `skillPackageBuilder`

| Action    | Description                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `view`    | List and read packages, groups, and skills                                                                  |
| `create`  | Create new packages                                                                                         |
| `update`  | Create/edit/delete groups and skills; archive, restore, and reorder all objects; move skills between groups |
| `delete`  | Delete packages                                                                                             |
| `publish` | Publish or unpublish packages                                                                               |

Role assignments:

| Role                   | `skillPackageBuilder`                 |
| ---------------------- | ------------------------------------- |
| `owner`                | view, create, update, delete, publish |
| `admin`                | view, create, update, delete, publish |
| `skill-package-author` | view, create, update, delete, publish |
| `member`               | —                                     |
| `skills-admin`         | —                                     |
| `skills-assessor`      | —                                     |

---

## Concepts

### Skill Package

A top-level container that groups a set of skills for a particular domain or role. Packages have a `published` flag independent of their `status`:

- **Status** (`Active` / `Archived` / `Deleted`): controls authoring visibility. Only `Active` packages can be published.
- **Published**: when `true`, the package is available to the Skills module for subscription.

Unpublishing a package does not affect existing subscriptions; it only prevents new subscriptions.

### Skill Group

An ordered subdivision within a package (e.g. "Navigation", "Patient Care"). Groups carry a `sequence` integer used for display ordering and a `defaultInclude` flag that hints to subscribers whether the group should be included when creating a subscription. Subscribers can override this per-group via `SkillGroupOverride`.

### Skill

An individual competency item within a group. Skills carry:

- `sequence` — display order within the group
- `frequency` — revalidation interval in months (default `12`; `0` means no revalidation required)
- `defaultInclude` — hints to subscribers whether the skill should be included when creating a subscription; can be overridden per-skill via `SkillOverride`
- `defaultRequired` — whether the skill is required by default in subscriptions (default `false`)

---

## Data Model

### `SkillPackage`

```prisma
model SkillPackage {
  id             String       @id
  organizationId String
  name           String
  description    String
  tags           String[]     @default([])
  properties     Json         @default("{}")
  published      Boolean      @default(false)
  status         RecordStatus @default(Active)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  groups        SkillGroup[]
  skills        Skill[]
  subscriptions SkillPackageSubscription[]
}
```

### `SkillGroup`

```prisma
model SkillGroup {
  id              String       @id
  skillPackageId  String
  name            String
  description     String
  tags            String[]     @default([])
  properties      Json         @default("{}")
  sequence        Int          @default(0)
  defaultInclude  Boolean      @default(true)
  status          RecordStatus @default(Active)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  skills                Skill[]
  subscriptionOverrides SkillGroupOverride[]
}
```

### `Skill`

```prisma
model Skill {
  id              String       @id
  skillPackageId  String
  skillGroupId    String
  name            String
  description     String
  tags            String[]     @default([])
  properties      Json         @default("{}")
  sequence        Int          @default(0)
  frequency       Int          @default(12)   // revalidation frequency in months
  defaultInclude  Boolean      @default(true)
  defaultRequired Boolean      @default(false)
  status          RecordStatus @default(Active)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  checks                SkillCheck[]
  sessions              SkillCheckSession[]
  subscriptionOverrides SkillOverride[]
}
```

---

## tRPC Procedures

All procedures live in `skillPackageBuilderRouter` registered as `skillPackageBuilder` in `_app.ts`.

### Package procedures

| Procedure                              | Permission | Description                                                         |
| -------------------------------------- | ---------- | ------------------------------------------------------------------- |
| `skillPackageBuilder.listPackages`     | view       | List all packages owned by the organisation                         |
| `skillPackageBuilder.createPackage`    | create     | Create a new package                                                |
| `skillPackageBuilder.updatePackage`    | update     | Update name, description, tags, properties                          |
| `skillPackageBuilder.deletePackage`    | delete     | Hard-delete a package and all its groups and skills                 |
| `skillPackageBuilder.archivePackage`   | update     | Set status to `Archived` (must be `Active`)                         |
| `skillPackageBuilder.restorePackage`   | update     | Set status back to `Active` (must be `Archived` or `Deleted`)       |
| `skillPackageBuilder.publishPackage`   | publish    | Set `published = true` (must be `Active` and not already published) |
| `skillPackageBuilder.unpublishPackage` | publish    | Set `published = false` (must be currently published)               |

### Group procedures

| Procedure                           | Permission | Description                                                   |
| ----------------------------------- | ---------- | ------------------------------------------------------------- |
| `skillPackageBuilder.listGroups`    | view       | List all groups within a package                              |
| `skillPackageBuilder.createGroup`   | update     | Create a group; appended at end of current sequence           |
| `skillPackageBuilder.updateGroup`   | update     | Update name, description, tags, properties                    |
| `skillPackageBuilder.deleteGroup`   | update     | Hard-delete a group and all its skills                        |
| `skillPackageBuilder.archiveGroup`  | update     | Set status to `Archived` (must be `Active`)                   |
| `skillPackageBuilder.restoreGroup`  | update     | Set status back to `Active` (must be `Archived` or `Deleted`) |
| `skillPackageBuilder.reorderGroups` | update     | Reassign `sequence` values for groups within a package        |

### Skill procedures

| Procedure                                | Permission | Description                                                                                                 |
| ---------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| `skillPackageBuilder.listSkills`         | view       | List all skills within a package                                                                            |
| `skillPackageBuilder.createSkill`        | update     | Create a skill within a group; appended at end of current sequence                                          |
| `skillPackageBuilder.updateSkill`        | update     | Update name, description, tags, properties, frequency, defaultInclude, defaultRequired                      |
| `skillPackageBuilder.deleteSkill`        | update     | Hard-delete a skill                                                                                         |
| `skillPackageBuilder.archiveSkill`       | update     | Set status to `Archived` (must be `Active`)                                                                 |
| `skillPackageBuilder.restoreSkill`       | update     | Set status back to `Active` (must be `Archived` or `Deleted`)                                               |
| `skillPackageBuilder.moveSkill`          | update     | Move a skill to a different group within the same package (cross-package move is not yet exposed in the UI) |
| `skillPackageBuilder.reorderGroupSkills` | update     | Reassign `sequence` values for skills within a group                                                        |

> **Note:** Delete procedures must check whether any skill checks have been recorded against the affected skills before deleting. If recorded checks exist, the record must be soft-deleted (status set to `Deleted`) rather than hard-deleted, so that existing `SkillCheck` and `SkillCheckSession` records continue to reference valid skill records. This applies to `deleteSkill`, `deleteGroup` (and by extension all skills within it), and `deletePackage` (and all groups and skills within it). This check is not yet implemented.

---

## Pages & Routes

| Page                                                                                  | Description                                                       |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/orgs/[slug]/skill-package-builder`                                                  | Module index — list of all packages                               |
| `/orgs/[slug]/skill-package-builder/packages/[package_id]`                            | Package detail — fields and group/skill contents                  |
| `/orgs/[slug]/skill-package-builder/packages/[package_id]/--update`                   | Edit package fields                                               |
| `/orgs/[slug]/skill-package-builder/packages/[package_id]/history`                    | Package change history — audit log events _(not yet implemented)_ |
| `/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]`          | Group detail — fields and skill contents                          |
| `/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/--update` | Edit group fields                                                 |
| `/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]`          | Skill detail — all fields                                         |
| `/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/--update` | Edit skill fields                                                 |

---

## Relationship to the Skills Module

The Skills module consumes published packages via **subscriptions** (`SkillPackageSubscription`). A subscription links an organisation to a package and can carry per-group (`SkillGroupOverride`) and per-skill (`SkillOverride`) overrides that adjust inclusion and frequency without modifying the source package. The Skill Package Builder module is the authoring side only; subscription management lives in the Skills module.
