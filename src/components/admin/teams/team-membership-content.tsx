/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { PersonLink } from "@/components/entity-links/person-link";
import { TeamLink } from "@/components/entity-links/team-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { D4HMemberStatusBadge } from "./d4h-member-status-badge";
import { AdminModule_TeamMembership_Menu } from "./team-membership-menu";

export function AdminModule_TeamMembership_Content({
    teamId,
    personId,
}: {
    teamId: TeamId;
    personId: PersonId;
}) {
    const organization = useOrganization();

    const [{ data: team }, { data: membership }] = useSuspenseQueries({
        queries: [
            trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
            trpc.teams.getTeamMembership.queryOptions({
                organizationId: organization.id,
                teamId,
                personId,
            }),
        ],
    });

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
                    {
                        label: "Members",
                        href: route("/orgs/[slug]/admin/teams/[team_id]/members", {
                            slug: organization.slug,
                            team_id: teamId,
                        }),
                    },
                    membership.person.name,
                ]}
                actions={<HelpButton id="admin" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Team Membership</Saratoga.Title>
                        <Saratoga.Actions>
                            <AdminModule_TeamMembership_Menu
                                team={team}
                                person={membership.person}
                            />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Details</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Membership ID</DataItemTitle>
                                            <DataItemValue>{membership.id}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Person</DataItemTitle>
                                            <DataItemValue>
                                                <PersonLink person={membership.person} />
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Team</DataItemTitle>
                                            <DataItemValue>
                                                <TeamLink team={team} />
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Status</DataItemTitle>
                                            <DataItemValue>{membership.status}</DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>

                            {membership.d4h && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>D4H</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <DataList>
                                            <DataItem inline>
                                                <DataItemTitle>Member ID</DataItemTitle>
                                                <DataItemValue>
                                                    {membership.d4h.d4hMemberId}
                                                </DataItemValue>
                                            </DataItem>
                                            <DataItem inline>
                                                <DataItemTitle>D4H Status</DataItemTitle>
                                                <DataItemValue>
                                                    <D4HMemberStatusBadge
                                                        status={membership.d4h.d4hStatus}
                                                    />
                                                </DataItemValue>
                                            </DataItem>
                                            <DataItem inline>
                                                <DataItemTitle>D4H Position</DataItemTitle>
                                                <DataItemValue>
                                                    {membership.d4h.d4hPosition || "—"}
                                                </DataItemValue>
                                            </DataItem>
                                            <DataItem inline>
                                                <DataItemTitle>Ref</DataItemTitle>
                                                <DataItemValue>
                                                    {membership.d4h.d4hRef || "—"}
                                                </DataItemValue>
                                            </DataItem>
                                            <DataItem inline>
                                                <DataItemTitle>Role ID</DataItemTitle>
                                                <DataItemValue>
                                                    {membership.d4h.d4hRoleId ?? "—"}
                                                </DataItemValue>
                                            </DataItem>
                                            <DataItem inline>
                                                <DataItemTitle>Team last synced</DataItemTitle>
                                                {team.d4h?.lastSyncedAt ? (
                                                    <DataItemDateValue
                                                        date={team.d4h.lastSyncedAt}
                                                    />
                                                ) : (
                                                    <DataItemValue>Never</DataItemValue>
                                                )}
                                            </DataItem>
                                        </DataList>
                                    </CardContent>
                                </Card>
                            )}
                        </Saratoga.Column>

                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={membership.createdAt} />
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Updated</DataItemTitle>
                                            <DataItemDateValue date={membership.updatedAt} />
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
