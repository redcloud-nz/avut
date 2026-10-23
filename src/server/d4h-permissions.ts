/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import {
    hasD4HTeamPermission,
    type D4HPermissionAction,
    type D4HPermissionResource,
} from "@/lib/d4h-permissions";
import { ForbiddenError } from "@/lib/errors";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { fetchD4HWhoami } from "@/server/d4h-api/client";

/**
 * Require that the token's D4H member in team `teamId` holds `action` on `resource`, throwing a
 * `ForbiddenError` naming the team and permission otherwise. Reads an uncached whoami: an
 * authorization decision for a write must not rest on one that may be hours old.
 */
export async function requireD4HTeamPermission(
    token: D4HAccessToken_ServerOnly,
    teamId: number,
    resource: D4HPermissionResource,
    action: D4HPermissionAction,
): Promise<void> {
    const whoami = await fetchD4HWhoami(token);
    const membership = whoami.members.find((m) => m.owner.id === teamId);

    if (!hasD4HTeamPermission(membership?.permissions, resource, action)) {
        const teamLabel = membership?.owner.title ?? `team ${teamId}`;
        throw new ForbiddenError(
            `You need D4H's ${resource} ${action} permission on ${teamLabel} to do this.`,
        );
    }
}
