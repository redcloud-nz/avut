/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQueries } from "@tanstack/react-query";

import { ItemLinkActionIcon } from "@/components/icons";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { D4HMemberStatusBadge } from "./d4h-member-status-badge";
import { AdminModule_TeamMembershipMenu } from "./team-membership-menu";

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
                        href: route("/orgs/[slug]/admin/teams/[team_id]/personnel", {
                            slug: organization.slug,
                            team_id: teamId,
                        }),
                    },
                    membership.person.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{membership.person.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <AdminModule_TeamMembershipMenu
                                team={team}
                                person={membership.person}
                            />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Membership</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Person</DLTerm>
                                        <DLDetails>
                                            <Link
                                                href={route(
                                                    "/orgs/[slug]/admin/personnel/[person_id]",
                                                    {
                                                        slug: organization.slug,
                                                        person_id: membership.person.id,
                                                    },
                                                )}
                                                className="hover:underline"
                                            >
                                                {membership.person.name}
                                            </Link>
                                        </DLDetails>
                                        <DLTerm>Team</DLTerm>
                                        <DLDetails>
                                            <Link
                                                href={route("/orgs/[slug]/admin/teams/[team_id]", {
                                                    slug: organization.slug,
                                                    team_id: teamId,
                                                })}
                                                className="hover:underline"
                                            >
                                                {team.name}
                                            </Link>
                                        </DLDetails>
                                        <DLTerm>Status</DLTerm>
                                        <DLDetails>{membership.status}</DLDetails>
                                        <DLTerm>Joined</DLTerm>
                                        <DLDateDetails date={membership.createdAt} />
                                    </DL>
                                </CardContent>
                            </Card>

                            {membership.d4h && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>D4H</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <DL>
                                            <DLTerm>Member ID</DLTerm>
                                            <DLDetails>{membership.d4h.d4hMemberId}</DLDetails>
                                            <DLTerm>D4H Status</DLTerm>
                                            <DLDetails>
                                                <D4HMemberStatusBadge
                                                    status={membership.d4h.d4hStatus}
                                                />
                                            </DLDetails>
                                            <DLTerm>D4H Position</DLTerm>
                                            <DLDetails>
                                                {membership.d4h.d4hPosition || "—"}
                                            </DLDetails>
                                            <DLTerm>Ref</DLTerm>
                                            <DLDetails>{membership.d4h.d4hRef || "—"}</DLDetails>
                                            <DLTerm>Role ID</DLTerm>
                                            <DLDetails>{membership.d4h.d4hRoleId ?? "—"}</DLDetails>
                                            <DLTerm>Team last synced</DLTerm>
                                            {team.d4h?.lastSyncedAt ? (
                                                <DLDateDetails date={team.d4h.lastSyncedAt} />
                                            ) : (
                                                <DLDetails>Never</DLDetails>
                                            )}
                                        </DL>
                                        {team.d4h && (
                                            <Item className="mt-2 px-2" size="sm" asChild>
                                                <Link
                                                    href={route(
                                                        "/orgs/[slug]/d4h-views/members/[team_id]/[member_id]",
                                                        {
                                                            slug: organization.slug,
                                                            team_id: String(team.d4h.d4hTeamId),
                                                            member_id: String(
                                                                membership.d4h.d4hMemberId,
                                                            ),
                                                        },
                                                    )}
                                                >
                                                    <ItemContent>
                                                        <ItemTitle>View in D4H data</ItemTitle>
                                                    </ItemContent>
                                                    <ItemActions>
                                                        <ItemLinkActionIcon className="size-4" />
                                                    </ItemActions>
                                                </Link>
                                            </Item>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </Saratoga.Column>

                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDateDetails date={membership.createdAt} />
                                        <DLTerm>Updated</DLTerm>
                                        <DLDateDetails date={membership.updatedAt} />
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
