/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { useTeam } from "@/hooks/use-team";
import { getD4HServer } from "@/lib/d4h-servers";
import type { TeamScopeTeamData } from "@/lib/schemas/team-scope";
import { trpc } from "@/trpc/client";

/** The team scope's dashboard (`/teams/[slug]`): the team, its roster and its D4H link. */
export function Team_Dashboard_Content() {
    const team = useTeam();

    return (
        <>
            <Std.Navbar breadcrumbs={[team.name]} />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <div className="min-w-0">
                            <Saratoga.Title>{team.name}</Saratoga.Title>
                            <p className="text-sm text-muted-foreground">
                                {team.organization.name}
                            </p>
                        </div>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Protect permissions={{ team: ["view"] }}>
                                <RosterCard teamSlug={team.slug} />
                            </Protect>
                        </Saratoga.Column>

                        <Saratoga.Column slot="secondary">
                            <AboutCard team={team} />
                            <D4HLinkCard team={team} />
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

function RosterCard({ teamSlug }: { teamSlug: string }) {
    const { data: roster } = useSuspenseQuery(trpc.teamScope.listRoster.queryOptions({ teamSlug }));

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

function AboutCard({ team }: { team: TeamScopeTeamData }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
                <DataList>
                    <DataItem inline>
                        <DataItemTitle>Organisation</DataItemTitle>
                        <DataItemValue>{team.organization.name}</DataItemValue>
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

function D4HLinkCard({ team }: { team: TeamScopeTeamData }) {
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
