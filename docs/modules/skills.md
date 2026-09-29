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

The unique constraint `(assesseeId, assessorId, sessionId, skillId)` prevents duplicate checks for the same assessor–assessee–skill combination within a session. The recorder UI writes one check at a time: `setSessionSkillCheck` upserts on this constraint (so a double tap can't create a duplicate), and `deleteSessionSkillCheck` deletes the caller's own check on it.

The assessor is always derived server-side from the calling user's linked `Person` record (`organizationUser.personId`); the client does not pass an `assessorId` to `setSessionSkillCheck` or `deleteSessionSkillCheck`.

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

### `skillPackageSubscriptions` router (`skillPackageSubscriptionsRouter`)

| Procedure                                          | Permission                          | Description                                                             |
| -------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `skillPackageSubscriptions.getPackage`             | skillPackageSubscription: view      | Get a single published skill package with subscription and contents     |
| `skillPackageSubscriptions.listPackages`           | skillPackageSubscription: view      | List all published packages with subscription status for the org        |
| `skillPackageSubscriptions.listSubscribedPackages` | skillPackageSubscription: view      | List packages the org is currently subscribed to                        |
| `skillPackageSubscriptions.subscribeToPackage`     | skillPackageSubscription: subscribe | Subscribe the org to a published package; errors if already subscribed  |
| `skillPackageSubscriptions.unsubscribeFromPackage` | skillPackageSubscription: subscribe | Unsubscribe the org from a package; errors if not currently subscribed  |
| `skillPackageSubscriptions.listAssessableSkills`   | skillPackageSubscription: view      | List all skill packages, groups, and skills available via subscriptions |

### `skillCheckSessions` router (`skillCheckSessionsRouter`)

| Procedure                                    | Permission                                    | Description                                                                                                    |
| -------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `skillCheckSessions.approveSession`          | skillCheckSession: update, skillCheck: update | Approves a session by stamping each check as Include/Exclude and moving session to Include status              |
| `skillCheckSessions.createSession`           | skillCheckSession: create                     | Create a new session with caller as sole assessor                                                              |
| `skillCheckSessions.deleteSession`           | skillCheckSession: delete                     | Delete a session                                                                                               |
| `skillCheckSessions.deleteSessionSkillCheck` | skillCheckSession: update, skillCheck: create | Delete the caller's own check for one assessee and skill in a session; assessorId is derived server-side       |
| `skillCheckSessions.getSession`              | skillCheckSession: view                       | Get a session by ID                                                                                            |
| `skillCheckSessions.getSessionMetrics`       | skillCheckSession: view                       | Return assessee, skill, and check counts for a session                                                         |
| `skillCheckSessions.listSessionAssessees`    | skillCheckSession: view                       | List personnel assigned as assessees                                                                           |
| `skillCheckSessions.listSessionAssessors`    | skillCheckSession: view                       | List personnel assigned as assessors                                                                           |
| `skillCheckSessions.listSessionSkills`       | skillCheckSession: view                       | List skills assigned to a session                                                                              |
| `skillCheckSessions.listSessions`            | skillCheckSession: view                       | List all sessions for the org                                                                                  |
| `skillCheckSessions.nextSessionNumber`       | skillCheckSession: view                       | Get advisory next available session number                                                                     |
| `skillCheckSessions.setSessionSkillCheck`    | skillCheckSession: update, skillCheck: create | Create or update the caller's check for one assessee and skill in a session; assessorId is derived server-side |
| `skillCheckSessions.updateSession`           | skillCheckSession: update                     | Update session name, date, notes, and status                                                                   |
| `skillCheckSessions.updateSessionAssessees`  | skillCheckSession: update                     | Add or remove assessees from a session                                                                         |
| `skillCheckSessions.updateSessionSkills`     | skillCheckSession: update                     | Add or remove skills from a session                                                                            |

### `skillChecks` router (`skillChecksRouter`)

| Procedure                                 | Permission         | Description                                                                            |
| ----------------------------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| `skillChecks.createSkillCheck`            | skillCheck: create | Create a single check; optionally linked to a session                                  |
| `skillChecks.deleteSkillCheck`            | skillCheck: delete | Delete a single check                                                                  |
| `skillChecks.getCompetencyMatrix`         | skillCheck: view   | Get matrix data for all skills and assessees in scope                                  |
| `skillChecks.getRecentSessionSkillChecks` | skillCheck: view   | List recently updated checks for a session                                             |
| `skillChecks.getRecentSkillChecks`        | skillCheck: view   | List recently updated checks for the organization                                      |
| `skillChecks.listSkillChecks`             | skillCheck: view   | List checks filtered by sessionId, skillId, assesseeId, assessorId, or `ownChecksOnly` |
| `skillChecks.updateSkillCheck`            | skillCheck: update | Update a single check's result and notes                                               |

---

## Pages & Routes

| Page                                               | Description                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `/orgs/[slug]/skills`                              | Module index                                                       |
| `/orgs/[slug]/skills/catalogue`                    | Catalogue of all published skill packages                          |
| `/orgs/[slug]/skills/catalogue/[package_id]`       | Published package detail — groups, skills, and subscription action |
| `/orgs/[slug]/skills/checks`                       | Skill checks view                                                  |
| `/orgs/[slug]/skills/reports`                      | Reports view                                                       |
| `/orgs/[slug]/skills/sessions`                     | Sessions list                                                      |
| `/orgs/[slug]/skills/sessions/[session_id]`        | Session detail — fields, navigation to sub-pages                   |
| `/orgs/[slug]/skills/sessions/[session_id]/record` | Recording interface — Details / By Person / By Skill tabs          |

### Recorder UI

The recorder page (`…/record`) has three tabs:

- **Details** — session metadata summary
- **By Person** — record checks for each assessee across all skills in the session
- **By Skill** — record checks for each skill across all assessees in the session

Both grid views record each check as it's tapped or saved: `skillCheckSessions.setSessionSkillCheck` records a result (and notes), and `skillCheckSessions.deleteSessionSkillCheck` clears one. Both reject an assessee or skill that isn't part of the session.

---

## Relationship to Skill Package Builder

The Skills module is the consumer side; the [Skill Package Builder](skill-package-builder.md) is the authoring side. Packages must be published (`published = true`, `status = Active`) before they appear in the catalogue and can be subscribed to. Unpublishing an already-subscribed package does not affect existing subscriptions.
