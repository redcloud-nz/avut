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
    type ProviderCredentialId,
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
    credentialId: ProviderCredentialId,
): Promise<ProviderCredentialRecord | null> {
    "use cache";
    cacheTag(`provider-credential-${credentialId}`);

    return await prisma.providerCredential.findUnique({
        where: {
            id: credentialId,
        },
    });
}

export function revalidateProviderCredential(credentialId: ProviderCredentialId) {
    revalidateTag(`provider-credential-${credentialId}`, { expire: 0 });
}

/**
 * Identifies a stored credential together with the owner it must belong to. It holds no secret,
 * so it is safe to pass as an argument to a `"use cache"` function (where it becomes part of the
 * cache key).
 */
export type ProviderCredentialRef = {
    provider: Provider;
    credentialId: ProviderCredentialId;
    organizationId: OrganizationId;
    userId: UserId | null; // null → organization credential
};

/**
 * Get the credential a reference points to, if it is owned exactly as the reference says.
 * @returns The decrypted credential, or null if the record is missing, is group-owned, or its
 * provider, organization, or user doesn't match the reference.
 * @remarks Only the encrypted record read is cached; the ownership check and decryption run on
 * every call, so a reference with the wrong owner never gets a cached record back.
 */
export async function getProviderCredentialForOwner(
    ref: ProviderCredentialRef,
): Promise<ProviderCredential_ServerOnly | null> {
    const record = await fetchProviderCredential(ref.credentialId);

    if (!record) return null;

    if (record.provider !== ref.provider) return null;
    if (record.organizationId !== ref.organizationId) return null;
    // Group-owned credentials (#198) never come back from an owner lookup.
    if (record.groupId !== null) return null;
    // Exact match: an organization ref never returns a personal credential (which carries its
    // organization's ID too), and a personal ref never returns the organization's or another
    // member's.
    if (record.userId !== ref.userId) return null;

    return toServerOnlyProviderCredential(record);
}

/** Get the organization's own credential by ID: `getProviderCredentialForOwner` with no user. */
export async function getOrganizationProviderCredential(args: {
    provider: Provider;
    organizationId: OrganizationId;
    credentialId: ProviderCredentialId;
}): Promise<ProviderCredential_ServerOnly | null> {
    return getProviderCredentialForOwner({ ...args, userId: null });
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
