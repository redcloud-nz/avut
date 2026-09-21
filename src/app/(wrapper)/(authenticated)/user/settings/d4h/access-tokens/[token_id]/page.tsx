/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/settings/d4h/access-tokens/[token_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { UserSettings_D4HAccessTokenContent } from "@/components/user-settings/d4h-access-token-content";
import { D4HAccessTokenId } from "@/lib/schemas/d4h-access-token";
import { fetchQuery, HydrateClient, trpc } from "@/trpc/server";

type Props = PageProps<"/user/settings/d4h/access-tokens/[token_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { token_id } = await props.params;
    const tokenId = D4HAccessTokenId.schema.parse(token_id);

    const tokens = await fetchQuery(trpc.d4hAccessTokens.listPersonalAccessTokens.queryOptions());
    const token = tokens.find((t) => t.id === tokenId);

    return { title: token ? `D4H — ${token.organization.name}` : "D4H Access Token" };
}

export default async function UserSettings_D4HAccessToken_Page(props: Props) {
    const { token_id } = await props.params;
    const tokenId = D4HAccessTokenId.schema.parse(token_id);

    const tokens = await fetchQuery(trpc.d4hAccessTokens.listPersonalAccessTokens.queryOptions());
    if (!tokens.some((t) => t.id === tokenId)) notFound();

    return (
        <HydrateClient>
            <UserSettings_D4HAccessTokenContent tokenId={tokenId} />
        </HydrateClient>
    );
}
