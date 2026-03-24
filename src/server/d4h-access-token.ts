/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { cacheTag, revalidateTag } from "next/cache";

import { D4hAccessToken as D4hAccessTokenRecord } from "@/generated/prisma/client";

import { NotConfiguredError } from "@/lib/errors";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";

import { decryptDBValue } from "./encrypt";
import prisma from "./prisma";
import { getOrganizationSettings } from "./organization-settings";

type GetD4HAccessTokenArguments = { tokenId: string } & (
    | { organizationId: OrganizationId; userId?: never }
    | { organizationId?: never; userId: UserId }
);

async function fetchD4HAccessToken(tokenId: string): Promise<D4hAccessTokenRecord | null> {
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
 * Get the personal D4H Access Token for the given user and organization, if it exists.
 * @returns The personal D4H Access Token for the user, or null if it doesn't exist.
 * @remarks This function uses caching to optimize performance. The cache is tagged with the organization and user ID, and can be invalidated using `revalidatePersonalD4HAccessTokenForUser`.
 */
export async function getPersonalD4HAccessTokenForUser(
    organizationId: OrganizationId,
    userId: UserId,
): Promise<D4HAccessToken_ServerOnly | null> {
    "use cache";
    cacheTag(`d4h-personal-access-token-${organizationId}-${userId}`);

    const record = await prisma.d4hAccessToken.findFirst({
        where: {
            organizationId,
            userId,
        },
    });

    if (!record) return null;

    return D4HAccessToken_ServerOnly.fromRecord({
        ...record,
        token: decryptDBValue(record.token),
    });
}

export function revalidatePersonalD4HAccessTokenForUser(
    organizationId: OrganizationId,
    userId: UserId,
) {
    revalidateTag(`d4h-personal-access-token-${organizationId}-${userId}`, {
        expire: 0,
    });
}

/**
 * Get the D4H Access Token configured.
 * @throws If the token is not found or if the module is not enabled.
 */
export async function getConfiguredD4HAccessToken(
    organizationId: OrganizationId,
    userId: UserId,
    options: {
        module: "d4h-views" | "i3";
        action: "read" | "write";
    },
): Promise<D4HAccessToken_ServerOnly> {
    const settings = await getOrganizationSettings(organizationId);

    if (settings.integrations.d4h.enabled === false) {
        throw new NotConfiguredError("D4H integration is not enabled for this organization.");
    }

    const moduleSettings = settings.modules[options.module];

    if (moduleSettings.enabled === false)
        throw new NotConfiguredError(
            `${options.module} module is not enabled for this organization.`,
        );

    if (
        (options.action == "read" && moduleSettings.d4hReadStrategy === "PersonalToken") ||
        (options.action == "write" && moduleSettings.d4hWriteStrategy === "PersonalToken")
    ) {
        const personalToken = await getPersonalD4HAccessTokenForUser(organizationId, userId);

        if (!personalToken) {
            throw new NotConfiguredError(
                "No personal D4H Access Token configured. Please create one in your account settings.",
            );
        }

        return personalToken;
    } else {
        // Shared token policy

        const tokenId = moduleSettings.d4hSharedTokenId;

        if (!tokenId) {
            throw new NotConfiguredError(
                `No shared D4H Access Token configured for ${module} module. Please configure one in the organization settings.`,
            );
        }

        const accessToken = await getD4HAccessToken({
            tokenId,
            organizationId,
        });

        if (!accessToken) {
            throw new NotConfiguredError(
                `The configured D4H Access Token for ${module} module was not found. It may have been deleted. Please check the organization settings.`,
            );
        }

        return accessToken;
    }
}
