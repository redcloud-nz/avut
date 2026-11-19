/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ItemLinkActionIcon } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { useTeamSlug } from "@/hooks/use-team";
import { route } from "@/lib/routes";
import type { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

/** How many personnel are on the team, linking to team admin's members page. */
export function TeamAdmin_MembersLink_Card({ teamId }: { teamId: TeamId }) {
    const organization = useOrganization();
    const teamSlug = useTeamSlug();

    const { data: memberships } = useSuspenseQuery(
        trpc.teams.listTeamMemberships.queryOptions({ organizationId: organization.id, teamId }),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Related</CardTitle>
            </CardHeader>
            <CardContent className="px-2 -my-2">
                <Item className="px-2" size="sm" asChild>
                    <Link href={route("/teams/[slug]/admin/members", { slug: teamSlug })}>
                        <ItemContent>
                            <ItemTitle>{memberships.length} Personnel</ItemTitle>
                            <ItemDescription>assigned to this team</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                            <ItemLinkActionIcon className="size-4" />
                        </ItemActions>
                    </Link>
                </Item>
            </CardContent>
        </Card>
    );
}
