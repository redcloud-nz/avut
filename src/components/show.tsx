/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ReactNode } from "react";

export interface ShowProps {
    children: ReactNode;
    fallback?: ReactNode;
    when: boolean;
}

export function Show({ children, fallback, when }: ShowProps) {
    if (when) return children;
    else return fallback;
}

import { useOrganization } from "@/hooks/use-organization";
import { isModuleEnabled, type ModuleID } from "@/lib/modules";

export interface ShowIfEnabledProps {
    children: ReactNode;
    fallback?: ReactNode;
    module: ModuleID;
}

export function ShowIfEnabled({
    children,
    fallback,
    module,
}: ShowIfEnabledProps) {
    const organization = useOrganization();

    if (!isModuleEnabled(organization, module)) {
        return fallback ?? null;
    }

    return <>{children}</>;
}
