/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cacheTag } from "next/cache";
import createFetchClient from "openapi-fetch";
import { cache } from "react";

import { D4hAccessTokenData } from "@/lib/schemas/d4h-access-token";

import type { paths } from "./schema";
import { D4hServerCode, getD4hServer } from "./servers";
import { D4hWhoami } from "./whoami";
import { D4hMember } from "./member";

export const getD4hFetchClient = cache((token: D4hAccessTokenData) => {
    const server = getD4hServer(token.serverCode)!;

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
    return data as D4hWhoami;
}

export async function getD4hTeams(token: D4hAccessTokenData) {
    const whoami = await getD4hWhoami(token);

    return whoami.members
        .map((member) => member.owner)
        .filter((resource) => resource.resourceType === "Team");
}

export async function getD4hTeamMembers(
    token: D4hAccessTokenData,
    d4hTeamId: number,
) {
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
    return (data as { results: D4hMember[] }).results;
}

export async function getD4HTeamsWithMembers(token: D4hAccessTokenData) {
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
