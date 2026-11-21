/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { PersonLink } from "@/components/entity-links/person-link";
import { TeamLink } from "@/components/entity-links/team-link";
import { D4HMemberStatusBadge } from "@/components/teams/d4h-member-status-badge";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

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
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
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
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title
                    badges={
                        membership.status !== "Active" && (
                            <Badge variant="outline">{membership.status}</Badge>
                        )
                    }
                >
                    {membership.person.name}
                </Saratoga.Title>
                <Saratoga.Actions>
                    <AdminModule_TeamMembership_Menu team={team} person={membership.person} />
                </Saratoga.Actions>
            </Saratoga.Header>

            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <RecordCard label="Membership" updatedAt={membership.updatedAt}>
                        <CardContent>
                            <DataList>
                                <RecordCardId label="Membership ID" id={membership.id} />
                                <DataItem>
                                    <DataItemTitle>Person</DataItemTitle>
                                    <DataItemValue>
                                        <PersonLink person={membership.person} />
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Team</DataItemTitle>
                                    <DataItemValue>
                                        <TeamLink team={team} />
                                    </DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </RecordCard>

                    {membership.d4h && (
                        <RecordCard label="D4H Member">
                            <CardContent>
                                <DataList>
                                    <RecordCardId
                                        label="Member ID"
                                        id={String(membership.d4h.d4hMemberId)}
                                    />
                                    <DataItem>
                                        <DataItemTitle>Role ID</DataItemTitle>
                                        <DataItemValue>
                                            {membership.d4h.d4hRoleId ?? "—"}
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem>
                                        <DataItemTitle>D4H Status</DataItemTitle>
                                        <DataItemValue>
                                            <D4HMemberStatusBadge
                                                status={membership.d4h.d4hStatus}
                                            />
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem>
                                        <DataItemTitle>Position</DataItemTitle>
                                        <DataItemValue>
                                            {membership.d4h.d4hPosition || "—"}
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem>
                                        <DataItemTitle>Ref</DataItemTitle>
                                        <DataItemValue>
                                            {membership.d4h.d4hRef || "—"}
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem>
                                        <DataItemTitle>Team last synced</DataItemTitle>
                                        {team.d4h?.lastSyncedAt ? (
                                            <DataItemDateValue date={team.d4h.lastSyncedAt} />
                                        ) : (
                                            <DataItemValue>Never</DataItemValue>
                                        )}
                                    </DataItem>
                                </DataList>
                            </CardContent>
                        </RecordCard>
                    )}
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
