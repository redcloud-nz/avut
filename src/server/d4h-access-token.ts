/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cacheTag, revalidateTag } from "next/cache";

import { D4hAccessToken as D4hAccessTokenRecord } from "@/generated/prisma/client";

import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";

import prisma from "./prisma";
import { getOrganizationSettings } from "./organization-settings";

type GetD4HAccessTokenArguments = { tokenId: string } & (
    | { organizationId: OrganizationId; userId?: never }
    | { organizationId?: never; userId: UserId }
);

async function fetchD4HAccessToken(
    tokenId: string,
): Promise<D4hAccessTokenRecord | null> {
    "use cache";
    cacheTag(`d4h-access-token-${tokenId}`);

    return await prisma.d4hAccessToken.findUnique({
        where: {
            id: tokenId,
        },
    });
}

export function revalidateD4HAccessToken(tokenId: string) {
    revalidateTag(`d4h-access-token-${tokenId}`, { expire: 0 });
}

export async function getD4HAccessToken(
    args: GetD4HAccessTokenArguments,
): Promise<D4HAccessToken_ServerOnly | null> {
    const record = await fetchD4HAccessToken(args.tokenId);

    if (!record) return null;

    if (args.organizationId && record.organizationId !== args.organizationId) {
        return null;
    }

    if (args.userId && record.userId !== args.userId) {
        return null;
    }

    return D4HAccessToken_ServerOnly.fromRecord(record);
}

/**
 * Geth the D4H Access Token configured for the D4H Views module for the given organization.
 * @throws If the token is not found or if the module is not enabled.
 */
export async function getConfiguredD4HViewsAccessToken(
    organizationId: OrganizationId,
): Promise<D4HAccessToken_ServerOnly> {
    const settings = await getOrganizationSettings(organizationId);

    if (settings.modules["d4h-views"].enabled === false)
        throw new Error(
            "D4H Views module is not enabled for this organization.",
        );

    const accessTokenId = settings.integrations.d4h.syncToken;

    if (!accessTokenId)
        throw new Error(
            "D4H Views module is not configured properly. No sync token found.",
        );

    const accessToken = await getD4HAccessToken({
        tokenId: accessTokenId,
        organizationId,
    });

    if (!accessToken) {
        throw new Error("D4H Access Token not found");
    }

    return accessToken;
}
