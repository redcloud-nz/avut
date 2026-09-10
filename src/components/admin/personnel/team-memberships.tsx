/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ItemLinkActionIcon } from "@/components/icons";
import { MembershipSourceBadge } from "@/components/admin/teams/membership-source-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";

import { useOrganization } from "@/hooks/use-organization";
import { formatD4HMemberStatus } from "@/lib/schemas/d4h/member";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function AdminModule_Person_TeamMemberships_Card({ personId }: { personId: PersonId }) {
    const organization = useOrganization();

    const { data: teamMemberships } = useSuspenseQuery(
        trpc.teams.listTeamMemberships.queryOptions({
            organizationId: organization.id,
            personId: personId,
        }),
    );

    const memberships = [...teamMemberships].sort((a, b) => a.team.name.localeCompare(b.team.name));

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Teams
                    {memberships.length > 0 && (
                        <span className="text-muted-foreground font-normal">
                            {" "}
                            ({memberships.length})
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-2 -my-2">
                {memberships.length === 0 && (
                    <p className="text-muted-foreground px-2 py-2 text-sm">
                        Not a member of any team.
                    </p>
                )}
                {memberships.map((membership) => (
                    <Item key={membership.teamId} className="px-2" asChild>
                        <Link
                            href={route(
                                "/orgs/[slug]/admin/teams/[team_id]/personnel/[person_id]",
                                {
                                    slug: organization.slug,
                                    team_id: membership.teamId,
                                    person_id: personId,
                                },
                            )}
                        >
                            <ItemContent>
                                <ItemTitle>{membership.team.name}</ItemTitle>
                                {membership.d4h && (
                                    <ItemDescription>
                                        {formatD4HMemberStatus(membership.d4h.d4hStatus)}
                                        {membership.d4h.d4hPosition
                                            ? ` · ${membership.d4h.d4hPosition}`
                                            : ""}
                                    </ItemDescription>
                                )}
                            </ItemContent>
                            <ItemActions>
                                <MembershipSourceBadge membership={membership} />
                                <ItemLinkActionIcon className="size-4" />
                            </ItemActions>
                        </Link>
                    </Item>
                ))}
            </CardContent>
        </Card>
    );
}
