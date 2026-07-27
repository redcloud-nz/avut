/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { notFound } from "next/navigation";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { route } from "@/lib/routes";

import { D4HEquipmentLocation } from "@/lib/schemas/d4h/equipment-location";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { getOrganizationD4HAccessToken } from "@/server/d4h-access-token";
import { getD4HFetchClient, getD4HTeamsAccessibleWithToken } from "@/server/d4h-api/client";
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

                return (data as { results: { id: number }[] }).results;
            }),
        )
    ).flat();

    return items;
}

/**
 * DEVELOPMENT ONLY PAGE
 */
export default async function Admin_D4hAccessToken_EquipmentLocations_Page(
    props: PageProps<`/orgs/[slug]/admin/d4h-access-tokens/[token_id]/equipment-locations`>,
) {
    const { slug, token_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const accessToken = await getOrganizationD4HAccessToken({
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
        <Std.SidebarInset>
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
                    "Equipment Locations",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>
                            Equipment Locations ({successCount} of {locations.length})
                        </Saratoga.Title>
                    </Saratoga.Header>
                    {locations.map((item) => (
                        <div key={item.raw.id} className="grid grid-cols-2 border-b py-2">
                            <div className="col-span-full py-2 font-semibold text-center">
                                {item.raw.id}
                            </div>
                            <div className="px-2 max-h-[50vh] overflow-y-auto">
                                <pre className="text-xs">{JSON.stringify(item.raw, null, 2)}</pre>
                            </div>
                            <div className="px-2 max-h-[50vh] overflow-y-auto">
                                {item.parsed.success ? (
                                    <pre className="text-xs">
                                        {JSON.stringify(item.parsed.data, null, 2)}
                                    </pre>
                                ) : (
                                    <Alert>
                                        <AlertTitle>
                                            Failed to parse equipment category data
                                        </AlertTitle>
                                        <AlertDescription>
                                            {item.parsed.error.message}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </div>
                    ))}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
