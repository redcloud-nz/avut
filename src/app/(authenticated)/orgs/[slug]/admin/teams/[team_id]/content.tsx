/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { AdminModule_TeamLinks_Card } from "@/components/admin/teams/team-links";
import { AdminModule_TeamMenu } from "@/components/admin/teams/team-menu";
import { AdminModule_UpdateTeam_Dialog } from "@/components/admin/teams/update-team";
import { Saratoga } from "@/components/blocks/saratoga";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HServer } from "@/lib/d4h-servers";
import { TeamData } from "@/lib/schemas/team";

export function AdminModule_Team_Content({ team }: { team: TeamData }) {
    const organization = useOrganization();

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>{team.name}</Saratoga.Title>
                <Saratoga.Actions>
                    <AdminModule_TeamMenu team={team} />
                </Saratoga.Actions>
            </Saratoga.Header>

            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <Card>
                        <CardHeader>
                            <CardTitle>Team Details</CardTitle>
                            <CardAction>
                                <Protect orgId={organization.id} permissions={{ team: ["update"] }}>
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

                    {team.d4h && (
                        <Card>
                            <CardHeader>
                                <CardTitle>D4H Integration</CardTitle>
                                <CardAction>
                                    <Protect
                                        orgId={organization.id}
                                        permissions={{ team: ["update"] }}
                                    >
                                        <Button variant="ghost">
                                            <ObjectIcons.Edit />
                                        </Button>
                                    </Protect>
                                </CardAction>
                            </CardHeader>
                            <CardContent>
                                <DL>
                                    <DLTerm>D4H Team ID</DLTerm>
                                    <DLDetails>{team.d4h.d4hTeamId}</DLDetails>
                                    <DLTerm>D4H Team Name</DLTerm>
                                    <DLDetails>{team.d4h.d4hTeamName}</DLDetails>
                                    <DLTerm>D4H Server</DLTerm>
                                    <DLDetails>{getD4HServer(team.d4h.d4hServer).name}</DLDetails>
                                    <DLTerm>D4H Last Sync</DLTerm>

                                    {team.d4h.d4hLastSyncedAt ? (
                                        <DLDateDetails date={team.d4h.d4hLastSyncedAt} />
                                    ) : (
                                        <DLDetails>Never</DLDetails>
                                    )}
                                </DL>
                            </CardContent>
                        </Card>
                    )}
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
    );
}
