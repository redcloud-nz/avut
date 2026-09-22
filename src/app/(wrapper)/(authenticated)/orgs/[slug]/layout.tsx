/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { Metadata } from "next";

import { OrgSidebar_Modules } from "@/components/nav/org-sidebar-modules";
import { SidebarPortal } from "@/components/nav/sidebar-portal";
import { OrganizationProvider } from "@/hooks/use-organization";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { resolveModuleFlags } from "@/server/module-flags";
import { requireOrganization } from "@/server/organization-access";
import { getServerQueryClient, HydrateClient, trpc } from "@/trpc/server";

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

export default async function Organization_Layout(props: LayoutProps<"/orgs/[slug]">) {
    const { slug } = await props.params;
    const { organization, settings, roles } = await requireOrganization(slug);
    const moduleFlags = await resolveModuleFlags();

    // `requireOrganization` already did the real fetch (it has to, for the permission check),
    // so seed the query cache with its result directly rather than re-fetching through
    // `prefetch` — `useOrganization`'s `useSuspenseQueries` then hits these on the client
    // instead of firing its own request. `@sidebar/orgs/[slug]/layout.tsx` has no such data to
    // seed (it only calls the plain `getOrganizationBySlug` lookup), so its own `useOrganization`
    // reads either land on these same cache entries or fetch lazily — both fine.
    const queryClient = getServerQueryClient();
    queryClient.setQueryData(
        trpc.organizations.getOrganization.queryKey({ organizationId: organization.id }),
        organization,
    );
    queryClient.setQueryData(
        trpc.settings.getOrganizationSettings.queryKey({ organizationId: organization.id }),
        settings,
    );
    queryClient.setQueryData(
        trpc.organizations.getMyRoles.queryKey({ organizationId: organization.id }),
        roles,
    );

    return (
        <HydrateClient>
            <OrganizationProvider organizationId={organization.id} moduleFlags={moduleFlags}>
                {/*
                 * Portals into the sidebar shell in `(authenticated)/layout.tsx` — see
                 * `sidebar-portal.tsx` for why this isn't a `@sidebar` parallel route.
                 */}
                <SidebarPortal>
                    <OrgSidebar_Modules />
                </SidebarPortal>
                {props.children}
            </OrganizationProvider>
        </HydrateClient>
    );
}
