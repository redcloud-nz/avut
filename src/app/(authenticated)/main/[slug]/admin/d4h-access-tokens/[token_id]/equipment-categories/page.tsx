/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { notFound } from "next/navigation";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { getD4HFetchClient, getD4HTokenMetadata } from "@/server/d4h-api/client";
import { D4HEquipmentCategory } from "@/lib/schemas/d4h/equipment-category";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import * as Paths from "@/paths";
import { getOrganizationD4HAccessToken } from "@/server/d4h-access-token";
import { getOrganizationBySlug } from "@/server/organization";
import { Eagle } from "@/components/blocks/eagle";

async function fetchEquipmentCategories(accessToken: D4HAccessToken_ServerOnly) {
    "use cache";

    const fetchClient = getD4HFetchClient(accessToken);

    const { d4HTeams } = await getD4HTokenMetadata(accessToken);

    const items = (
        await Promise.all(
            d4HTeams.map(async (team) => {
                const { data } = await fetchClient.GET(
                    "/v3/{context}/{contextId}/equipment-categories",
                    {
                        params: {
                            path: {
                                context: "team",
                                contextId: team.id,
                            },
                        },
                    },
                );

                return (data as { results: any[] }).results;
            }),
        )
    ).flat();

    return items;
}

/**
 * DEVELOPMENT ONLY PAGE
 */
export default async function Admin_D4hAccessToken_EquipmentCategories_Page(
    props: PageProps<`/main/[slug]/admin/d4h-access-tokens/[token_id]/equipment-categories`>,
) {
    const { slug, token_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const accessToken = await getOrganizationD4HAccessToken({
        tokenId: token_id,
        organizationId: organization.id,
    });

    if (!accessToken) notFound();

    const fetched = await fetchEquipmentCategories(accessToken);

    const categories = fetched.map((category) => ({
        raw: category,
        parsed: D4HEquipmentCategory.schema.safeParse(category),
    }));

    const successCount = categories.filter((i) => i.parsed.success).length;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.d4hAccessTokens,
                    {
                        href: Paths.main(slug).admin.d4hAccessToken(token_id).href,
                        label: accessToken.id,
                    },
                    "Equipment Categories",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="full">
                    <Hermes.Header>
                        <Hermes.BackButton to={Paths.main(slug).admin.d4hAccessToken(token_id)} />
                        <Hermes.Title>Equipment Categories</Hermes.Title>
                        <Hermes.Description>
                            Validated: {successCount} of {categories.length}
                        </Hermes.Description>
                    </Hermes.Header>
                    {categories.map((item) => (
                        <Eagle.Section key={item.raw.id}>
                            <Eagle.Title>{item.raw.id}</Eagle.Title>
                            <Eagle.Content raw={item.raw} parsed={item.parsed} />
                        </Eagle.Section>
                    ))}
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
