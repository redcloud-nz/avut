/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag } from "next/cache";

import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import prisma from "./prisma";
import { organizationSettingsCacheTag } from "./organization-settings-cache";
import { readOrganizationSettings } from "./organization-settings-store";
import { OrganizationId } from "@/lib/schemas/organization";

export { revalidateOrganizationSettings } from "./organization-settings-cache";
export { readOrganizationSettings, writeOrganizationSettings } from "./organization-settings-store";

/**
 * Get the organization settings for a given organization ID. This function is cached and will revalidate when settings are updated.
 *
 * Keys purely on `organizationId` — there is no session or membership check here.
 */
export async function getOrganizationSettings(
    organizationId: OrganizationId,
): Promise<OrganizationSettings> {
    "use cache";
    cacheTag(organizationSettingsCacheTag(organizationId));

    return await readOrganizationSettings(prisma, organizationId);
}
