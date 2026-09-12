/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { AdminModule_Team_D4HCard } from "./d4h-link-card";
import { AdminModule_TeamLinks_Card } from "./team-links";
import { AdminModule_Team_Menu } from "./team-menu";
import { AdminModule_UpdateTeam_Dialog } from "./update-team";

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
                        <Saratoga.Title>{team.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <AdminModule_Team_Menu team={team} />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Team Details</CardTitle>
                                    <CardAction>
                                        <Protect permissions={{ team: ["update"] }}>
                                            <AdminModule_UpdateTeam_Dialog team={team} />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Team ID</DLTerm>
                                        <DLDetails className="font-mono">{team.id}</DLDetails>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{team.name}</DLDetails>
                                        <DLTerm>Description</DLTerm>
                                        <DLDetails>{team.description}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>

                            <AdminModule_Team_D4HCard team={team} />
                        </Saratoga.Column>

                        <Saratoga.Column slot="secondary">
                            <AdminModule_TeamLinks_Card team={team} />
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDateDetails date={team.createdAt} />
                                        {team.updatedAt && (
                                            <>
                                                <DLTerm>Updated</DLTerm>
                                                <DLDateDetails date={team.updatedAt} />
                                            </>
                                        )}
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
