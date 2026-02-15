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
