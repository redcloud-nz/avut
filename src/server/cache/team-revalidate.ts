/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Deliberately free of any `@/server/prisma` import: routers (which are exercised from the jsdom
 * test environment) need to invalidate the team cache, and they cannot pull in
 * `@/server/cache/team` to do it. Tests mock this module — `revalidateTag` throws outside a
 * Next.js request/render store.
 */

import "server-only";

import { revalidateTag } from "next/cache";

/**
 * The cache tag under which a team, looked up by its slug, is cached.
 */
export function teamCacheTag(slug: string) {
    return `team-${slug}`;
}

/**
 * Invalidate the cached team for a slug. Must be called after any write to a `Team` row (or its
 * `Team_D4H` link) that holds a slug, for both slugs when the slug changes. A team without a slug
 * has nothing cached, so `null` is a no-op.
 */
export async function revalidateTeam(slug: string | null) {
    if (slug === null) return;
    revalidateTag(teamCacheTag(slug), { expire: 0 });
}
