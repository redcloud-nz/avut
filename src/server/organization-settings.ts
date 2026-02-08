/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag, revalidateTag } from "next/cache";

import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import prisma from "./prisma";
import { OrganizationId } from "@/lib/schemas/organization";

/**
 * Get the organization settings for a given organization ID. This function is cached and will revalidate when settings are updated.
 */
export async function getOrganizationSettings(
    organizationId: OrganizationId,
): Promise<OrganizationSettings> {
    "use cache";
    cacheTag(`organization-settings-${organizationId}`);

    const configRecords = await prisma.organizationConfig.findMany({
        where: { organizationId },
    });

    return OrganizationSettings.fromRecords(configRecords);
}

export async function revalidateOrganizationSettings(
    organizationId: OrganizationId,
) {
    revalidateTag(`organization-settings-${organizationId}`, { expire: 0 });
}
