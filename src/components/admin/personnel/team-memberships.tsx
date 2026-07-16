/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ItemLinkActionIcon } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item";

import { useOrganization } from "@/hooks/use-organization";
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Teams</CardTitle>
            </CardHeader>
            <CardContent className="px-2 -my-2">
                {teamMemberships.map((membership) => (
                    <Item key={membership.teamId} className="px-2" asChild>
                        <Link
                            href={route("/orgs/[slug]/admin/teams/[team_id]", {
                                slug: organization.slug,
                                team_id: membership.teamId,
                            })}
                        >
                            <ItemContent>
                                <ItemTitle>{membership.team.name}</ItemTitle>
                            </ItemContent>
                            <ItemActions>
                                <ItemLinkActionIcon className="size-4" />
                            </ItemActions>
                        </Link>
                    </Item>
                ))}
            </CardContent>
        </Card>
    );
}
