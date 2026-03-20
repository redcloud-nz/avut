/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode, useMemo } from "react";
import { entries } from "remeda";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { Permissions } from "@/lib/permissions";
import { trpc } from "@/trpc/client";

interface ProtectProps {
    children: ReactNode;
    orgId: string;
    permissions: Permissions;
    fallback?: ReactNode;
}

export function Protect({ children, orgId, permissions, fallback = null }: ProtectProps) {
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

    return hasPermission ? <>{children}</> : fallback;
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
