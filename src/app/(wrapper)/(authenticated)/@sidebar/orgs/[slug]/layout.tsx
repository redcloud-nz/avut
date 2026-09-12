/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * PROTOTYPE — provides the org-scoped `@sidebar` slot its own `OrganizationProvider`, separate
 * from the one `orgs/[slug]/layout.tsx` sets up for the main content tree. This one only needs
 * the org id, not a permission check — the real access gate is the main tree's
 * `requireOrganization`, which throws `forbidden()` for the whole route if denied. Both
 * providers key `useOrganization`'s reads by the same `organizationId`, so they share one
 * query-cache entry per query on the client rather than each fetching their own copy — whichever
 * tree hydrates first "wins," and the other reads the same cache instead of re-fetching.
 */

import { ReactNode } from "react";

import { OrgModuleListMenu } from "@/components/nav/org-module-list-menu";
import { OrganizationProvider } from "@/hooks/use-organization";
import { resolveModuleFlags } from "@/server/module-flags";
import { getOrganizationBySlug } from "@/server/organization";

export default async function OrganizationSidebarLayout(
    props: LayoutProps<"/orgs/[slug]"> & { children: ReactNode },
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const moduleFlags = await resolveModuleFlags();

    return (
        <OrganizationProvider organizationId={organization.id} moduleFlags={moduleFlags}>
            <OrgModuleListMenu />
            {props.children}
        </OrganizationProvider>
    );
}
