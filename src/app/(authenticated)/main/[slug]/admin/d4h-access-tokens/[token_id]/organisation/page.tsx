/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/admin/d4h-access-tokens/[token_id]/organisation
 */

import { notFound } from "next/navigation";

import { Eagle } from "@/components/blocks/eagle";
import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import {
    getD4HFetchClient,
    fetchD4HWhoamiCached,
    getD4HTokenMetadata,
} from "@/server/d4h-api/client";
import { D4HOrganisation } from "@/lib/schemas/d4h/organisation";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import * as Paths from "@/paths";
import { getOrganizationD4HAccessToken } from "@/server/d4h-access-token";
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

    const accesToken = await getOrganizationD4HAccessToken({
        tokenId: token_id,
        organizationId: organization.id,
    });

    if (!accesToken) notFound();

    const fetched = await fetchOrganisation(accesToken);

    const organisation = {
        raw: fetched,
        parsed: D4HOrganisation.schema.safeParse(fetched),
    };

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.d4hAccessTokens,
                    {
                        href: Paths.main(slug).admin.d4hAccessToken(token_id).href,
                        label: accesToken.id,
                    },
                    "Organisation",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton to={Paths.main(slug).admin.d4hAccessToken(token_id)} />
                        <Hermes.Title>Organisation</Hermes.Title>
                    </Hermes.Header>
                    <Eagle.Section>
                        <Eagle.Content raw={organisation.raw} parsed={organisation.parsed} />
                    </Eagle.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
