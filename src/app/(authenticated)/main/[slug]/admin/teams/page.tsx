/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/teams
 */

import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";

import { AdminModule_TeamsList } from "./teams-list";
import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
import { AdminModule_CreateTeam_Dialog } from "./create-team";
import { getOrganizationBySlug } from "@/server/organization";

export const metadata = {
    title: `Teams`,
};

export default async function AdminModule_TeamsList_Page(
    props: PageProps<"/main/[slug]/admin/teams">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    { label: "Teams", href: route("/main/[slug]/admin/teams", { slug }) },
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
