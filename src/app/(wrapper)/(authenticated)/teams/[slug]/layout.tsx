/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]
 */

import { Metadata } from "next";

import { SidebarPortal } from "@/components/nav/sidebar-portal";
import { TeamSidebar_Modules } from "@/components/nav/team-sidebar-modules";
import { OrganizationProvider } from "@/hooks/use-organization";
import { TeamProvider } from "@/hooks/use-team";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { getTeamBySlug } from "@/server/cache/team";
import { resolveModuleFlags } from "@/server/module-flags";
import { requireTeam } from "@/server/team-access";
import { getServerQueryClient, HydrateClient, trpc } from "@/trpc/server";

// NOTE: metadata generation deliberately uses the plain cached lookup rather than `requireTeam`,
// as the org layout does: `generateMetadata` must not redirect. The entry gate lives in the layout
// below, which is what actually gates rendering.
export async function generateMetadata(props: LayoutProps<"/teams/[slug]">): Promise<Metadata> {
    const { slug } = await props.params;
    const team = await getTeamBySlug(slug);

    return {
        title: {
            template: `%s ${TITLE_SEPARATOR} ${team.name} | AVUT`,
            default: team.name,
        },
    };
}

export default async function Team_Layout(props: LayoutProps<"/teams/[slug]">) {
    const { slug } = await props.params;
    const { team, organization, settings, roles } = await requireTeam(slug);
    const moduleFlags = await resolveModuleFlags();

    // `requireTeam` already loaded the org's data, so seed the query cache with it rather than
    // re-fetching through `prefetch`: `useOrganization` then reads these entries on the client
    // instead of firing its own requests. The team itself goes to `TeamProvider` as a prop, which
    // `useTeam` returns without a query.
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
                <TeamProvider team={team} teamSlug={slug}>
                    {/*
                     * Portals into the sidebar shell in `(authenticated)/layout.tsx`, as the org
                     * layout's does — see `sidebar-portal.tsx`.
                     */}
                    <SidebarPortal>
                        <TeamSidebar_Modules />
                    </SidebarPortal>
                    {props.children}
                </TeamProvider>
            </OrganizationProvider>
        </HydrateClient>
    );
}
