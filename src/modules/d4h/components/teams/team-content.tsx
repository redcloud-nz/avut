/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { D4HModule_TeamPickerDialog } from "./team-picker-dialog";

/** A D4H team's index: its details and links to its team-scoped sections. */
export function D4HModule_Team_Content({ teamId }: { teamId: number }) {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
    );

    const team = teams.find((t) => t.id === teamId);
    if (!team) notFound();

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H", href: route("/orgs/[slug]/d4h", { slug }) },
                    { label: "Teams", href: route("/orgs/[slug]/d4h/teams", { slug }) },
                    { label: team.title },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{team.title}</Saratoga.Title>
                        {teams.length > 1 && (
                            <Saratoga.Actions>
                                <D4HModule_TeamPickerDialog
                                    section={(id) =>
                                        route("/orgs/[slug]/d4h/teams/[d4h_team_id]", {
                                            slug,
                                            d4h_team_id: String(id),
                                        })
                                    }
                                />
                            </Saratoga.Actions>
                        )}
                    </Saratoga.Header>
                    <div className="flex flex-col gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Team Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DataList>
                                    <DataItem inline>
                                        <DataItemTitle>Name</DataItemTitle>
                                        <DataItemValue>{team.title}</DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>D4H ID</DataItemTitle>
                                        <DataItemValue>{team.id}</DataItemValue>
                                    </DataItem>
                                </DataList>
                            </CardContent>
                        </Card>
                        <ItemGroup>
                            <Item asChild>
                                <Link
                                    href={route("/orgs/[slug]/d4h/teams/[d4h_team_id]/members", {
                                        slug,
                                        d4h_team_id: String(team.id),
                                    })}
                                >
                                    <ItemContent>
                                        <ItemTitle>Members</ItemTitle>
                                        <ItemDescription>
                                            The team&apos;s members in D4H.
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </ItemGroup>
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
