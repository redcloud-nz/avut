/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { NotConfiguredError } from "@/lib/errors";
import { D4HAccessToken_ServerOnly, D4HProviderMetadata } from "@/lib/schemas/d4h-access-token";
import { OrganizationId } from "@/lib/schemas/organization";
import type {
    ProviderCredential_ServerOnly,
    ProviderCredentialRecord,
} from "@/lib/schemas/provider-credential";
import { UserId } from "@/lib/schemas/user";

import { getOrganizationSettings } from "./cache/organization-settings";
import {
    getOrganizationProviderCredential,
    getPersonalProviderCredential,
    revalidatePersonalProviderCredential,
    revalidateProviderCredential,
    toServerOnlyProviderCredential,
} from "./provider-credential";

/** Flattens a generic `ProviderCredential_ServerOnly` (D4H's metadata union member) back into
 * the flat `D4HAccessToken_ServerOnly` shape D4H's own code (`d4h-api/client.ts` etc.) expects. */
function toD4HAccessToken_ServerOnly(
    credential: ProviderCredential_ServerOnly,
): D4HAccessToken_ServerOnly {
    const { serverCode, d4HTeams, d4HOrganisations } = D4HProviderMetadata.schema.parse(
        credential.metadata,
    );

    return D4HAccessToken_ServerOnly.schema.parse({
        id: credential.id,
        organizationId: credential.organizationId,
        userId: credential.userId,
        label: credential.label,
        serverCode,
        token: credential.token,
        metadata: { d4HTeams, d4HOrganisations },
    });
}

/** Builds the server-only token from its DB record, decrypting the stored token value. */
export function toServerOnlyD4HAccessToken(
    record: ProviderCredentialRecord,
): D4HAccessToken_ServerOnly {
    return toD4HAccessToken_ServerOnly(toServerOnlyProviderCredential(record));
}

export async function getOrganizationD4HAccessToken({
    organizationId,
    tokenId,
}: {
    organizationId: OrganizationId;
    tokenId: string;
}): Promise<D4HAccessToken_ServerOnly | null> {
    const credential = await getOrganizationProviderCredential({
        provider: "D4H",
        organizationId,
        credentialId: tokenId,
    });

    return credential ? toD4HAccessToken_ServerOnly(credential) : null;
}

export function revalidateD4HAccessToken(tokenId: string) {
    revalidateProviderCredential(tokenId);
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
    const credential = await getPersonalProviderCredential("D4H", organizationId, userId);

    return credential ? toD4HAccessToken_ServerOnly(credential) : null;
}

export function revalidatePersonalD4HAccessTokenForUser(
    organizationId: OrganizationId,
    userId: UserId,
) {
    revalidatePersonalProviderCredential("D4H", organizationId, userId);
}

/**
 * Get the personal D4H Access Token for the given user, verifying that the D4H integration is enabled.
 * @throws If the D4H integration is not enabled or the user has no personal token.
 */
export async function getConfiguredD4HAccessToken(
    organizationId: OrganizationId,
    userId: UserId,
): Promise<D4HAccessToken_ServerOnly> {
    const settings = await getOrganizationSettings(organizationId);

    if (settings.integrations.d4h.enabled === false) {
        throw new NotConfiguredError("D4H integration is not enabled for this organisation.");
    }

    const personalToken = await getPersonalD4HAccessTokenForUser(organizationId, userId);

    if (!personalToken) {
        throw new NotConfiguredError(
            "No personal D4H Access Token configured. Please create one in your account settings.",
        );
    }

    return personalToken;
}
