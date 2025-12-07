/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { headers } from "next/headers";

import { Permissions } from "@/lib/permissions";
import { auth } from "@/server/auth";
import { ReactNode } from "react";

interface ProtectProps {
    children: ReactNode;
    orgId: string;
    permissions: Permissions;
}

export async function Protect({ children, orgId, permissions }: ProtectProps) {
    const response = await auth.api.hasPermission({
        headers: await headers(),
        body: { permissions, organizationId: orgId },
    });

    return response.success ? <>{children}</> : null;
}
