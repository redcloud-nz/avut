/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createContext, ReactNode, useContext } from "react";

import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { useQueries } from "@tanstack/react-query";
import { trpc } from "@/trpc/client";

const OrganizationContext = createContext<
    (OrganizationData & { settings: OrganizationSettings }) | null
>(null);

export function OrganizationProvider({
    children,
    organization: initialOrganization,
}: {
    children: ReactNode;
    organization: OrganizationData;
}) {
    const [
        { data: organization = initialOrganization },
        { data: settings = OrganizationSettings.default() },
    ] = useQueries({
        queries: [
            trpc.organizations.getOrganization.queryOptions({
                organizationId: initialOrganization.id,
            }),
            trpc.settings.getOrganizationSettings.queryOptions({
                organizationId: initialOrganization.id,
            }),
        ],
    });

    const organizationWithSettings = {
        ...organization,
        settings,
    };

    return (
        <OrganizationContext.Provider value={organizationWithSettings}>
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization(): OrganizationData & {
    settings: OrganizationSettings;
} {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error(
            "useOrganization must be used within an OrganizationProvider",
        );
    }
    return context;
}
