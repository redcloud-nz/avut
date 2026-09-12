/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * PROTOTYPE — provides the org-scoped `@sidebar` slot its own `OrganizationProvider`, separate
 * from the one `orgs/[slug]/layout.tsx` sets up for the main content tree. `requireOrganization`
 * and `resolveModuleFlags` are both request-`cache()`-scoped, so this doesn't add a second
 * server round-trip — but the client-side `OrganizationProvider` still ends up as two distinct
 * instances (main tree + sidebar tree), each running its own `useQueries`. Deduplicating that is
 * the "next stage" flagged in the suspense-boundary-review discussion.
 */

import { ReactNode } from "react";

import { OrgModuleListMenu } from "@/components/nav/org-module-list-menu";
import { OrganizationProvider } from "@/hooks/use-organization";
import { resolveModuleFlags } from "@/server/module-flags";
import { requireOrganization } from "@/server/organization-access";

export default async function OrganizationSidebarLayout(
    props: LayoutProps<"/orgs/[slug]"> & { children: ReactNode },
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
            <OrgModuleListMenu />
            {props.children}
        </OrganizationProvider>
    );
}
