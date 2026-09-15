/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Deliberately NOT marked `server-only` and deliberately free of any `@/server/prisma` import:
 * routers (which are exercised from the jsdom test environment) need to invalidate this cache
 * after changing a membership or role, and they cannot pull in `@/server/organization-user` to
 * do it. Tests mock this module — `revalidateTag` throws outside a Next.js request/render store.
 */

import { revalidateTag } from "next/cache";

/**
 * The cache tag under which a user's organization roles are cached, across every organization
 * they belong to — see `getOrganizationUserRoles` in `@/server/organization-user`.
 */
export function organizationUserCacheTag(userId: string) {
    return `organization-user-${userId}`;
}

/**
 * Revalidate the cache for an organization user. Call this after any write that changes a
 * membership's existence or `role` — `organizationUser.create`/`update`/`delete`(`Many`), and
 * Better Auth's `afterAcceptInvitation` hook, which creates the membership itself.
 *
 * @param user_id The ID of the user.
 */
export async function revalidateOrganizationUser(user_id: string) {
    revalidateTag(organizationUserCacheTag(user_id), { expire: 0 });
}
