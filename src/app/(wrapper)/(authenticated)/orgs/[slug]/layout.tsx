/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { Metadata } from "next";
import type { ReactNode } from "react";

import { ModuleSidebar } from "@/components/nav/module-sidebar";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { resolveModuleFlags } from "@/server/module-flags";
import { getOrganizationBySlug } from "@/server/organization";
import { requireOrganization } from "@/server/organization-access";
import { OrganizationProvider } from "@/hooks/use-organization";

// NOTE: metadata generation deliberately uses the plain cached lookup rather than
// `requireOrganization` — `generateMetadata` must not redirect. The access check lives in
// the layout below, which is what actually gates rendering.
export async function generateMetadata(props: LayoutProps<"/orgs/[slug]">): Promise<Metadata> {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return {
        title: {
            template: `%s ${TITLE_SEPARATOR} ${organization.name} | AVUT`,
            default: organization.name,
        },
    };
}

export default async function Organization_Layout(
    props: LayoutProps<"/orgs/[slug]"> & { sidebar: ReactNode },
) {
    const { slug } = await props.params;
    const { organization, settings, roles } = await requireOrganization(slug);
    const moduleFlags = await resolveModuleFlags();

    return (
        <OrganizationProvider
            organization={organization}
            settings={settings}
            roles={roles}
            moduleFlags={moduleFlags}
        >
            {/*
             * PROTOTYPE — the `@sidebar` slot renders on every org route regardless of whether
             * `props.children` throws for a disabled module. Each migrated module's sidebar-menu
             * component (`I3_Sidebar_Menu`, `Admin_Sidebar_Menu`, …) duplicates its own layout's
             * `isModuleEnabled()` check so the two stay in sync — `playground` is the one
             * exception, since it isn't a settings-gated module at all. See the
             * suspense-boundary-review discussion for the tradeoffs.
             */}
            <ModuleSidebar scope="organization">{props.sidebar}</ModuleSidebar>
            {props.children}
        </OrganizationProvider>
    );
}
