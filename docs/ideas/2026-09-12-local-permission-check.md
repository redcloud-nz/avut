# Evaluate organization permissions locally instead of round-tripping through better-auth

**Project:** avut
**Date:** 2026-09-12 00:00
**Source:** brainstorm session

## Idea

`organizationProcedure`'s permission check (`ctx.hasPermission` → `auth.api.hasPermission`) re-fetches the caller's org membership from the database on every single tRPC call, via better-auth's own `findMemberByOrgId`. This completely bypasses `getOrganizationUserRoles` (`src/server/organization-user.ts`), a `"use cache"`-tagged lookup of the same data that's already used elsewhere in the app (`requireOrganization`, nav) and already has an invalidation path (`revalidateOrganizationUser`). Since AVUT's roles are fully static (`Roles` in `src/lib/permissions.ts`, no `dynamicAccessControl`), the actual permission math — `Roles[role].authorize(permissions)` — is a pure, synchronous, in-memory function with no DB or network access. So the fix is: fetch the caller's roles via the cached lookup, then call `.authorize(...)` locally, and stop calling `auth.api.hasPermission` (and its underlying `orgSessionMiddleware`/DB hit) at all for the common case.

## Context / motivation

Started from a different idea — running a read-only procedure's resolver concurrently with its permission check, gating the response on both. That was set aside (see below) once it became clear the actual bottleneck isn't sequencing, it's that the permission check itself does redundant, uncached work that a sibling code path in the same app has already solved.

## Options considered

- **Race the resolver against the permission check, gate the response on both** (the original framing). Rejected: today a denied caller never triggers the resolver at all (cheap fail-fast). Racing them means _every_ call pays the resolver's full query cost, denied or not — trading a cheap rejection for an expensive one. It also only saves `min(permCheckTime, queryTime)`, and the permission check is unlikely to be the slower side. Doesn't fix the actual inefficiency (the redundant DB hit), just hides it behind the resolver's own latency.
- **Reuse the cached roles lookup + local `.authorize()` call** (chosen). No behavior-changing tradeoff versus today — same fail-fast property, same DB query, just shared with the cache the rest of the app already trusts instead of a second uncached one.

## Open questions

- `getOrganizationUserRoles` calls Next's `notFound()` when the membership doesn't exist, which is a rendering-only signal — not valid to throw from a tRPC procedure context. Need a sibling (or shared helper) that returns `null` instead, so `trpc-context.ts` can translate "no membership" into the existing `FORBIDDEN` / "You are not a member of this organization" error itself.
- **Pre-existing cache-invalidation gap, surfaced during this session**: `authClient.organization.updateMemberRole` ([update-user.tsx:79](../../src/components/admin/users/update-user.tsx#L79)) and `authClient.organization.removeMember` ([delete-user.tsx:43](../../src/components/admin/users/delete-user.tsx#L43)) call better-auth's own client endpoints directly, bypassing every AVUT tRPC router and therefore `revalidateOrganizationUser`. Today this only staleness-affects display data (nav, `requireOrganization`) because permission _enforcement_ re-checks the DB live every call. Wiring enforcement to the same cache would turn this into a real (if narrow) security bug: a demoted/removed member could keep old permissions until the cache tag naturally expires.
  - Fix: move `revalidateOrganizationUser` into better-auth's `organizationHooks.afterAddMember` / `afterRemoveMember` / `afterUpdateMemberRole` (`src/server/auth.ts`), mirroring the existing `afterAcceptInvitation` hook — this centralizes invalidation at the one place no membership/role write can route around, rather than depending on every call site remembering to call it.
  - This gap exists independent of this optimization and could be fixed on its own, but it becomes a hard prerequisite once the cache backs live authorization decisions rather than just UI.
- Not measured: how much of current read-query latency `auth.api.hasPermission` actually accounts for. Worth a quick before/after timing check once implemented, since the motivating instinct was architectural rather than profiled.
- Does `assertHasPermissionResult`'s error wording/shape need to survive unchanged for any client-side error handling that pattern-matches on it? Should double check before swapping the code path.

## Notes

- Relevant entry points: `src/trpc/init.ts` (`organizationProcedure`, calls `opts.ctx.hasPermission`), `src/server/trpc-context.ts` (`hasPermission` closure — the thing to change), `src/server/organization-user.ts` (`getOrganizationUserRoles`, the cache to reuse), `src/server/organization-user-cache.ts` (`revalidateOrganizationUser`, the tag to hook up more broadly), `src/lib/permissions.ts` (`Roles`, `ac`), `src/server/auth.ts:126-158` (`organization({ ac, roles: Roles, organizationHooks: {...} })` — confirms static roles, no dynamic AC).
- better-auth internals confirmed by reading `node_modules/better-auth/dist/plugins/organization/{has-permission,permission,organization}.mjs`: `hasPermissionFn` is `roles.some(r => acRoles[r]?.authorize(permissions).success)`, identical to what `Roles[role].authorize(...)` gives locally.
