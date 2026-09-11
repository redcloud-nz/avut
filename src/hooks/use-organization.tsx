/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";

import type { ModuleFlagState } from "@/lib/module-flags";
import { Modules, type ModuleDef, type OrganizationModuleId } from "@/lib/modules";
import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { useQueries } from "@tanstack/react-query";
import { trpc } from "@/trpc/client";

const OrganizationContext = createContext<OrganizationClient | null>(null);

export function OrganizationProvider({
    children,
    organization: initialOrganization,
    settings: initialSettings,
    roles: initialRoles,
    moduleFlags,
}: {
    children: ReactNode;
    organization: OrganizationData;
    settings: OrganizationSettings;
    roles: OrganizationRole[];
    /** Environment-level module availability, resolved server-side (fixed per deployment). */
    moduleFlags: ModuleFlagState;
}) {
    const [{ data: organization }, { data: settings }, { data: roles }] = useQueries({
        queries: [
            trpc.organizations.getOrganization.queryOptions(
                { organizationId: initialOrganization.id },
                { initialData: initialOrganization },
            ),
            trpc.settings.getOrganizationSettings.queryOptions(
                { organizationId: initialOrganization.id },
                { initialData: initialSettings },
            ),
            trpc.organizations.getOrganizationUserSelf.queryOptions(
                { organizationId: initialOrganization.id },
                { initialData: initialRoles },
            ),
        ],
    });

    const client = useMemo(
        () => new OrganizationClient(organization, settings, roles, moduleFlags),
        [organization, settings, roles, moduleFlags],
    );

    return <OrganizationContext.Provider value={client}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationClient {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error("useOrganization must be used within an OrganizationProvider");
    }
    return context;
}

export class OrganizationClient {
    readonly id: OrganizationId;
    readonly name: string;
    readonly slug: string;
    readonly settings: OrganizationSettings;
    readonly roles: OrganizationRole[];
    readonly moduleFlags: ModuleFlagState;

    constructor(
        organization: OrganizationData,
        settings: OrganizationSettings,
        roles: OrganizationRole[],
        moduleFlags: ModuleFlagState,
    ) {
        this.id = organization.id;
        this.name = organization.name;
        this.slug = organization.slug;
        this.settings = settings;
        this.roles = roles;
        this.moduleFlags = moduleFlags;
    }

    /**
     * Whether `moduleId` is usable for this org in this deployment: its Vercel flag must be
     * on for the current environment *and* the org must have opted in via settings. `admin`
     * is always on once flag-available.
     */
    isModuleEnabled(moduleId: OrganizationModuleId): boolean {
        if (this.moduleFlags[moduleId] === false) return false;

        const moduleDef: ModuleDef = Modules[moduleId];
        if (moduleDef.alwaysOn) return true;

        const config = this.settings.modules[moduleId as keyof OrganizationSettings["modules"]];
        return config?.enabled === true;
    }
}
