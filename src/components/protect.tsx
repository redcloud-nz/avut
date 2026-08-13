/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode, useMemo } from "react";

import { authClient } from "@/client/auth-client";
import { useOrganization } from "@/hooks/use-organization";
import { Permissions } from "@/lib/permissions";

type ProtectProps = {
    permissions: Permissions;
} & (
    | { children: ReactNode; fallback?: ReactNode }
    | { render: (hasPermission: boolean) => ReactNode }
);

export function Protect({ permissions, ...props }: ProtectProps) {
    const { roles } = useOrganization();

    const hasPermission = useMemo(
        () =>
            roles.some((role) =>
                authClient.organization.checkRolePermission({ role, permissions }),
            ),
        [roles, permissions],
    );

    return "children" in props ? (
        <>{hasPermission ? props.children : props.fallback || null}</>
    ) : (
        <>{props.render(hasPermission)}</>
    );
}
