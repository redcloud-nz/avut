/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { D4HTeamPermissions } from "@/lib/schemas/d4h-provider-metadata";

/** The D4H resources AVUT checks a team permission on. */
export type D4HPermissionResource = "Equipment";

/** The D4H actions AVUT checks on a resource. */
export type D4HPermissionAction = "CREATE" | "UPDATE" | "RETIRE";

/**
 * Whether a D4H team membership's permissions grant `action` on `resource`. Takes the
 * already-loaded permissions record (from a whoami membership, or `listAccessibleTeams`), so the
 * UI and the server read it the same way. A missing record or entry means no.
 */
export function hasD4HTeamPermission(
    permissions: D4HTeamPermissions | undefined,
    resource: D4HPermissionResource,
    action: D4HPermissionAction,
): boolean {
    return permissions?.[resource]?.[action] === true;
}
