/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import createFetchClient from "openapi-fetch";
import { cache } from "react";
import * as z from "zod";

import { D4HAccessToken_ServerOnly, D4HAccessTokenMetadata } from "@/lib/schemas/d4h-access-token";

import { D4HMember } from "../../lib/schemas/d4h/member";
import { D4HOrganisation } from "../../lib/schemas/d4h/organisation";
import type { paths } from "./schema";
import { getD4HServer } from "../../lib/d4h-servers";
import { D4HTeamRef } from "../../lib/schemas/d4h/team";
import { D4HWhoami } from "../../lib/schemas/d4h/whoami";

export type D4HListResponse = {
    results: unknown[];
    page: number;
    pageSize: number;
    totalSize: number;
};

/**
 * Get a D4H Fetch client for the given access token. The client will automatically include the access token in the Authorization header of each request.
 */
export const getD4HFetchClient = cache((token: D4HAccessToken_ServerOnly) => {
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

export async function fetchD4HWhoamiCached(token: D4HAccessToken_ServerOnly): Promise<D4HWhoami> {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${token.id}-whoami`);

    const fetchClient = getD4HFetchClient(token);
    const { data, response } = await fetchClient.GET("/v3/whoami");
    if (!response.ok) {
        throw new Error(`Failed to fetch D4H whoami: ${response.status} ${response.statusText}`);
    }
    return D4HWhoami.schema.parse(data);
}

/**
 * Get the teams and owning organizations that are accessible with the given D4H access token.
 * This is used to determine the scope of a D4H access token.
 */
export async function getD4HTokenMetadata(
    token: D4HAccessToken_ServerOnly,
    options: {
        whoami?: D4HWhoami;
    } = {},
): Promise<D4HAccessTokenMetadata> {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${token.id}-metadata`);

    const fetchClient = getD4HFetchClient(token);
    const whoami = options.whoami ?? (await fetchD4HWhoamiCached(token));

    const d4HOrganisations: D4HOrganisation[] = [];
    const d4HTeams: (D4HTeamRef & {
        permissions: Record<string, Record<string, boolean>>;
        owner: D4HOrganisation | undefined;
    })[] = [];

    for (const member of whoami.members) {
        const team = member.owner;

        let organisation: D4HOrganisation | undefined = undefined;

        if (team.owner && team.owner.id) {
            // Try to find the organisation in the list of already fetched organisations.
            organisation = d4HOrganisations.find((o) => o.id === team.owner?.id);

            // Fetch the organization if it hasn't been fetched yet
            if (!organisation) {
                const { data, response } = await fetchClient.GET(
                    "/v3/{context}/{contextId}/organisations/{organisationId}",
                    {
                        params: {
                            path: {
                                context: "team",
                                contextId: team.id,
                                organisationId: team.owner?.id,
                            },
                        },
                    },
                );
                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch D4H organisation: ${response.status} ${response.statusText}`,
                    );
                }
                organisation = D4HOrganisation.schema.parse(data);
                d4HOrganisations.push(organisation);
            }
        }

        d4HTeams.push({
            ...team,
            owner: organisation,
            permissions: member.permissions,
        });
    }

    return D4HAccessTokenMetadata.schema.parse({ d4HTeams, d4HOrganisations });
}

export async function getD4HTeamsAccessibleWithToken(
    token: D4HAccessToken_ServerOnly,
): Promise<D4HTeamRef[]> {
    const whoami = await fetchD4HWhoamiCached(token);

    return whoami.members.map((member) => member.owner);
}

export async function getD4HTeamMembers(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
): Promise<D4HMember[]> {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${token.id}-teams-${d4hTeamId}-members`);

    const fetchClient = getD4HFetchClient(token);

    const { data } = await fetchClient.GET("/v3/{context}/{contextId}/members", {
        params: {
            path: {
                context: "team",
                contextId: d4hTeamId,
            },
            query: {
                status: ["OPERATIONAL", "NON_OPERATIONAL"],
            },
        },
    });
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
