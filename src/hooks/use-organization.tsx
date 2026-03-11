/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createContext, ReactNode, useContext } from "react";

import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { useQueries } from "@tanstack/react-query";
import { trpc } from "@/trpc/client";

const OrganizationContext = createContext<OrganizationClient | null>(null);

export function OrganizationProvider({
    children,
    organization: initialOrganization,
    settings: initialSettings,
}: {
    children: ReactNode;
    organization: OrganizationData;
    settings: OrganizationSettings;
}) {
    const [{ data: organization }, { data: settings }] = useQueries({
        queries: [
            trpc.organizations.getOrganization.queryOptions(
                { organizationId: initialOrganization.id },
                { initialData: initialOrganization },
            ),
            trpc.settings.getOrganizationSettings.queryOptions(
                { organizationId: initialOrganization.id },
                { initialData: initialSettings },
            ),
        ],
    });

    const client = new OrganizationClient(organization, settings);

    return (
        <OrganizationContext.Provider value={client}>
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization(): OrganizationClient {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error(
            "useOrganization must be used within an OrganizationProvider",
        );
    }
    return context;
}

export class OrganizationClient {
    readonly id: OrganizationId;
    readonly name: string;
    readonly slug: string;
    readonly settings: OrganizationSettings;

    constructor(
        organization: OrganizationData,
        settings: OrganizationSettings,
    ) {
        this.id = organization.id;
        this.name = organization.name;
        this.slug = organization.slug;
        this.settings = settings;
    }
}
