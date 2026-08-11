/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";

import { AdminModule_CreateTeam_Dialog } from "@/components/admin/teams/create-team";
import { AdminModule_TeamsList } from "@/components/admin/teams/teams-list";
import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
import { requireOrganization } from "@/server/organization-access";

export const metadata = {
    title: `Teams`,
};

export default async function AdminModule_TeamsList_Page(
    props: PageProps<"/orgs/[slug]/admin/teams">,
) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Teams", href: route("/orgs/[slug]/admin/teams", { slug }) },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Teams</Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect orgId={organization.id} permissions={{ team: ["create"] }}>
                                <AdminModule_CreateTeam_Dialog />
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <AdminModule_TeamsList />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
