/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Deliberately free of any `@/server/prisma` import: routers (which are exercised from the
 * jsdom test environment) need to invalidate the settings cache, and they cannot pull in
 * `@/server/cache/user-settings` to do it. Tests mock this module — `revalidateTag` throws
 * outside a Next.js request/render store.
 */

import "server-only";

import { revalidateTag } from "next/cache";

/**
 * The cache tag under which a user's settings are cached.
 */
export function userSettingsCacheTag(userId: string) {
    return `user-settings-${userId}`;
}

/**
 * Invalidate the cached settings for a user. Must be called after any write to that user's
 * `UserConfig` rows.
 */
export async function revalidateUserSettings(userId: string) {
    revalidateTag(userSettingsCacheTag(userId), { expire: 0 });
}
