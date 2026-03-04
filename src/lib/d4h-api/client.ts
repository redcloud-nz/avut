/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cacheLife, cacheTag } from "next/cache";
import createFetchClient from "openapi-fetch";
import { cache } from "react";
import * as R from "remeda";
import { z } from "zod";

import {
    D4HAccessToken,
    D4HAccessToken_ServerOnly,
} from "@/lib/schemas/d4h-access-token";

import { D4HMember } from "./member";
import type { paths } from "./schema";
import { getD4HServer } from "./servers";
import { D4hWhoami } from "./whoami";
import { D4HTeam, D4HTeamRef } from "./team";
import { D4HOrganization } from "./organization";
import { D4HEquipmentCategory } from "./equipment-category";
import { D4HEquipmentItem } from "./equipment-item";

export type D4HListResponse = {
    results: unknown[];
    page: number;
    pageSize: number;
    totalSize: number;
};

export const getD4hFetchClient = cache((token: D4HAccessToken_ServerOnly) => {
    const server = getD4HServer(token.serverCode)!;

    const fetchClient = createFetchClient<paths>({
        baseUrl: server.apiUrl,
    });
    fetchClient.use({
        onRequest({ request }) {
            request.headers.set("Authorization", `Bearer ${token.token}`);
            return request;
        },
    });

    return fetchClient;
});

export async function getD4HWhoami(token: D4HAccessToken_ServerOnly) {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${token.id}-whoami`);

    const fetchClient = getD4hFetchClient(token);
    const { data, response } = await fetchClient.GET("/v3/whoami");
    if (!response.ok) {
        throw new Error(
            `Failed to fetch D4H whoami: ${response.status} ${response.statusText}`,
        );
    }
    return D4hWhoami.schema.parse(data);
}

export async function getD4HTeamsAccessibleWithToken(
    token: D4HAccessToken_ServerOnly,
): Promise<D4HTeamRef[]> {
    const whoami = await getD4HWhoami(token);

    return whoami.members.map((member) => member.owner);
}

export async function getD4HOrganizationsAccessibleWithToken(
    token: D4HAccessToken_ServerOnly,
): Promise<D4HOrganization[]> {
    const fetchClient = getD4hFetchClient(token);

    const whoami = await getD4HWhoami(token);

    const organizations: D4HOrganization[] = [];

    for (const member of whoami.members) {
        const team = member.owner;

        if (!team.owner) continue;

        // Skip if the organization has already been fetched
        if (organizations.some((org) => org.id === team.owner!.id)) continue;

        const { data, response } = await fetchClient.GET(
            "/v3/{context}/{contextId}/organisations/{organisationId}",
            {
                params: {
                    path: {
                        context: "team",
                        contextId: team.id,
                        organisationId: team.owner!.id,
                    },
                },
            },
        );
        if (!response.ok) {
            throw new Error(
                `Failed to fetch D4H organisation: ${response.status} ${response.statusText}`,
            );
        }

        organizations.push(data as D4HOrganization);
    }

    // for (const officer of whoami.officers) {
    //     const organization = officer.owner;

    //     // Skip if the organization has already been fetched
    //     if (organizations.some((org) => org.id === organization.id)) continue;

    //     const { data, response } = await fetchClient.GET(
    //         "/v3/{context}/{contextId}/organisations/{organisationId}",
    //         {
    //             params: {
    //                 path: {
    //                     context: "organisation",
    //                     contextId: organization.id,
    //                     organisationId: organization.id,
    //                 },
    //             },
    //         },
    //     );
    //     if (!response.ok) {
    //         throw new Error(
    //             `Failed to fetch D4H organisation: ${response.status} ${response.statusText}`,
    //         );
    //     }
    //     organizations.push(data as D4HOrganization);
    // }

    return organizations;
}

export async function getD4HTeamMembers(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
): Promise<D4HMember[]> {
    "use cache";
    cacheTag(`d4h-api-${token.id}-teams-${d4hTeamId}-members`);

    const fetchClient = getD4hFetchClient(token);

    const { data } = await fetchClient.GET(
        "/v3/{context}/{contextId}/members",
        {
            params: {
                path: {
                    context: "team",
                    contextId: d4hTeamId,
                },
                query: {
                    status: ["OPERATIONAL", "NON_OPERATIONAL"],
                },
            },
        },
    );
    return z.object({ results: D4HMember.schema.array() }).parse(data).results;
}

export async function getD4HTeamsWithMembers(
    token: D4HAccessToken_ServerOnly,
): Promise<(D4HTeamRef & { members: D4HMember[] })[]> {
    const teams = await getD4HTeamsAccessibleWithToken(token);

    const teamsWithMembers = await Promise.all(
        teams.map(async (team) => {
            const members = await getD4HTeamMembers(token, team.id);

            return {
                ...team,
                members,
            };
        }),
    );

    return teamsWithMembers;
}

export async function getD4HEquipmentItems(
    accessToken: D4HAccessToken_ServerOnly,
) {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${accessToken.id}-equipment-items`);

    const fetchClient = getD4hFetchClient(accessToken);

    const teams = await getD4HTeamsAccessibleWithToken(accessToken);

    const equipment = (
        await Promise.all(
            teams.map(async (team) => {
                const { data } = await fetchClient.GET(
                    "/v3/{context}/{contextId}/equipment",
                    {
                        params: {
                            path: {
                                context: "team",
                                contextId: team.id,
                            },
                            query: {
                                size: 10000,
                                only_current: true,
                            },
                        },
                    },
                );

                return z
                    .object({ results: z.array(D4HEquipmentItem.schema) })
                    .parse(data).results;
            }),
        )
    ).flat();

    return R.uniqueBy(equipment, (e) => e.id);
}

export async function getD4HEquipmentCategories(
    accessToken: D4HAccessToken_ServerOnly,
): Promise<D4HEquipmentCategory[]> {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${accessToken.id}-equipment-categories`);

    const fetchClient = getD4hFetchClient(accessToken);

    const teams = await getD4HTeamsAccessibleWithToken(accessToken);

    const categories = (
        await Promise.all(
            teams.map(async (team) => {
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

                return z
                    .object({ results: z.array(D4HEquipmentCategory.schema) })
                    .parse(data).results;
            }),
        )
    ).flat();

    return R.uniqueBy(categories, (c) => c.id);
}
