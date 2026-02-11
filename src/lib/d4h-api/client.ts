/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cacheTag } from "next/cache";
import createFetchClient from "openapi-fetch";
import { cache } from "react";

import { D4hAccessTokenData } from "@/lib/schemas/d4h-access-token";

import type { paths } from "./schema";
import { getD4HServer } from "./servers";
import { D4HWhoami } from "./whoami";
import { D4HMember } from "./member";
import { D4HTeamRef } from "./team";

export const getD4hFetchClient = cache((token: D4hAccessTokenData) => {
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

export async function getD4hWhoami(token: D4hAccessTokenData) {
    "use cache";
    cacheTag(`d4h-api-${token.id}-whoami`);

    const fetchClient = getD4hFetchClient(token);
    const { data, response } = await fetchClient.GET("/v3/whoami");
    if (!response.ok) {
        throw new Error(
            `Failed to fetch D4H whoami: ${response.status} ${response.statusText}`,
        );
    }
    return data as D4HWhoami;
}

export async function getD4hTeams(
    token: D4hAccessTokenData,
): Promise<D4HTeamRef[]> {
    const whoami = await getD4hWhoami(token);

    return whoami.members
        .map((member) => member.owner)
        .filter((resource) => resource.resourceType === "Team") as D4HTeamRef[];
}

export async function getD4hTeamMembers(
    token: D4hAccessTokenData,
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
    return (data as { results: D4HMember[] }).results;
}

export async function getD4HTeamsWithMembers(
    token: D4hAccessTokenData,
): Promise<(D4HTeamRef & { members: D4HMember[] })[]> {
    const teams = await getD4hTeams(token);

    const teamsWithMembers = await Promise.all(
        teams.map(async (team) => {
            const members = await getD4hTeamMembers(token, team.id);

            return {
                ...team,
                members,
            };
        }),
    );

    return teamsWithMembers;
}
