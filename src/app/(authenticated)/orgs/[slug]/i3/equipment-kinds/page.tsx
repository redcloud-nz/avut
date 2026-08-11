/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3/equipment-kinds
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ItemLinkActionIcon } from "@/components/icons";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";

import { route } from "@/lib/routes";
import { UserId } from "@/lib/schemas/user";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { getD4HTokenMetadata } from "@/server/d4h-api/client";
import { requireOrganization } from "@/server/organization-access";

export default async function I3Module_EquipmentKindsList_SelectTeam_Page(
    props: PageProps<"/orgs/[slug]/i3/equipment-kinds">,
) {
    const { slug } = await props.params;

    const { session, organization } = await requireOrganization(slug);

    const accessToken = await getConfiguredD4HAccessToken(
        organization.id,
        session.user.id as UserId,
    );

    const { d4HTeams } = await getD4HTokenMetadata(accessToken);

    if (d4HTeams.length == 0)
        throw new Error(
            "No D4H Teams found. Please connect a D4H access token with access to at least one team.",
        );

    if (d4HTeams.length == 1) {
        redirect(
            route("/orgs/[slug]/i3/teams/[team_id]/equipment-kinds", {
                slug: organization.slug,
                team_id: String(d4HTeams[0].id),
            }),
        );
    }

    return (
        <Std.SidebarInset>
            <Std.Navbar />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Select Team</Saratoga.Title>
                    </Saratoga.Header>
                    <p className="text-sm text-muted-foreground">
                        You have multiple teams available. Please select a team to view its
                        equipment kinds.
                    </p>
                    <ItemGroup>
                        {d4HTeams
                            .sort((a, b) => a.title.localeCompare(b.title))
                            .map((team) => (
                                <Item key={team.id} size="sm" asChild>
                                    <Link
                                        key={team.id}
                                        href={route(
                                            "/orgs/[slug]/i3/teams/[team_id]/equipment-kinds",
                                            { slug: organization.slug, team_id: String(team.id) },
                                        )}
                                    >
                                        <ItemContent>
                                            <ItemTitle>{team.title}</ItemTitle>
                                        </ItemContent>
                                        <ItemActions>
                                            <ItemLinkActionIcon className="size-4" />
                                        </ItemActions>
                                    </Link>
                                </Item>
                            ))}
                    </ItemGroup>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
