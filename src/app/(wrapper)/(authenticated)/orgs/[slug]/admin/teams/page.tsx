/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams
 */

import { AdminModule_Teams_List } from "@/components/admin/teams/teams-list";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Teams`,
};

export default async function AdminModule_TeamsList_Page(
    props: PageProps<"/orgs/[slug]/admin/teams">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                        { label: "Teams", href: route("/orgs/[slug]/admin/teams", { slug }) },
                    ]}
                    actions={<HelpButton slug="admin" />}
                />
                <Std.ScrollContainer>
                    <AdminModule_Teams_List />
                </Std.ScrollContainer>
            </>
        </HydrateClient>
    );
}
