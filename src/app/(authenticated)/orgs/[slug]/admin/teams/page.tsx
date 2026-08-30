/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";

import { AdminModule_TeamsList } from "@/components/admin/teams/teams-list";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Teams`,
};

export default async function AdminModule_TeamsList_Page(
    props: PageProps<"/orgs/[slug]/admin/teams">,
) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);

    prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                        { label: "Teams", href: route("/orgs/[slug]/admin/teams", { slug }) },
                    ]}
                />
                <Std.ScrollContainer>
                    <AdminModule_TeamsList />
                </Std.ScrollContainer>
            </Std.SidebarInset>
        </HydrateClient>
    );
}
