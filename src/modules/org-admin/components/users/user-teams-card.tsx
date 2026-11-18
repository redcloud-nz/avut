/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { TeamLink } from "@/components/entity-links/team-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

/** The teams a user has been granted access to. Read-only: grants are managed from each team's page. */
export function AdminModule_UserTeams_Card({ userId }: { userId: UserId }) {
    const organization = useOrganization();

    const { data: grants } = useSuspenseQuery(
        trpc.teamUsers.listUserTeams.queryOptions({ organizationId: organization.id, userId }),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Teams</CardTitle>
            </CardHeader>
            <CardContent>
                {grants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team access.</p>
                ) : (
                    <ItemGroup>
                        {grants.map((grant) => (
                            <Item key={grant.id} variant="outline" size="sm">
                                <ItemContent>
                                    <ItemTitle>
                                        <TeamLink team={grant.team} />
                                        {grant.team.status !== "Active" && (
                                            <Badge variant="secondary">{grant.team.status}</Badge>
                                        )}
                                    </ItemTitle>
                                </ItemContent>
                            </Item>
                        ))}
                    </ItemGroup>
                )}
            </CardContent>
        </Card>
    );
}
