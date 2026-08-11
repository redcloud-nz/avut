/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { headers as nextHeaders } from "next/headers";
import { cache } from "react";

import { ForbiddenError } from "@/lib/errors";
import { Permissions } from "@/lib/permissions";
import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { auth, AuthSession } from "./auth";
import { getOrganizationBySlug } from "./organization";
import { getOrganizationSettings } from "./organization-settings";
import { requireSession } from "./session";

export interface OrganizationAccess {
    session: AuthSession;
    organization: OrganizationData;
    settings: OrganizationSettings;
}

/**
 * Assert that the current user holds `permissions` within `organizationId`.
 *
 * Better Auth signals denial two different ways, and both have to be handled: it *throws*
 * UNAUTHORIZED when the user is not a member of the organization at all, and it *returns*
 * `{ success: false }` when they are a member but lack the permission. Checking only the
 * throw silently grants every permission to every member.
 */
export async function assertPermission(
    organizationId: OrganizationId,
    permissions: Permissions,
): Promise<void> {
    let granted: boolean;

    try {
        const result = await auth.api.hasPermission({
            headers: await nextHeaders(),
            body: { organizationId, permissions },
        });
        granted = result.success;
    } catch {
        throw new ForbiddenError("You are not a member of this organization.");
    }

    if (!granted) {
        throw new ForbiddenError(
            `Insufficient permissions. Requires: ${JSON.stringify(permissions)}`,
        );
    }
}

/**
 * Resolve an organization by slug, verifying that the current user is signed in and can
 * view it. Returns the session, organization and settings so callers need only one call.
 *
 * Cached per request on the slug alone — deliberately not parameterised by permissions,
 * because React `cache` keys by argument identity and a fresh object literal per call
 * would defeat deduplication every time. Use `requireOrganizationWith` for anything
 * beyond `organization:view`.
 */
export const requireOrganization = cache(async (slug: string): Promise<OrganizationAccess> => {
    // Session first, so an expired session redirects to sign-in rather than surfacing as
    // an authorization failure from Better Auth.
    const session = await requireSession();

    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);

    await assertPermission(organization.id, { organization: ["view"] });

    return { session, organization, settings };
});

/** As `requireOrganization`, additionally requiring `permissions`. */
export async function requireOrganizationWith(
    slug: string,
    permissions: Permissions,
): Promise<OrganizationAccess> {
    const access = await requireOrganization(slug);
    await assertPermission(access.organization.id, permissions);
    return access;
}
