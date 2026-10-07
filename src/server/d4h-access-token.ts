/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { revalidateTag } from "next/cache";

import { NotConfiguredError } from "@/lib/errors";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { D4HProviderMetadata } from "@/lib/schemas/d4h-provider-metadata";
import { OrganizationId } from "@/lib/schemas/organization";
import type {
    ProviderCredential_ServerOnly,
    ProviderCredentialId,
    ProviderCredentialRecord,
} from "@/lib/schemas/provider-credential";
import { UserId } from "@/lib/schemas/user";

import { getOrganizationSettings } from "./cache/organization-settings";
import {
    getOrganizationProviderCredential,
    getPersonalProviderCredential,
    getProviderCredentialForOwner,
    revalidatePersonalProviderCredential,
    revalidateProviderCredential,
    toServerOnlyProviderCredential,
    type ProviderCredentialRef,
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

/**
 * The bearer value to send to D4H for the given credential. This is the one place the secret is
 * read: every request gets its `Authorization` header from here (see `getD4HFetchClient`).
 * @remarks Async because an OAuth credential will refresh its access token here when it is near
 * expiry. Today every credential is an API key, so it returns the stored key as is.
 */
export async function getD4HAccessToken(credential: D4HAccessToken_ServerOnly): Promise<string> {
    return credential.token;
}

/**
 * Identifies a stored D4H credential together with the owner it must belong to
 * (`userId: null` → the organization's own credential). It holds no secret, so it is what
 * `"use cache"` functions take in place of a `D4HAccessToken_ServerOnly`.
 */
export type D4HCredentialRef = Omit<ProviderCredentialRef, "provider">;

/**
 * The reference to an already-resolved token: its ID and the owner it was resolved for.
 * @throws ZodError if the token has no `organizationId`. It expects an org-scoped token (every
 * D4H token is loaded through an organization-scoped lookup), so a null here is a broken invariant.
 */
export function toD4HCredentialRef(token: D4HAccessToken_ServerOnly): D4HCredentialRef {
    return {
        credentialId: token.id,
        organizationId: OrganizationId.schema.parse(token.organizationId),
        userId: token.userId === null ? null : UserId.schema.parse(token.userId),
    };
}

/**
 * Resolve a reference back to its token, checking that the stored credential is owned exactly
 * as the reference says.
 * @throws NotConfiguredError if the credential is missing or owned by anyone else.
 * @remarks Meant to be called inside `"use cache"` bodies, where a thrown error reaches the
 * caller as a plain `Error` with its message redacted. Callers resolve the token through a
 * scoped lookup before they get here, so this throw is defence in depth, not the user-facing
 * error path.
 */
export async function resolveD4HCredential(
    ref: D4HCredentialRef,
): Promise<D4HAccessToken_ServerOnly> {
    const credential = await getProviderCredentialForOwner({ provider: "D4H", ...ref });

    if (!credential) {
        throw new NotConfiguredError("D4H Access Token not found.");
    }

    return toD4HAccessToken_ServerOnly(credential);
}

export async function getOrganizationD4HAccessToken({
    organizationId,
    tokenId,
}: {
    organizationId: OrganizationId;
    tokenId: ProviderCredentialId;
}): Promise<D4HAccessToken_ServerOnly | null> {
    const credential = await getOrganizationProviderCredential({
        provider: "D4H",
        organizationId,
        credentialId: tokenId,
    });

    return credential ? toD4HAccessToken_ServerOnly(credential) : null;
}

export function revalidateD4HAccessToken(tokenId: ProviderCredentialId) {
    revalidateProviderCredential(tokenId);
}

/**
 * The umbrella cache tag every cached D4H API function in `d4h-api/client.ts` carries, alongside
 * its own specific tag. Clearing it drops everything cached for that credential.
 */
export function d4hApiCacheTag(credentialId: ProviderCredentialId): string {
    return `d4h-api-${credentialId}`;
}

/** Drop every cached D4H API response for the given credential (on refresh or delete). */
export function revalidateD4HApiCache(credentialId: ProviderCredentialId) {
    revalidateTag(d4hApiCacheTag(credentialId), { expire: 0 });
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
