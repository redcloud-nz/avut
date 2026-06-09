/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";

import { ItemLinkActionIcon } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_TeamLinks_Card({ team }: { team: TeamData }) {
    const organization = useOrganization();

    const teamMembersQuery = useQuery(
        trpc.teams.listTeamMemberships.queryOptions({
            organizationId: organization.id,
            teamId: team.id,
        }),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Related</CardTitle>
            </CardHeader>
            <CardContent className="px-2 -my-2">
                {teamMembersQuery.isLoading && <Skeleton className="h-[66.25px] w-full" />}
                {teamMembersQuery.data && (
                    <Item className="px-2" size="sm" asChild>
                        <Link
                            href={route("/main/[slug]/admin/teams/[team_id]/personnel", {
                                slug: organization.slug,
                                team_id: team.id,
                            })}
                        >
                            <ItemContent>
                                <ItemTitle>{teamMembersQuery.data.length} Personnel</ItemTitle>
                                <ItemDescription>assigned to this team</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <ItemLinkActionIcon className="size-4" />
                            </ItemActions>
                        </Link>
                    </Item>
                )}
            </CardContent>
        </Card>
    );
}
