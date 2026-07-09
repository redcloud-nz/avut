# Skills Module

A module for subscribing to skill packages and conducting assessment sessions where assessors record competency checks against personnel.

---

## Status

Implemented.

---

## Roles & Permissions

Three permission subjects are used by this module:

| Subject             | Actions                      |
| ------------------- | ---------------------------- |
| `skills`            | view, subscribe              |
| `skillCheckSession` | view, create, update, delete |
| `skillCheck`        | view, create, update, delete |

Role assignments (the ability to assess is gated by `skillCheck` create):

| Role              | `skills`        | `skillCheckSession`          | `skillCheck`                 |
| ----------------- | --------------- | ---------------------------- | ---------------------------- |
| `owner`           | view, subscribe | view, create, update, delete | view, create, update, delete |
| `admin`           | view, subscribe | view, create, update, delete | view, create, update, delete |
| `member`          | view            | —                            | —                            |
| `skills-assessor` | view            | view, create, update, delete | view, create                 |

---

## Concepts

### Skill Package Subscription

A subscription links an organisation to a published skill package, making the package's skills available for use in sessions and reports. Each subscription can carry per-group (`SkillGroupOverride`) and per-skill (`SkillOverride`) overrides that adjust inclusion (`include`) and revalidation frequency (`frequency`) without modifying the source package. Unsubscribing removes the link but does not delete historical skill checks that referenced skills from that package.

### Skill Check Session

A named event (e.g. a training day or competency review) in which assessors evaluate assessees against a set of skills. A session holds:

- A name, date, and optional notes
- A status: `Draft`, `Include`, or `Exclude`
- A many-to-many set of **assessees** (`Person`) and **skills** (`Skill`)

`Draft` means the session is still being prepared. `Include` / `Exclude` control whether the session's checks appear in reports.

### Skill Check

An individual competency assessment for a specific assessee–skill pair. Checks may belong to a session (`sessionId`) or be recorded standalone (`sessionId` is null). Each check records:

- `assesseeId` and `assessorId` (both `Person` references)
- `skillId`
- `result` — a string value (e.g. `"Pass"`, `"Fail"`, `"Competent"`)
- `notes`
- A `status` field (`Draft` / `Include` / `Exclude`) mirroring the session-level pattern

The unique constraint `(assesseeId, assessorId, sessionId, skillId)` prevents duplicate checks for the same assessor–assessee–skill combination within a session. The `upsertSessionSkillChecks` procedure uses this constraint to safely batch create, update, and delete checks from the recorder UI.

The assessor is always derived server-side from the calling user's linked `Person` record (`organizationUser.personId`); the client does not pass an `assessorId` to `upsertSessionSkillChecks`.

---

## Data Model

### `SkillPackageSubscription`

```prisma
model SkillPackageSubscription {
  id             String       @id
  organizationId String
  skillPackageId String

  groupOverrides SkillGroupOverride[]
  skillOverrides SkillOverride[]
}
```

### `SkillGroupOverride`

```prisma
model SkillGroupOverride {
  subscriptionId String
  skillGroupId   String
  description    String?
  include        Boolean
}
```

### `SkillOverride`

```prisma
model SkillOverride {
  subscriptionId String
  skillId        String
  description    String?
  frequency      Int?     // overrides Skill.frequency when set
  include        Boolean
}
```

### `SkillCheckSession`

```prisma
model SkillCheckSession {
  id             String           @id
  organizationId String
  name           String
  startsAt       DateTime?        // exposed as `date` in the schema
  endsAt         DateTime?        // set to the same value as startsAt
  notes          String?
  status         SkillCheckStatus @default(Draft)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  assessees   Person[]
  assessors   Person[]
  skills      Skill[]
  skillChecks SkillCheck[]
}

enum SkillCheckStatus {
  Draft
  Include
  Exclude
}
```

### `SkillCheck`

```prisma
model SkillCheck {
  id             String             @id
  organizationId String
  sessionId      String?
  assesseeId     String
  assessorId     String
  skillId        String
  result         String
  notes          String
  status         SkillCheckStatus   @default(Draft)
  createdAt      DateTime           @default(now())

  @@unique([assesseeId, assessorId, sessionId, skillId])
}
```

---

## tRPC Procedures

### `skills` router (`skillsRouter`)

#### Subscription procedures

| Procedure                       | Permission        | Description                                                             |
| ------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| `skills.listPackages`           | skills: view      | List all published packages with subscription status for the org        |
| `skills.listSubscribedPackages` | skills: view      | List packages the org is currently subscribed to                        |
| `skills.subscribeToPackage`     | skills: subscribe | Subscribe the org to a published package; errors if already subscribed  |
| `skills.unsubscribeFromPackage` | skills: subscribe | Unsubscribe the org from a package; errors if not currently subscribed  |
| `skills.listAssessableSkills`   | skills: view      | List all skill packages, groups, and skills available via subscriptions |

#### Session procedures

| Procedure                       | Permission                | Description                                            |
| ------------------------------- | ------------------------- | ------------------------------------------------------ |
| `skills.listSessions`           | skills: view              | List all sessions for the org                          |
| `skills.createSession`          | skillCheckSession: create | Create a new session                                   |
| `skills.getSession`             | skillCheckSession: view   | Get a session by ID                                    |
| `skills.getSessionMetrics`      | skillCheckSession: view   | Return assessee, skill, and check counts for a session |
| `skills.updateSession`          | skillCheckSession: update | Update session name, date, notes, and status           |
| `skills.deleteSession`          | skillCheckSession: delete | Delete a session                                       |
| `skills.listSessionAssessees`   | skillCheckSession: view   | List personnel assigned as assessees                   |
| `skills.updateSessionAssessees` | skillCheckSession: update | Add or remove assessees from a session                 |
| `skills.listSessionSkills`      | skillCheckSession: view   | List skills assigned to a session                      |
| `skills.updateSessionSkills`    | skillCheckSession: update | Add or remove skills from a session                    |

### `skillChecks` router (`skillChecksRouter`)

| Procedure                              | Permission         | Description                                                                                                                      |
| -------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `skillChecks.listSkillChecks`          | skillCheck: view   | List checks filtered by sessionId, skillId, assesseeId, assessorId, or `ownChecksOnly`                                           |
| `skillChecks.createSkillCheck`         | skillCheck: create | Create a single check; optionally linked to a session                                                                            |
| `skillChecks.updateSkillCheck`         | skillCheck: update | Update a single check's result and notes                                                                                         |
| `skillChecks.deleteSkillCheck`         | skillCheck: delete | Delete a single check                                                                                                            |
| `skillChecks.upsertSessionSkillChecks` | skillCheck: update | Batch upsert/delete checks for a session; setting result to `"NotAssessed"` deletes the check; assessorId is derived server-side |

---

## Pages & Routes

| Page                                                  | Description                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `/orgs/[slug]/skills`                                 | Module index                                                       |
| `/orgs/[slug]/skills/catalogue`                       | Catalogue of all published skill packages                          |
| `/orgs/[slug]/skills/catalogue/[package_id]`          | Published package detail — groups, skills, and subscription action |
| `/orgs/[slug]/skills/checks`                          | Skill checks view                                                  |
| `/orgs/[slug]/skills/reports`                         | Reports view                                                       |
| `/orgs/[slug]/skills/sessions`                        | Sessions list                                                      |
| `/orgs/[slug]/skills/sessions/[session_id]`           | Session detail — fields, navigation to sub-pages                   |
| `/orgs/[slug]/skills/sessions/[session_id]/personnel` | Manage assessees assigned to the session                           |
| `/orgs/[slug]/skills/sessions/[session_id]/skills`    | Manage skills assigned to the session                              |
| `/orgs/[slug]/skills/sessions/[session_id]/record`    | Recording interface — Details / By Person / By Skill tabs          |

### Recorder UI

The recorder page (`…/record`) has three tabs:

- **Details** — session metadata summary
- **By Person** — record checks for each assessee across all skills in the session
- **By Skill** — record checks for each skill across all assessees in the session

Both grid views call `skillChecks.upsertSessionSkillChecks` when a cell is updated. `"NotAssessed"` is the sentinel value that causes an existing check to be deleted rather than updated.

---

## Relationship to Skill Package Builder

The Skills module is the consumer side; the [Skill Package Builder](skill-package-builder.md) is the authoring side. Packages must be published (`published = true`, `status = Active`) before they appear in the catalogue and can be subscribed to. Unpublishing an already-subscribed package does not affect existing subscriptions.
