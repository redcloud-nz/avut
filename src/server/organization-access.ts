/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { forbidden } from "next/navigation";
import { cache } from "react";

import { hasAnyRoleWithPermissions, Permissions } from "@/lib/permissions";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import type { AuthSession } from "./auth";
import { getOrganizationBySlug } from "./cache/organization";
import { getOrganizationSettings } from "./cache/organization-settings";
import { getOrganizationUserRoles } from "./cache/organization-user";
import { requireSession } from "./session";

export interface OrganizationAccess {
    session: AuthSession;
    organization: OrganizationData;
    settings: OrganizationSettings;
    roles: OrganizationRole[];
}

/**
 * Resolve an organization by slug, verifying that the current user is signed in and can
 * view it. Returns the session, organization, settings and the caller's roles so callers
 * need only one call.
 *
 * Cached per request on the slug alone — deliberately not parameterised by permissions,
 * because React `cache` keys by argument identity and a fresh object literal per call
 * would defeat deduplication every time. Use `requireOrganizationWith` for anything
 * beyond `organization:view`.
 */
export const requireOrganization = cache(async (slug: string): Promise<OrganizationAccess> => {
    const [session, organization] = await Promise.all([
        requireSession(),
        getOrganizationBySlug(slug),
    ]);

    const [settings, roles] = await Promise.all([
        getOrganizationSettings(organization.id),
        getOrganizationUserRoles(organization.id, session.user.id),
    ]);

    return { session, organization, settings, roles };
});

/**
 * As `requireOrganization`, additionally requiring `permissions`.
 *
 * Evaluated in memory against the roles `requireOrganization` already loaded — the same
 * approach as `hasPermission` in `@/server/trpc-context` — rather than a second round trip
 * through Better Auth's `hasPermission`. `organization:view` is always required, as in
 * `organizationProcedure`.
 *
 * Denial raises Next's `forbidden()` interrupt rather than throwing: a thrown error would reach
 * the client error boundary with its class dropped and, in production, its message replaced, so
 * the reason would never be shown. A non-member never gets this far — `requireOrganization`
 * already responds with not-found.
 */
export async function requireOrganizationWith(
    slug: string,
    permissions: Permissions,
): Promise<OrganizationAccess> {
    const access = await requireOrganization(slug);

    const required: Permissions = {
        ...permissions,
        organization: permissions.organization?.includes("view")
            ? permissions.organization
            : [...(permissions.organization ?? []), "view"],
    };

    if (!hasAnyRoleWithPermissions(access.roles, required)) forbidden();
    return access;
}
