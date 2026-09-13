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
import { useSuspenseQueries } from "@tanstack/react-query";
import { trpc } from "@/trpc/client";

interface OrganizationIdentity {
    organizationId: OrganizationId;
    /** Environment-level module availability, resolved server-side (fixed per deployment). */
    moduleFlags: ModuleFlagState;
}

const OrganizationContext = createContext<OrganizationIdentity | null>(null);

/**
 * Provides the org-scoped subtree just enough to key its own queries: the organization id and
 * the (unfetched, env-computed) module flags. `useOrganization` does the actual data reads via
 * `useSuspenseQueries`, so this carries no fetched data itself — a caller that already has the
 * full organization/settings/roles (`requireOrganization`) should seed the query cache directly
 * (`queryClient.setQueryData`) rather than pass them through here as props.
 *
 * Rendered independently in more than one subtree (the main org layout and the `@sidebar` slot
 * layout) is expected and fine: both key their queries identically, so they share one cache
 * entry per query rather than each fetching their own copy.
 */
export function OrganizationProvider({
    children,
    organizationId,
    moduleFlags,
}: OrganizationIdentity & { children: ReactNode }) {
    const identity = useMemo(
        () => ({ organizationId, moduleFlags }),
        [organizationId, moduleFlags],
    );

    return <OrganizationContext.Provider value={identity}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationClient {
    const identity = useContext(OrganizationContext);
    if (!identity) {
        throw new Error("useOrganization must be used within an OrganizationProvider");
    }
    const { organizationId, moduleFlags } = identity;

    const [{ data: organization }, { data: settings }, { data: roles }] = useSuspenseQueries({
        queries: [
            trpc.organizations.getOrganization.queryOptions({ organizationId }),
            trpc.settings.getOrganizationSettings.queryOptions({ organizationId }),
            trpc.organizations.getMyRoles.queryOptions({ organizationId }),
        ],
    });

    return useMemo(
        () => new OrganizationClient(organization, settings, roles, moduleFlags),
        [organization, settings, roles, moduleFlags],
    );
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
