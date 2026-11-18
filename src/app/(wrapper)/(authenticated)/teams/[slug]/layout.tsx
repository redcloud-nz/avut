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
import { resolveModuleFlags } from "@/server/module-flags";
import { requireTeam } from "@/server/team-access";
import { fetchQuery, getServerQueryClient, HydrateClient, trpc } from "@/trpc/server";

// NOTE: metadata generation reads through `teamProcedure` (`fetchQuery` maps its NOT_FOUND to
// `notFound()`) rather than calling `requireTeam`: `generateMetadata` must not redirect. The
// layout below loads the shell's data.
export async function generateMetadata(props: LayoutProps<"/teams/[slug]">): Promise<Metadata> {
    const { slug } = await props.params;
    const team = await fetchQuery(trpc.teamScope.getTeam.queryOptions({ teamSlug: slug }));

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

    // `requireTeam` already loaded the team and its org's data, so seed the query cache with it
    // rather than re-fetching through `prefetch`: `useTeam` and `useOrganization` then read these
    // entries on the client instead of firing their own requests.
    const queryClient = getServerQueryClient();
    queryClient.setQueryData(trpc.teamScope.getTeam.queryKey({ teamSlug: slug }), team);
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
                <TeamProvider teamSlug={slug}>
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
