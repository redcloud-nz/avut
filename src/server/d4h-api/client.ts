/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import createFetchClient from "openapi-fetch";
import { cache } from "react";
import * as z from "zod";

import { getD4HServer } from "@/lib/d4h-servers";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { D4HAccessTokenMetadata } from "@/lib/schemas/d4h-provider-metadata";
import { D4HActivityAttendance } from "@/lib/schemas/d4h/activity-attendance";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { D4HOrganisation } from "@/lib/schemas/d4h/organisation";
import { D4HTeamDetail, D4HTeamRef } from "@/lib/schemas/d4h/team";
import { D4HWhoami } from "@/lib/schemas/d4h/whoami";
import {
    getD4HAccessToken,
    resolveD4HCredential,
    type D4HCredentialRef,
} from "@/server/d4h-access-token";

import type { paths } from "./schema";

export type D4HListResponse = {
    results: unknown[];
    page: number;
    pageSize: number;
    totalSize: number;
};

/**
 * Get a D4H Fetch client for the given access token. The client will automatically include the access token in the Authorization header of each request.
 * The bearer value comes from `getD4HAccessToken`, the one place the secret is read.
 */
export const getD4HFetchClient = cache((token: D4HAccessToken_ServerOnly) => {
    const server = getD4HServer(token.serverCode)!;

    const fetchClient = createFetchClient<paths>({
        baseUrl: server.apiUrl,
    });
    fetchClient.use({
        async onRequest({ request }) {
            request.headers.set("Authorization", `Bearer ${await getD4HAccessToken(token)}`);
            return request;
        },
    });

    return fetchClient;
});

/**
 * Fetch the whoami for the given token, bypassing the cache. Use it where a fresh answer matters
 * (e.g. an authorization decision); otherwise prefer `fetchD4HWhoamiCached`.
 */
export async function fetchD4HWhoami(token: D4HAccessToken_ServerOnly): Promise<D4HWhoami> {
    const { data, response } = await getD4HFetchClient(token).GET("/v3/whoami");
    if (!response.ok) {
        throw new Error(`Failed to fetch D4H whoami: ${response.status} ${response.statusText}`);
    }
    return D4HWhoami.schema.parse(data);
}

export async function fetchD4HWhoamiCached(ref: D4HCredentialRef): Promise<D4HWhoami> {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${ref.credentialId}-whoami`);

    return fetchD4HWhoami(await resolveD4HCredential(ref));
}

/**
 * Compute the teams and owning organizations that are accessible with the given D4H access
 * token, from its whoami. Not cached; `getD4HTokenMetadata` is the cached version.
 */
export async function computeD4HTokenMetadata(
    token: D4HAccessToken_ServerOnly,
    whoami: D4HWhoami,
): Promise<D4HAccessTokenMetadata> {
    const fetchClient = getD4HFetchClient(token);

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

/**
 * Get the teams and owning organizations that are accessible with the referenced D4H access token.
 * This is used to determine the scope of a D4H access token.
 */
export async function getD4HTokenMetadata(ref: D4HCredentialRef): Promise<D4HAccessTokenMetadata> {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${ref.credentialId}-metadata`);

    const token = await resolveD4HCredential(ref);
    return computeD4HTokenMetadata(token, await fetchD4HWhoamiCached(ref));
}

export type D4HCredentialValidation = {
    ok: boolean;
    status: number;
    statusText: string;
    whoami?: D4HWhoami;
    metadata?: D4HAccessTokenMetadata;
};

/**
 * Check a credential against D4H, whether or not it has been saved yet. Not cached: validating a
 * credential must hit D4H. Doesn't throw when D4H rejects it (`ok` is `false` instead). On success
 * it also returns the whoami and the metadata computed from it.
 */
export async function validateD4HCredential(
    credential: D4HAccessToken_ServerOnly,
): Promise<D4HCredentialValidation> {
    const { data, response } = await getD4HFetchClient(credential).GET("/v3/whoami");
    const result = { ok: response.ok, status: response.status, statusText: response.statusText };

    if (!response.ok || !data) return result;

    const whoami = D4HWhoami.schema.parse(data);
    return { ...result, whoami, metadata: await computeD4HTokenMetadata(credential, whoami) };
}

export async function getD4HTeamsAccessibleWithToken(ref: D4HCredentialRef): Promise<D4HTeamRef[]> {
    const whoami = await fetchD4HWhoamiCached(ref);

    return whoami.members.map((member) => member.owner);
}

export async function getD4HTeamMembers(
    ref: D4HCredentialRef,
    d4hTeamId: number,
): Promise<D4HMember[]> {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${ref.credentialId}-teams-${d4hTeamId}-members`);

    const fetchClient = getD4HFetchClient(await resolveD4HCredential(ref));

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
    ref: D4HCredentialRef,
): Promise<(D4HTeamRef & { members: D4HMember[] })[]> {
    const teams = await getD4HTeamsAccessibleWithToken(ref);

    const teamsWithMembers = await Promise.all(
        teams.map(async (team) => {
            const members = await getD4HTeamMembers(ref, team.id);

            return {
                ...team,
                members,
            };
        }),
    );

    return teamsWithMembers;
}

/**
 * D4H's OpenAPI spec omits the `{context}/{contextId}` path parameters on a handful
 * of GET endpoints (team detail, attendance), so the generated types reject
 * `params.path` for them even though the request URL needs it. These helpers call
 * those endpoints with the path filled in at runtime, isolating the unavoidable cast.
 */
function d4hGetWithUntypedPath(
    fetchClient: ReturnType<typeof getD4HFetchClient>,
    url: string,
    params: { path: Record<string, unknown>; query?: Record<string, unknown> },
) {
    return (fetchClient.GET as (u: string, init: unknown) => ReturnType<typeof fetchClient.GET>)(
        url,
        { params },
    );
}

/**
 * Fetch a team's detail record (including its IANA `timezone`) via the given token.
 * Cached for hours — a team's timezone effectively never changes.
 */
export async function fetchD4HTeamDetailCached(
    ref: D4HCredentialRef,
    d4hTeamId: number,
): Promise<D4HTeamDetail> {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${ref.credentialId}-teams-${d4hTeamId}-detail`);

    const fetchClient = getD4HFetchClient(await resolveD4HCredential(ref));

    const { data, response } = await d4hGetWithUntypedPath(
        fetchClient,
        "/v3/{context}/{contextId}/teams/{teamId}",
        { path: { context: "team", contextId: d4hTeamId, teamId: d4hTeamId } },
    );
    if (!response.ok) {
        throw new Error(
            `Failed to fetch D4H team ${d4hTeamId}: ${response.status} ${response.statusText}`,
        );
    }
    return D4HTeamDetail.schema.parse(data);
}

/**
 * Fetch a D4H organisation's detail record (title, timezone, currency, reporting
 * calendar), addressed through one of its teams. Cached for hours.
 */
export async function fetchD4HOrganisationCached(
    ref: D4HCredentialRef,
    d4hTeamId: number,
    d4hOrganisationId: number,
): Promise<D4HOrganisation> {
    "use cache";
    cacheLife("hours");
    cacheTag(`d4h-api-${ref.credentialId}-organisations-${d4hOrganisationId}`);

    const fetchClient = getD4HFetchClient(await resolveD4HCredential(ref));

    const { data, response } = await fetchClient.GET(
        "/v3/{context}/{contextId}/organisations/{organisationId}",
        {
            params: {
                path: {
                    context: "team",
                    contextId: d4hTeamId,
                    organisationId: d4hOrganisationId,
                },
            },
        },
    );
    if (!response.ok) {
        throw new Error(
            `Failed to fetch D4H organisation ${d4hOrganisationId}: ${response.status} ${response.statusText}`,
        );
    }
    return D4HOrganisation.schema.parse(data);
}

/**
 * Fetch a linked team's D4H members, filtered to the operational set that sync
 * reconciles against (`OPERATIONAL` + `NON_OPERATIONAL`). Not cached — sync wants
 * the current roster.
 */
export async function fetchD4HTeamMembersForSync(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
): Promise<D4HMember[]> {
    const fetchClient = getD4HFetchClient(token);

    const { data, response } = await fetchClient.GET("/v3/{context}/{contextId}/members", {
        params: {
            path: { context: "team", contextId: d4hTeamId },
            query: { status: ["OPERATIONAL", "NON_OPERATIONAL"] },
        },
    });
    if (!response.ok) {
        throw new Error(
            `Failed to fetch members of D4H team ${d4hTeamId}: ${response.status} ${response.statusText}`,
        );
    }
    return z.object({ results: D4HMember.schema.array() }).parse(data).results;
}

/**
 * Fetch the given member's activity attendance records that overlap the given window,
 * for one team.
 */
export async function fetchD4HMemberAttendance(
    token: D4HAccessToken_ServerOnly,
    d4hTeamId: number,
    args: { memberId: number; startsBefore: string; endsAfter: string },
): Promise<D4HActivityAttendance[]> {
    const fetchClient = getD4HFetchClient(token);

    const { data, response } = await d4hGetWithUntypedPath(
        fetchClient,
        "/v3/{context}/{contextId}/attendance",
        {
            path: { context: "team", contextId: d4hTeamId },
            query: {
                member_id: args.memberId,
                starts_before: args.startsBefore,
                ends_after: args.endsAfter,
                size: 250,
            },
        },
    );
    if (!response.ok) {
        throw new Error(
            `Failed to fetch D4H attendance for team ${d4hTeamId}: ${response.status} ${response.statusText}`,
        );
    }
    return z.object({ results: D4HActivityAttendance.schema.array() }).parse(data).results;
}
