/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { cacheTag, revalidateTag } from "next/cache";

import { OrganizationId } from "@/lib/schemas/organization";
import {
    Provider,
    ProviderCredential_ServerOnly,
    type ProviderCredentialRecord,
} from "@/lib/schemas/provider-credential";
import { UserId } from "@/lib/schemas/user";
import { decryptDBValue } from "@/server/encrypt";

import prisma from "./prisma";

/** Builds the server-only credential from its DB record, decrypting the stored token value. */
export function toServerOnlyProviderCredential(
    record: ProviderCredentialRecord,
): ProviderCredential_ServerOnly {
    return ProviderCredential_ServerOnly.schema.parse({
        ...record,
        token: decryptDBValue(record.token),
    });
}

async function fetchProviderCredential(
    credentialId: string,
): Promise<ProviderCredentialRecord | null> {
    "use cache";
    cacheTag(`provider-credential-${credentialId}`);

    return await prisma.providerCredential.findUnique({
        where: {
            id: credentialId,
        },
    });
}

export function revalidateProviderCredential(credentialId: string) {
    revalidateTag(`provider-credential-${credentialId}`, { expire: 0 });
}

export async function getOrganizationProviderCredential({
    provider,
    organizationId,
    credentialId,
}: {
    provider: Provider;
    organizationId: OrganizationId;
    credentialId: string;
}): Promise<ProviderCredential_ServerOnly | null> {
    const record = await fetchProviderCredential(credentialId);

    if (!record) return null;

    if (record.provider !== provider) return null;
    if (record.organizationId !== organizationId) return null;
    // Group-owned credentials (#198) never come back from an organization lookup.
    if (record.groupId !== null) return null;
    if (record.userId) throw new Error("Not an organization credential");

    return toServerOnlyProviderCredential(record);
}

/** Cached separately from decryption so the cache holds the encrypted record, never the
 * plaintext token. */
async function fetchPersonalProviderCredentialRecord(
    provider: Provider,
    organizationId: OrganizationId,
    userId: UserId,
): Promise<ProviderCredentialRecord | null> {
    "use cache";
    cacheTag(`provider-credential-personal-${provider}-${organizationId}-${userId}`);

    return await prisma.providerCredential.findFirst({
        where: {
            provider,
            organizationId,
            userId,
        },
    });
}

/**
 * Get the personal credential for the given provider, user, and organization, if it exists.
 * @returns The personal credential, or null if it doesn't exist.
 * @remarks The record is cached, tagged with the provider/organization/user, and decrypted on
 * every call. Invalidate with `revalidatePersonalProviderCredential`.
 */
export async function getPersonalProviderCredential(
    provider: Provider,
    organizationId: OrganizationId,
    userId: UserId,
): Promise<ProviderCredential_ServerOnly | null> {
    const record = await fetchPersonalProviderCredentialRecord(provider, organizationId, userId);

    return record ? toServerOnlyProviderCredential(record) : null;
}

export function revalidatePersonalProviderCredential(
    provider: Provider,
    organizationId: OrganizationId,
    userId: UserId,
) {
    revalidateTag(`provider-credential-personal-${provider}-${organizationId}-${userId}`, {
        expire: 0,
    });
}
