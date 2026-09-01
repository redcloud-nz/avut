/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Deliberately NOT marked `server-only` and deliberately free of any `@/server/prisma` import:
 * routers (which are exercised from the jsdom test environment) need to invalidate the settings
 * cache, and they cannot pull in `@/server/organization-settings` to do it. Tests mock this
 * module — `revalidateTag` throws outside a Next.js request/render store.
 */

import { revalidateTag } from "next/cache";

/**
 * The cache tag under which an organization's settings are cached.
 */
export function organizationSettingsCacheTag(organizationId: string) {
    return `organization-settings-${organizationId}`;
}

/**
 * Invalidate the cached settings for an organization. Must be called after any write to that
 * organization's `OrganizationConfig` rows.
 */
export async function revalidateOrganizationSettings(organizationId: string) {
    revalidateTag(organizationSettingsCacheTag(organizationId), { expire: 0 });
}
