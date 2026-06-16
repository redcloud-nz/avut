/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/admin/d4h-access-tokens/[token_id]/organisation
 */

import { notFound } from "next/navigation";

import { Eagle } from "@/components/blocks/eagle";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";

import { D4HOrganisation } from "@/lib/schemas/d4h/organisation";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { getOrganizationD4HAccessToken } from "@/server/d4h-access-token";
import {
    getD4HFetchClient,
    fetchD4HWhoamiCached,
    getD4HTokenMetadata,
} from "@/server/d4h-api/client";
import { getOrganizationBySlug } from "@/server/organization";

async function fetchOrganisation(accessToken: D4HAccessToken_ServerOnly) {
    const fetchClient = getD4HFetchClient(accessToken);

    const whoami = await fetchD4HWhoamiCached(accessToken);
    const { d4HTeams } = await getD4HTokenMetadata(accessToken, { whoami });

    const { data, response } = await fetchClient.GET(
        "/v3/{context}/{contextId}/organisations/{organisationId}",
        {
            params: {
                path: {
                    context: "team",
                    contextId: d4HTeams[0].id,
                    organisationId: d4HTeams[0].owner!.id,
                },
            },
        },
    );
    if (!response.ok) {
        throw new Error(`Failed to fetch D4H whoami: ${response.status} ${response.statusText}`);
    }
    return data;
}

/**
 * DEVELOPMENT ONLY PAGE
 */
export default async function Admin_D4hAccessToken_Organisation_Page(
    props: PageProps<`/main/[slug]/admin/d4h-access-tokens/[token_id]/organisation`>,
) {
    const { slug, token_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const accessToken = await getOrganizationD4HAccessToken({
        tokenId: token_id,
        organizationId: organization.id,
    });

    if (!accessToken) notFound();

    const fetched = await fetchOrganisation(accessToken);

    const organisation = {
        raw: fetched,
        parsed: D4HOrganisation.schema.safeParse(fetched),
    };

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    {
                        label: "D4H Access Tokens",
                        href: route("/main/[slug]/admin/d4h-access-tokens", { slug }),
                    },
                    {
                        label: accessToken.label || accessToken.id,
                        href: route("/main/[slug]/admin/d4h-access-tokens/[token_id]/members", {
                            slug,
                            token_id,
                        }),
                    },
                    "Organisation",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Organisation</Saratoga.Title>
                    </Saratoga.Header>
                    <Eagle.Section>
                        <Eagle.Content raw={organisation.raw} parsed={organisation.parsed} />
                    </Eagle.Section>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
