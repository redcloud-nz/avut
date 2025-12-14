/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag, revalidateTag } from "next/cache";
import { notFound } from "next/navigation";

import {
    OrganizationData,
    OrganizationWithSettings,
} from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import prisma from "./prisma";

export async function getOrganizationBySlug(
    slug: string,
): Promise<OrganizationWithSettings> {
    "use cache";
    cacheTag(`organization-${slug}`);

    const record = await prisma.organization.findUnique({
        where: { slug },
    });

    if (!record) return notFound();

    const configRecords = await prisma.organizationConfig.findMany({
        where: { organizationId: record.id },
    });

    return {
        ...OrganizationData.fromRecord(record),
        settings: OrganizationSettings.fromRecords(configRecords),
    };
}

export async function revalidateOrganization(slug: string) {
    revalidateTag(`organization-${slug}`, { expire: 0 });
}
