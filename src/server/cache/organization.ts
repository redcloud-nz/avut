/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag, revalidateTag } from "next/cache";
import { notFound } from "next/navigation";

import { OrganizationData } from "@/lib/schemas/organization";
import prisma from "@/server/prisma";

export async function getOrganizationBySlug(slug: string): Promise<OrganizationData> {
    "use cache";
    cacheTag(`organization-${slug}`);

    const record = await prisma.organization.findUnique({
        where: { slug },
    });

    if (!record) return notFound();

    return OrganizationData.fromRecord(record);
}

export async function revalidateOrganization(slug: string) {
    revalidateTag(`organization-${slug}`, { expire: 0 });
}

/**
 * The cache tag on every cached entry that embeds an organization's data alongside a record of its
 * own, such as a team looked up by slug (`getTeamBySlug`), which carries its organization.
 */
export function organizationTeamsCacheTag(organizationId: string) {
    return `organization-teams-${organizationId}`;
}

/**
 * Invalidate every cached team of an organization (`organizationTeamsCacheTag`). Must be called
 * after a write to the organization's own row, alongside `revalidateOrganization`.
 */
export async function revalidateOrganizationTeams(organizationId: string) {
    revalidateTag(organizationTeamsCacheTag(organizationId), { expire: 0 });
}

export async function getAllOrganizationSlugs(): Promise<string[]> {
    const records = await prisma.organization.findMany({
        select: { slug: true },
    });
    return records.map((r) => r.slug);
}
