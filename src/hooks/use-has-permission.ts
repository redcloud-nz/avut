/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo } from "react";

import { authClient } from "@/client/auth-client";
import { useOrganization } from "@/hooks/use-organization";
import { Permissions } from "@/lib/permissions";

/**
 * Returns whether the current user has all of the given permissions in the
 * active organization. This is the boolean that backs `<Protect>` — reach for
 * it directly when the value needs to flow somewhere a component can't (e.g. the
 * `enabled` option of a keyboard-shortcut hook).
 */
export function useHasPermission(permissions: Permissions): boolean {
    const { roles } = useOrganization();

    return useMemo(
        () =>
            roles.some((role) =>
                authClient.organization.checkRolePermission({ role, permissions }),
            ),
        [roles, permissions],
    );
}
