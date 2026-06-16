/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { notFound } from "next/navigation";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";
import { D4HEquipmentCategory } from "@/lib/schemas/d4h/equipment-category";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { getOrganizationD4HAccessToken } from "@/server/d4h-access-token";
import { getD4HFetchClient, getD4HTokenMetadata } from "@/server/d4h-api/client";
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
                    "Equipment Categories",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>
                            Equipment Categories ({successCount} of {categories.length})
                        </Saratoga.Title>
                    </Saratoga.Header>
                    {categories.map((item) => (
                        <Eagle.Section key={item.raw.id}>
                            <Eagle.Title>{item.raw.id}</Eagle.Title>
                            <Eagle.Content raw={item.raw} parsed={item.parsed} />
                        </Eagle.Section>
                    ))}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
