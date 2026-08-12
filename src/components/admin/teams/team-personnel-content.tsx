/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { AdminModule_Team_PersonnelList } from "@/components/admin/teams/team-personnel-list";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_Team_Personnel_Content({ teamId }: { teamId: TeamId }) {
    const organization = useOrganization();

    const { data: team } = useSuspenseQuery(
        trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Admin",
                        href: route("/orgs/[slug]/admin", { slug: organization.slug }),
                    },
                    {
                        label: "Teams",
                        href: route("/orgs/[slug]/admin/teams", { slug: organization.slug }),
                    },
                    {
                        label: team.name,
                        href: route("/orgs/[slug]/admin/teams/[team_id]", {
                            slug: organization.slug,
                            team_id: teamId,
                        }),
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
        </>
    );
}
