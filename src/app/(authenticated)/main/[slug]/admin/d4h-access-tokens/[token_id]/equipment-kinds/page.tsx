/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { notFound } from "next/navigation";
import * as R from "remeda";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert2";

import { getD4HFetchClient, getD4HTeamsAccessibleWithToken } from "@/server/d4h-api/client";
import { D4HEquipmentKind } from "@/lib/schemas/d4h/equipment-kind";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import * as Paths from "@/paths";
import { getOrganizationD4HAccessToken } from "@/server/d4h-access-token";
import { getOrganizationBySlug } from "@/server/organization";

async function fetchEquipmentKinds(accessToken: D4HAccessToken_ServerOnly) {
    "use cache";

    const fetchClient = getD4HFetchClient(accessToken);

    const teams = await getD4HTeamsAccessibleWithToken(accessToken);

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

                return (data as { results: any[] }).results;
            }),
        )
    ).flat();

    return R.uniqueBy(kinds, (kind) => kind.id);
}

/**
 * DEVELOPMENT ONLY PAGE
 */
export default async function Admin_D4hAccessToken_EquipmentKinds_Page(
    props: PageProps<`/main/[slug]/admin/d4h-access-tokens/[token_id]/equipment-kinds`>,
) {
    const { slug, token_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const accessToken = await getOrganizationD4HAccessToken({
        tokenId: token_id,
        organizationId: organization.id,
    });

    if (!accessToken) notFound();

    const fetched = await fetchEquipmentKinds(accessToken);

    const kinds = fetched.map((kind) => ({
        raw: kind,
        parsed: D4HEquipmentKind.schema.safeParse(kind),
    }));

    const successCount = kinds.filter((i) => i.parsed.success).length;

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
                    "Equipment Kinds",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="full">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton
                                to={Paths.main(slug).admin.d4hAccessToken(token_id)}
                            />
                            <Hermes.Title>
                                Equipment Kinds ({successCount} of {kinds.length})
                            </Hermes.Title>
                        </Hermes.Header>
                        {kinds.map((kind) => (
                            <div className="grid grid-cols-2 border-b py-2" key={kind.raw.id}>
                                <div className="col-span-full py-2 font-semibold text-center">
                                    {kind.raw.id}
                                </div>
                                <div className="px-2 max-h-[50vh] overflow-y-auto">
                                    <pre className="text-xs">
                                        {JSON.stringify(kind.raw, null, 2)}
                                    </pre>
                                </div>
                                <div className="px-2 max-h-[50vh] overflow-y-auto">
                                    {kind.parsed.success ? (
                                        <pre className="text-xs">
                                            {JSON.stringify(kind.parsed.data, null, 2)}
                                        </pre>
                                    ) : (
                                        <Alert>
                                            <AlertTitle>
                                                Failed to parse equipment kind data
                                            </AlertTitle>
                                            <AlertDescription>
                                                {kind.parsed.error.message}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </div>
                        ))}
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
