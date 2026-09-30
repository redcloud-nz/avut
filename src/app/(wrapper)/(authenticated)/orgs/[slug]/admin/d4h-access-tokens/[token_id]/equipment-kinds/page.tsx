/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { notFound } from "next/navigation";
import * as R from "remeda";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { env } from "@/lib/env";
import { route } from "@/lib/routes";
import { D4HEquipmentKind } from "@/lib/schemas/d4h/equipment-kind";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import {
    D4HCredentialRef,
    getOrganizationD4HAccessToken,
    resolveD4HCredential,
    toD4HCredentialRef,
} from "@/server/d4h-access-token";
import { getD4HFetchClient, getD4HTeamsAccessibleWithToken } from "@/server/d4h-api/client";
import { requireOrganizationWith } from "@/server/organization-access";

async function fetchEquipmentKinds(ref: D4HCredentialRef) {
    "use cache";

    const fetchClient = getD4HFetchClient(await resolveD4HCredential(ref));

    const teams = await getD4HTeamsAccessibleWithToken(ref);

    const kinds = (
        await Promise.all(
            teams.map(async (team) => {
                const { data } = await fetchClient.GET(
                    "/v3/{context}/{contextId}/equipment-kinds",
                    {
                        params: {
                            path: {
                                context: "team",
                                contextId: team.id,
                            },
                            query: {
                                type: "SUPPLY",
                            },
                        },
                    },
                );

                return (data as { results: { id: number }[] }).results;
            }),
        )
    ).flat();

    return R.uniqueBy(kinds, (kind) => kind.id);
}

/**
 * DEVELOPMENT ONLY PAGE
 */
export default async function Admin_D4HAccessToken_EquipmentKinds_Page(
    props: PageProps<`/orgs/[slug]/admin/d4h-access-tokens/[token_id]/equipment-kinds`>,
) {
    if (!env.isDevelopment()) notFound();

    const { slug, token_id } = await props.params;
    const { organization } = await requireOrganizationWith(slug, { organization: ["update"] });

    const accessToken = await getOrganizationD4HAccessToken({
        tokenId: ProviderCredentialId.schema.parse(token_id),
        organizationId: organization.id,
    });

    if (!accessToken) notFound();

    const fetched = await fetchEquipmentKinds(toD4HCredentialRef(accessToken));

    const kinds = fetched.map((kind) => ({
        raw: kind,
        parsed: D4HEquipmentKind.schema.safeParse(kind),
    }));

    const successCount = kinds.filter((i) => i.parsed.success).length;

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    {
                        label: "D4H Access Tokens",
                        href: route("/orgs/[slug]/admin/d4h-access-tokens", { slug }),
                    },
                    {
                        label: accessToken.label || accessToken.id,
                        href: route("/orgs/[slug]/admin/d4h-access-tokens/[token_id]/members", {
                            slug,
                            token_id,
                        }),
                    },
                    "Equipment Kinds",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>
                            Equipment Kinds ({successCount} of {kinds.length})
                        </Saratoga.Title>
                    </Saratoga.Header>
                    {kinds.map((kind) => (
                        <div className="grid grid-cols-2 border-b py-2" key={kind.raw.id}>
                            <div className="col-span-full py-2 font-semibold text-center">
                                {kind.raw.id}
                            </div>
                            <div className="px-2 max-h-[50vh] overflow-y-auto">
                                <pre className="text-xs">{JSON.stringify(kind.raw, null, 2)}</pre>
                            </div>
                            <div className="px-2 max-h-[50vh] overflow-y-auto">
                                {kind.parsed.success ? (
                                    <pre className="text-xs">
                                        {JSON.stringify(kind.parsed.data, null, 2)}
                                    </pre>
                                ) : (
                                    <Alert>
                                        <AlertTitle>Failed to parse equipment kind data</AlertTitle>
                                        <AlertDescription>
                                            {kind.parsed.error.message}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </div>
                    ))}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
