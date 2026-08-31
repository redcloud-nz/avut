/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode } from "react";

import { useHasPermission } from "@/hooks/use-has-permission";
import { Permissions } from "@/lib/permissions";

type ProtectProps = {
    permissions: Permissions;
} & (
    | { children: ReactNode; fallback?: ReactNode }
    | { render: (hasPermission: boolean) => ReactNode }
);

export function Protect({ permissions, ...props }: ProtectProps) {
    const hasPermission = useHasPermission(permissions);

    return "children" in props ? (
        <>{hasPermission ? props.children : props.fallback || null}</>
    ) : (
        <>{props.render(hasPermission)}</>
    );
}
