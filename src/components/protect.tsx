/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode } from "react";
import { entries } from "remeda";

import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { Permissions } from "@/lib/permissions";

type ProtectProps = {
    orgId: string;
    permissions: Permissions;
} & (
    | { children: ReactNode; fallback?: ReactNode }
    | { render: (hasPermission: boolean) => ReactNode }
);

export function Protect({ orgId, permissions, ...props }: ProtectProps) {
    // Flatten permissions for query key
    const flatPermissions = entries(permissions).flatMap(([key, value]) => {
        if (Array.isArray(value)) {
            return value.map((v) => `${key}:${v}`);
        } else if (typeof value === "string") {
            return `${key}:${value}`;
        } else return [];
    });

    const { data: hasPermission = false } = useQuery({
        queryKey: ["hasPermission", orgId, flatPermissions],
        queryFn: async () => {
            const response = await authClient.organization.hasPermission({
                permissions: permissions,
                organizationId: orgId,
            });
            if (response.data) {
                return response.data.success;
            } else {
                console.error("Error checking permissions:", response.error);
                throw response.error;
            }
        },
    });

    return "children" in props ? (
        <>{hasPermission ? props.children : props.fallback || null}</>
    ) : (
        <>{props.render(hasPermission)}</>
    );
}

// function Protect2({ children, orgId, permissions }: ProtectProps) {
//     const { data: organizationUser } = useSuspenseQuery(
//         trpc.organizations.getOrganizationUserSelf.queryOptions({
//             organizationId: orgId,
//         }),
//     );

//     const hasPermission = useMemo(() => {
//         // Check if any of the user's roles grant the required permissions
//         return organizationUser.role.some((role) =>
//             authClient.organization.checkRolePermission({ role, permissions }),
//         );
//     }, [organizationUser, permissions]);

//     return hasPermission ? <>{children}</> : null;
// }
