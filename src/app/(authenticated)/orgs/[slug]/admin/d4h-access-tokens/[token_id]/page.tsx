/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/d4h-access-tokens/[token_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";

import { D4HAccessTokenId } from "@/lib/schemas/d4h-access-token";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

import { AdminModule_D4hAccessToken_Content } from "./access-token-content";

type Props = PageProps<`/orgs/[slug]/admin/d4h-access-tokens/[token_id]`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, token_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const tokenId = D4HAccessTokenId.schema.parse(token_id);
    const accessToken = await fetchQuery(
        trpc.d4hAccessTokens.getOrganizationAccessToken.queryOptions({
            organizationId: organization.id,
            tokenId,
        }),
    );

    return { title: accessToken.label || `Access Token: ${accessToken.id}` };
}

export default async function AdminModule_D4hAccessToken_Page(props: Props) {
    const { slug, token_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const tokenId = D4HAccessTokenId.schema.parse(token_id);

    prefetch(
        trpc.d4hAccessTokens.getOrganizationAccessToken.queryOptions({
            organizationId: organization.id,
            tokenId,
        }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <AdminModule_D4hAccessToken_Content tokenId={tokenId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
