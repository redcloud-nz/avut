/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { notFound } from "next/navigation";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert2";

import {
    getD4HFetchClient,
    getD4HTeamsAccessibleWithToken,
} from "@/lib/d4h-api/client";
import { D4HEquipmentLocation } from "@/lib/d4h-api/equipment-location";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import * as Paths from "@/paths";
import { getD4HAccessToken } from "@/server/d4h-access-token";
import { getOrganizationBySlug } from "@/server/organization";

async function fetchEquipmentLocations(accessToken: D4HAccessToken_ServerOnly) {
    "use cache";

    const fetchClient = getD4HFetchClient(accessToken);

    const teams = await getD4HTeamsAccessibleWithToken(accessToken);

    const items = (
        await Promise.all(
            teams.map(async (team) => {
                const { data } = await fetchClient.GET(
                    "/v3/{context}/{contextId}/equipment-locations",
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
export default async function Admin_D4hAccessToken_EquipmentLocations_Page(
    props: PageProps<`/main/[slug]/admin/d4h-access-tokens/[token_id]/equipment-locations`>,
) {
    const { slug, token_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const accessToken = await getD4HAccessToken({
        tokenId: token_id,
        organizationId: organization.id,
    });

    if (!accessToken) notFound();

    const fetched = await fetchEquipmentLocations(accessToken);

    const locations = fetched.map((location) => ({
        raw: location,
        parsed: D4HEquipmentLocation.schema.safeParse(location),
    }));

    const successCount = locations.filter((i) => i.parsed.success).length;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.d4hAccessTokens,
                    {
                        href: Paths.main(slug).admin.d4hAccessToken(token_id)
                            .href,
                        label: accessToken.id,
                    },
                    "Equipment Locations",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="full">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton
                                to={Paths.main(slug).admin.d4hAccessToken(
                                    token_id,
                                )}
                            />
                            <Hermes.Title>
                                Equipment Locations ({successCount} of{" "}
                                {locations.length})
                            </Hermes.Title>
                        </Hermes.Header>
                        {locations.map((item) => (
                            <div className="grid grid-cols-2 border-b py-2">
                                <div className="col-span-full py-2 font-semibold text-center">
                                    {item.raw.id}
                                </div>
                                <div className="px-2 max-h-[50vh] overflow-y-auto">
                                    <pre className="text-xs">
                                        {JSON.stringify(item.raw, null, 2)}
                                    </pre>
                                </div>
                                <div className="px-2 max-h-[50vh] overflow-y-auto">
                                    {item.parsed.success ? (
                                        <pre className="text-xs">
                                            {JSON.stringify(
                                                item.parsed.data,
                                                null,
                                                2,
                                            )}
                                        </pre>
                                    ) : (
                                        <Alert>
                                            <AlertTitle>
                                                Failed to parse equipment
                                                category data
                                            </AlertTitle>
                                            <AlertDescription>
                                                {item.parsed.error.message}
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
