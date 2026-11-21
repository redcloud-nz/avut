/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { useTeam } from "@/hooks/use-team";
import { getD4HServer } from "@/lib/d4h-servers";
import type { OrganizationId } from "@/lib/schemas/organization";
import type { TeamData, TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

/** The team scope's dashboard (`/teams/[slug]`): the team, its roster and its D4H link. */
export function Team_Dashboard_Content() {
    const organization = useOrganization();
    const team = useTeam();

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <div className="min-w-0">
                    <Saratoga.Title>{team.name}</Saratoga.Title>
                    <p className="text-sm text-muted-foreground">{organization.name}</p>
                </div>
            </Saratoga.Header>

            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <Protect permissions={{ team: ["view"] }}>
                        <RosterCard organizationId={organization.id} teamId={team.id} />
                    </Protect>
                </Saratoga.Column>

                <Saratoga.Column slot="secondary">
                    <AboutCard team={team} organizationName={organization.name} />
                    <D4HLinkCard team={team} />
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}

/**
 * The team's `Active` memberships of `Active` people (an archived or binned person keeps their
 * membership's status), read through the org procedure and its `team: ["view"]` check.
 */
export function RosterCard({
    organizationId,
    teamId,
}: {
    organizationId: OrganizationId;
    teamId: TeamId;
}) {
    const { data: memberships } = useSuspenseQuery(
        trpc.teams.listTeamMemberships.queryOptions({ organizationId, teamId }),
    );
    const roster = memberships.filter(
        (membership) => membership.status === "Active" && membership.person.status === "Active",
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Roster</CardTitle>
            </CardHeader>
            <CardContent>
                {roster.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No one is on this team&apos;s roster yet.
                    </p>
                ) : (
                    <ItemGroup>
                        {roster.map((entry) => {
                            const d4hDetails = [entry.d4h?.d4hPosition, entry.d4h?.d4hRef].filter(
                                Boolean,
                            );

                            return (
                                <Item key={entry.id} variant="outline" size="sm">
                                    <ItemContent>
                                        {/* Plain text, not a `PersonLink`: that goes to org admin. */}
                                        <ItemTitle>{entry.person.name}</ItemTitle>
                                        {d4hDetails.length > 0 && (
                                            <ItemDescription>
                                                {d4hDetails.join(" · ")}
                                            </ItemDescription>
                                        )}
                                    </ItemContent>
                                </Item>
                            );
                        })}
                    </ItemGroup>
                )}
            </CardContent>
        </Card>
    );
}

function AboutCard({ team, organizationName }: { team: TeamData; organizationName: string }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
                <DataList>
                    <DataItem inline>
                        <DataItemTitle>Organisation</DataItemTitle>
                        <DataItemValue>{organizationName}</DataItemValue>
                    </DataItem>
                    <DataItem>
                        <DataItemTitle>Description</DataItemTitle>
                        {team.description ? (
                            <DataItemValue>{team.description}</DataItemValue>
                        ) : (
                            <DataItemValue className="text-muted-foreground">None</DataItemValue>
                        )}
                    </DataItem>
                </DataList>
            </CardContent>
        </Card>
    );
}

/** Hidden while the org has the D4H integration off, as Admin → Teams' D4H card is. */
function D4HLinkCard({ team }: { team: TeamData }) {
    const organization = useOrganization();
    if (!organization.settings.integrations.d4h.enabled) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>D4H</CardTitle>
            </CardHeader>
            <CardContent>
                {team.d4h ? (
                    <DataList>
                        <DataItem inline>
                            <DataItemTitle>D4H Team</DataItemTitle>
                            <DataItemValue>{team.d4h.d4hTeamName}</DataItemValue>
                        </DataItem>
                        <DataItem inline>
                            <DataItemTitle>Server</DataItemTitle>
                            <DataItemValue>
                                {getD4HServer(team.d4h.d4hServerCode).name}
                            </DataItemValue>
                        </DataItem>
                    </DataList>
                ) : (
                    <p className="text-sm text-muted-foreground">Not linked to D4H.</p>
                )}
            </CardContent>
        </Card>
    );
}
