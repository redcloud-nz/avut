/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/admin/d4h-access-tokens/[token_id]/whoami
 */

import { notFound } from "next/navigation";

import { Eagle } from "@/components/blocks/eagle";
import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { route } from "@/lib/routes";
import { getD4HFetchClient } from "@/server/d4h-api/client";
import { getOrganizationD4HAccessToken } from "@/server/d4h-access-token";
import { getOrganizationBySlug } from "@/server/organization";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { D4HWhoami } from "@/lib/schemas/d4h/whoami";

async function fetchWhoami(accessToken: D4HAccessToken_ServerOnly) {
    const fetchClient = getD4HFetchClient(accessToken);

    const { data } = await fetchClient.GET("/v3/whoami");

    return data;
}

/**
 * DEVELOPMENT ONLY PAGE
 */
export default async function Admin_D4hAccessToken_Whoami_Page(
    props: PageProps<`/main/[slug]/admin/d4h-access-tokens/[token_id]/whoami`>,
) {
    const { slug, token_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const accessToken = await getOrganizationD4HAccessToken({
        tokenId: token_id,
        organizationId: organization.id,
    });

    if (!accessToken) notFound();

    const fetched = await fetchWhoami(accessToken);

    const whoami = {
        raw: fetched,
        parsed: D4HWhoami.schema.safeParse(fetched),
    };

    return (
        <Lexington.Root>
            <Lexington.Header
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
                    "Whoami",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/admin/d4h-access-tokens/[token_id]", {
                                slug,
                                token_id,
                            })}
                        />
                        <Hermes.Title>Whoami</Hermes.Title>
                    </Hermes.Header>
                    <Eagle.Section>
                        <Eagle.Content raw={whoami.raw} parsed={whoami.parsed} />
                    </Eagle.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
