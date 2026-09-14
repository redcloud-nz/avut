# Streamline linking people to users

**Project:** avut
**Date:** 2026-09-14 08:42

## Idea

Linking a `Person` to a `User` is currently a manual, after-the-fact step, even though almost every link is predictable from an email address. Four changes close that gap: invite someone directly from their person record, and auto-link on the three moments where a person and a user become known to each other (invite accepted, person added, user signs up). Each automatic behaviour is gated by a new organization setting, so an org that wants the manual workflow keeps it.

## The four parts

1. **Invite from the person page.** A dropdown action on the person detail page that creates an `OrganizationInvitation` with `personId` set. **The server half already works** — `afterAcceptInvitation` (`src/server/auth.ts:130-145`) already copies `invitation.personId` onto the accepting user's `OrganizationUser`. This is a UI + mutation task only.
2. **Auto-link on invite accept.** When an invitation is accepted and carries no `personId`, look for a `Person` in that org with the same email and link it. Same hook as (1), just the fallback branch.
3. **Auto-link on person create.** When a person is added and a `User` with that email already exists, link them — **only if that user is already a member of the organization** (fill in `OrganizationUser.personId`). A non-member is left alone; they still get invited via (1). An email match never grants membership.
4. **Auto-invite on signup.** When a user signs up, if a `Person` in any org with the setting enabled matches their email, prompt "would you like to join <org>?". Accepting creates the membership and the link. **Org opt-in only** — no per-person flag; the org-level setting is the whole gate.

## Notes

- **Link target:** `OrganizationUser.personId` (`String? @unique`, `onDelete: SetNull`) is the link. `OrganizationInvitation.personId` is likewise `String? @unique` and already threaded through accept.
- **Email match is already constrained** by `Person @@unique([organizationId, email])` — at most one candidate person per org per email, so no ambiguity to resolve on the person side.
- **Collisions to handle:** both `personId` columns are `@unique`, so all four paths must tolerate "that person is already linked to a different user" and "this user is already linked to a different person in this org" without throwing a raw Prisma P2002 at the user.
- **Case sensitivity:** `Person.email` is a plain `String` with a unique index — decide whether matching normalises case before relying on it.
- **Settings:** `OrganizationSettings` (`src/lib/schemas/organization-settings.ts`) has no personnel section yet; 2/3/4 would add one (e.g. `personnel: { autoLinkOnInviteAccept, autoLinkOnPersonCreate, autoJoinOnSignup }`), plus admin UI to toggle them.
- **Audit logging:** every auto-link is a state change on an org record, so each needs a `ctx.logEvent` (or, for the better-auth hook paths that sit outside a tRPC procedure, a `recordLogEntry` with a `batchId` — `recordLogEntry` only permits a null actor alongside a batch, and an auto-link has no human actor).
- **Hook seams:** (1) and (2) both live in `organizationHooks.afterAcceptInvitation`. (3) lives in the person-create mutation. (4) needs a signup-time hook plus a post-signup prompt UI.
