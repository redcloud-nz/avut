/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Std } from "@/components/blocks/std";
import { ObjectHistory } from "@/components/history/object-history";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { trpc } from "@/trpc/client";

export function AdminModule_D4HAccessTokenHistory_Content({
    tokenId,
}: {
    tokenId: ProviderCredentialId;
}) {
    const organization = useOrganization();

    const { data: accessToken } = useSuspenseQuery(
        trpc.d4hAccessTokens.getOrganizationAccessToken.queryOptions({
            organizationId: organization.id,
            tokenId,
        }),
    );

    const tokenLabel = accessToken.label || `Access Token: ${accessToken.id}`;

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Admin",
                        href: route("/orgs/[slug]/admin", { slug: organization.slug }),
                    },
                    {
                        label: "D4H Access Tokens",
                        href: route("/orgs/[slug]/admin/d4h-access-tokens", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: tokenLabel,
                        href: route("/orgs/[slug]/admin/d4h-access-tokens/[token_id]", {
                            slug: organization.slug,
                            token_id: tokenId,
                        }),
                    },
                    "History",
                ]}
            />
            <Std.ScrollContainer>
                <ObjectHistory
                    objectType="D4HAccessToken"
                    objectId={tokenId}
                    title={`${tokenLabel} — History`}
                />
            </Std.ScrollContainer>
        </>
    );
}
