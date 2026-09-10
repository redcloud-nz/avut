# Organization Groups

**Project:** avut
**Date:** 2026-09-10 00:00
**Source:** brainstorm session

## Idea

A first-class `OrganizationGroup` entity that binds multiple organisations together
as a sharing fabric. A group has its own identity (name/slug/logo, comparable to an
org) but is **not a navigable context** — there is no group switcher entry and no
group area; everything happens from within a member org. Membership is a
`(group, org, role, status)` relation where `role` is `overseer` or `member`. The
link grants nothing on its own: capabilities ride on top, configured in two layers —
group-level switches set by the overseer (reusing the org settings mechanism) and
per-member consent toggles set by each member.

The motivating case is the **NZRT Steering Group**: it authors skill packages and
oversees response teams, wanting cross-org reporting rolled up from those teams. A
second case is lateral file sharing between sibling member orgs (a future drive
module), which is why a group container beats a pairwise overseer→member link.

## Context / motivation

Organisations in AVUT are isolated tenants — their own teams, roles, modules, and
owned records, with the org switcher (and, per #92, a "Personal Account" pseudo-entry)
as the only crossover point. There is no way for one org to oversee several others,
or for peer orgs to share anything.

Two concrete needs:

1. **Oversight + rollup.** The NZRT Steering Group provides the standard and needs to
   see competency/currency across all member response teams. The skill-package half
   of this already has a data model — `SkillPackage.published` plus
   `SkillPackageSubscription` (with `SkillGroupOverride` / `SkillOverride` per
   subscriber) — so one org can already publish a package and another can adopt and
   tailor it. What is missing is (a) a formal group relationship and (b) the reverse
   flow: results visible back up to the overseer.
2. **Lateral sharing.** An earlier drive-module design outlined a standalone
   file-sharing mechanism. With groups, that collapses to "share this file tree to
   group G" and every co-member gets read access.

Group membership and package subscription are deliberately **separate** — being in
the NZRT group is not defined by subscribing to the NZRT package.

## Options considered

**Group as a new entity vs. reuse `Organization`.**
Reusing `Organization` gets admin/roles/teams/modules/audit-log for free, and the
Steering Group already behaves like an org (it has admins; it authors packages via
the org-scoped `skill-package-builder` module). But once lateral sibling sharing is
in scope, a vertical overseer→member link can only represent siblings implicitly
(same overseer) and lateral capabilities are awkward to hang off a pairwise vertical
link. **Kept:** a first-class `OrganizationGroup` container with its own identity,
plus membership with roles. The overseer is a member with an elevated role.

**Membership shape: `parentOrgId` on `Organization` vs. join table.**
A parent pointer is a one-level hierarchy and couples the relationship lifecycle to
the org record. **Kept:** an explicit `OrganizationGroupMembership` join table —
many-to-many (an org can answer to more than one group), with its own status
lifecycle (invited → active → revoked).

**Consent model: what the link grants.**
Rejected: the link automatically granting reporting/sharing access. **Kept:** the
link is purely a channel. Capabilities are a small fixed vocabulary (not full role
definitions like `permissions.ts`), configured in two ways:

- **Group-level switches** — the overseer enables a capability for the whole group
  (e.g. file-sharing on, skill-reporting rollup on). Implemented with the **same
  settings mechanism as organisations** (an `OrganizationGroupConfig` equivalent of
  `OrganizationConfig`, keyed by group).
- **Per-member consent toggles** — each member org decides what actually flows (e.g.
  "share our skill reporting upward to the overseer", "participate in file sharing").

**Context crossover.**
Rejected: groups appearing in the org switcher as a navigable context with their own
sidebar. **Kept:** no crossover. The overseer manages the group (members,
invitations, settings, reporting views) from a section inside the overseer org; each
member org sees "groups we belong to" + invitations + consent toggles inside its own
admin. The group's identity/branding is used only when displaying the group in lists
and on shared resources.

**Drive module scoping.**
Rejected: making the drive module `scope: "group"` (a third data-ownership scope from
#92). **Kept:** files stay **org-owned and org-managed** (`scope: "org"`); the new
capability is an action — "share this file tree to group G" — and co-members get read
access. Groups therefore do **not** require the #92 ModuleScope rework, though they
are conceptually adjacent.

**Who can create a group / v1 scope.**
Governance of "who is allowed to create a group" and the whole invitation/accept flow
and its UI are real open costs. **Kept for v1:** group creation and group membership
are configured entirely from the **system admin** area. This bypasses the creation-
governance question and most of the org-facing UI. The overseer/member invite→accept
flow is the intended end state, not v1.

## Open questions

- **Reporting rollup content.** Not designed. Per-team currency summaries against a
  shared package vs. drill-through to named individuals and individual skill checks
  across org boundaries — very different privacy/consent conversations. The
  per-member consent toggle is the control point regardless.
- **Data flow for rollup.** Live cross-org read (permission-checked; member revokes →
  overseer loses access) vs. copy/push into the overseer. Live read is cleaner but
  crosses tenant boundaries in queries.
- **v1 org-facing UI.** Whether v1 has _any_ org-facing group UI (leanest: system
  admin sets consent toggles too; only the _effects_ are org-visible) or keeps just
  the per-member consent toggle in the member's own admin. Left for the spec.
- **Group-context access / permissions.** Org `admin` only to start. A group-level
  permissions vocabulary (who in a member org may configure consent, view rollups,
  share trees) comes later — likely new entries alongside `permissions.ts`.
- **Group roles beyond overseer/member.** Whether a group ever needs multiple
  overseers, or member sub-roles.
- **Audit logging.** `ctx.logEvent` scopes today are `organization` / `user` /
  `system` (AGENTS.md). Group-level actions (invite, revoke, toggle a group switch)
  need a home — a fourth scope, or logged against the overseer org.
- **D4H.** Out of scope for now; unclear whether D4H-derived data ever rolls up.

## Notes

- **Prior art / entry points:**
  - `prisma/schema.prisma` — `Organization`, `OrganizationConfig` (settings
    mechanism to mirror for groups), `OrganizationUser`, `OrganizationInvitation`
    (invite/accept pattern to mirror later), `SkillPackage` (`published`),
    `SkillPackageSubscription` + `SkillGroupOverride` / `SkillOverride` (the existing
    cross-org adoption model).
  - `src/lib/modules.ts` — module registry; a future drive module registers here,
    `scope: "org"`.
  - `src/lib/permissions.ts` — where group-level permission statements would land.
  - `src/server/system-admin-access.ts`, `src/app/(authenticated)/…/system-admin/` —
    where v1 group creation/membership config lives.
  - `src/trpc/init.ts` — `organizationProcedure` / `authenticatedProcedure` /
    `systemAdminProcedure`; group mutations in v1 go through `systemAdminProcedure`.
- **Related idea:** `docs/ideas/` — #92 pseudo global-org / three-way `ModuleScope`
  (organization/user/system). Groups are adjacent (a fourth scope-like concept) but
  intentionally do not depend on that rework.
- The earlier standalone drive/file-sharing design (the "whole sharing mechanism"
  referenced in conversation) is superseded by "share tree to group" if groups land
  first.
- Proposed models (sketch, not committed):
  ```
  OrganizationGroup            { id, name, slug, logo, createdAt, … }
  OrganizationGroupMembership  { groupId, orgId, role: overseer|member,
                                 status: invited|active|revoked, createdAt, … }
  OrganizationGroupConfig      { groupId, key, value }   // mirrors OrganizationConfig
  ```
