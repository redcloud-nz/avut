/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/members
 */

import { Route } from "next";
import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { ItemLinkActionIcon } from "@/components/icons";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/items";

import { UserId } from "@/lib/schemas/user";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { getD4HTokenMetadata } from "@/server/d4h-api/client";
import { getOrganizationBySlug } from "@/server/organization";
import { auth } from "@/server/auth";

export default async function I3Module_MembersList_SelectTeam_Page(
    props: PageProps<"/main/[slug]/i3/members">,
) {
    const { slug } = await props.params;

    const headers = await nextHeaders();
    const session = await auth.api.getSession({ headers });

    const organization = await getOrganizationBySlug(slug);

    const accessToken = await getConfiguredD4HAccessToken(
        organization.id,
        session!.user.id as UserId,
    );

    const { d4HTeams } = await getD4HTokenMetadata(accessToken);

    if (d4HTeams.length == 0)
        throw new Error(
            "No D4H Teams found. Please connect a D4H access token with access to at least one team.",
        );

    if (d4HTeams.length == 1) {
        redirect(`/main/${organization.slug}/i3/teams/${d4HTeams[0].id}/members` as Route);
    }

    return (
        <Lexington.Root>
            <Lexington.Header />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <Hermes.Header>
                        <Hermes.Title>Select Team</Hermes.Title>
                        <Hermes.Description>
                            You have multiple teams available. Please select a team to view its
                            members.
                        </Hermes.Description>
                    </Hermes.Header>
                    <ItemGroup>
                        {d4HTeams
                            .sort((a, b) => a.title.localeCompare(b.title))
                            .map((team) => (
                                <Item key={team.id} size="sm" asChild>
                                    <Link
                                        key={team.id}
                                        href={
                                            `/main/${organization.slug}/i3/teams/${team.id}/members` as Route
                                        }
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
