/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Teams_D4HCard } from "@/components/teams/d4h-link-card";
import { Teams_TeamAccess_Card } from "@/components/teams/team-access-card";
import { Teams_Details_Card } from "@/components/teams/team-details-card";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { AdminModule_TeamLinks_Card } from "./team-links";
import { AdminModule_Team_Menu } from "./team-menu";

export function AdminModule_Team_Content({ teamId }: { teamId: TeamId }) {
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
                    { label: team.name },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title
                            badges={
                                team.status !== "Active" && (
                                    <Badge variant="outline">{team.status}</Badge>
                                )
                            }
                        >
                            {team.name}
                        </Saratoga.Title>
                        <Saratoga.Actions>
                            <AdminModule_Team_Menu team={team} />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Teams_Details_Card
                                team={team}
                                historyHref={route("/orgs/[slug]/admin/teams/[team_id]/history", {
                                    slug: organization.slug,
                                    team_id: team.id,
                                })}
                            />

                            <Protect permissions={{ member: ["view"] }}>
                                <Teams_TeamAccess_Card team={team} />
                            </Protect>

                            <Teams_D4HCard team={team} />
                        </Saratoga.Column>

                        <Saratoga.Column slot="secondary">
                            <AdminModule_TeamLinks_Card team={team} />
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
