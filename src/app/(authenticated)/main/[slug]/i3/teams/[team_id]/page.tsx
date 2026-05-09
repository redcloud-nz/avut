/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/teams/[team_id]
 */
"use client";

import Link from "next/link";
import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";
import { ItemLinkActionIcon } from "@/components/icons";

export default function I3Module_Team_Page(props: PageProps<"/main/[slug]/i3/teams/[team_id]">) {
    const { team_id } = use(props.params);
    const teamId = parseInt(team_id);

    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({
            organizationId: organization.id,
        }),
    );

    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error(`D4HTeam(${teamId}) not found`);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "I3", href: route("/main/[slug]/i3", { slug: organization.slug }) },
                    { label: "Teams" },
                    { label: team.title },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <Hermes.Header>
                        <Hermes.Title>{team.title}</Hermes.Title>
                    </Hermes.Header>
                    <ItemGroup>
                        <Item asChild>
                            <Link
                                href={route("/main/[slug]/i3/teams/[team_id]/equipment-kinds", {
                                    slug: organization.slug,
                                    team_id: String(team.id),
                                })}
                            >
                                <ItemContent>
                                    <ItemTitle>By Equipment Type</ItemTitle>
                                    <ItemDescription>
                                        View issued items by equipment type.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ItemLinkActionIcon />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link
                                href={route("/main/[slug]/i3/teams/[team_id]/members", {
                                    slug: organization.slug,
                                    team_id: String(team.id),
                                })}
                            >
                                <ItemContent>
                                    <ItemTitle>By Member</ItemTitle>
                                    <ItemDescription>
                                        View issued items by team member.
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ItemLinkActionIcon />
                                </ItemActions>
                            </Link>
                        </Item>
                    </ItemGroup>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
