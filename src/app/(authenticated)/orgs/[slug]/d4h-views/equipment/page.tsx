/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment
 */

"use client";

import { D4HAccessToken } from "@/lib/schemas/d4h-access-token";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";
import prisma from "@/server/prisma";

export default async function D4HViewsModule_Equipment_Page(
    props: PageProps<`/orgs/[slug]/d4h-views/equipment`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);

    if (settings.modules["d4h-views"].enabled === false)
        throw new Error(
            "D4H Views module is not enabled for this organization.",
        );

    const accessTokenId = settings.integrations.d4h.syncToken;

    if (!accessTokenId)
        throw new Error(
            "D4H Views module is not configured properly. No sync token found.",
        );

    const record = await prisma.d4hAccessToken.findUnique({
        where: {
            id: accessTokenId,
            organizationId: organization.id,
        },
    });

    if (!record) {
        throw new Error("Token not found");
    }

    const token = D4HAccessToken.fromRecord(record);
}
