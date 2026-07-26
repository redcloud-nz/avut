/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]
 */
"use client";

import { use } from "react";

import { AdminModule_Team_PersonnelList } from "@/components/admin/teams/team-personnel-list";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";

import { useOrganization } from "@/hooks/use-organization";
import { useTeam } from "@/hooks/use-team";
import { route } from "@/lib/routes";

export default function AdminModule_Team_Personnel_Page(
    props: PageProps<`/orgs/[slug]/admin/teams/[team_id]/personnel`>,
) {
    const { slug, team_id } = use(props.params);
    const organization = useOrganization();

    const team = useTeam(team_id);

    return (
        <>
            <Std.SidebarInset>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                        { label: "Teams", href: route("/orgs/[slug]/admin/teams", { slug }) },
                        {
                            label: team.name,
                            href: route("/orgs/[slug]/admin/teams/[team_id]", { slug, team_id }),
                        },
                        "Personnel",
                    ]}
                />
                <Std.ScrollContainer>
                    <Saratoga.Root>
                        <Saratoga.Header>
                            <Saratoga.Title>Members of {team.name}</Saratoga.Title>
                            <Saratoga.Actions>
                                <Protect orgId={organization.id} permissions={{ team: ["update"] }}>
                                    <Button variant="outline">
                                        <ObjectIcons.Create />{" "}
                                        <span className="hidden md:inline">New Member</span>
                                    </Button>
                                </Protect>
                            </Saratoga.Actions>
                        </Saratoga.Header>
                        <div>
                            <AdminModule_Team_PersonnelList team={team} />
                        </div>
                    </Saratoga.Root>
                </Std.ScrollContainer>
            </Std.SidebarInset>
        </>
    );
}
