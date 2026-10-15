/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/d4h-access-tokens/[token_id]/history
 */

import { Metadata } from "next";

import { AdminModule_D4HAccessTokenHistory_Content } from "@/components/admin/d4h-access-tokens/access-token-history-content";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { requireOrganizationWith } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, prefetchInfinite, trpc } from "@/trpc/server";

type Props = PageProps<`/orgs/[slug]/admin/d4h-access-tokens/[token_id]/history`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, token_id } = await props.params;
    const { organization } = await requireOrganizationWith(slug, { organization: ["update"] });

    const tokenId = ProviderCredentialId.schema.parse(token_id);
    const accessToken = await fetchQuery(
        trpc.d4hAccessTokens.getOrganizationAccessToken.queryOptions({
            organizationId: organization.id,
            tokenId,
        }),
    );

    const tokenLabel = accessToken.label || `Access Token: ${accessToken.id}`;
    return {
        title: `${tokenLabel} History ${TITLE_SEPARATOR} D4H Access Tokens`,
    };
}

export default async function AdminModule_D4HAccessTokenHistory_Page(props: Props) {
    const { slug, token_id } = await props.params;
    const { organization } = await requireOrganizationWith(slug, { organization: ["update"] });

    const tokenId = ProviderCredentialId.schema.parse(token_id);

    prefetch(
        trpc.d4hAccessTokens.getOrganizationAccessToken.queryOptions({
            organizationId: organization.id,
            tokenId,
        }),
    );
    // Same input as `ObjectHistory`'s client query (no `limit`), so the keys match.
    prefetchInfinite(
        trpc.history.listObjectHistory.infiniteQueryOptions(
            { organizationId: organization.id, objectType: "D4HAccessToken", objectId: tokenId },
            { getNextPageParam: (page) => page.nextCursor ?? undefined },
        ),
    );

    return (
        <HydrateClient>
            <AdminModule_D4HAccessTokenHistory_Content tokenId={tokenId} />
        </HydrateClient>
    );
}
