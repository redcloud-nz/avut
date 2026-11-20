/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export type D4HServerCode = "ap" | "eu" | "us";

export const D4HServerCode = {
    schema: z.enum(["ap", "eu", "us"] as const),
};

export const D4HServerCodes = ["ap", "eu", "us"] as const;

interface D4HServerInfo {
    code: D4HServerCode;
    apiUrl: string;
    tokensUrl?: string;
    /** Host of the region's D4H web app, which team URLs prefix with the team's subdomain. */
    teamManagerHost: string;
    name: string;
}

export const D4HServerList: D4HServerInfo[] = [
    {
        code: "ap",
        apiUrl: "https://api.team-manager.ap.d4h.com",
        tokensUrl: "https://myaccount.ap.d4h.com/tokens",
        teamManagerHost: "team-manager.ap.d4h.com",
        name: "Asia Pacific",
    },
    {
        code: "eu",
        apiUrl: "https://api.team-manager.eu.d4h.com",
        tokensUrl: "https://myaccount.eu.d4h.com/tokens",
        teamManagerHost: "team-manager.eu.d4h.com",
        name: "Europe",
    },
    {
        code: "us",
        apiUrl: "https://api.team-manager.us.d4h.com",
        tokensUrl: "https://myaccount.us.d4h.com/tokens",
        teamManagerHost: "team-manager.us.d4h.com",
        name: "United States",
    },
];

/**
 * Get the D4H server information for a given server code.
 * @param code Server Code
 * @returns D4HServerInfo
 * @throws Error if the code is invalid
 */
export function getD4HServer(code: D4HServerCode): D4HServerInfo {
    if (!D4HServerCodes.includes(code)) {
        throw new Error(`Invalid D4H server code: ${code}`);
    }

    return D4HServerList.find((server) => server.code === code)!;
}

/**
 * The D4H web-app URL for editing an equipment item, e.g.
 * `https://my-team.team-manager.ap.d4h.com/team/equipment/edit/1234`.
 */
export function d4hEquipmentItemUrl(
    serverCode: D4HServerCode,
    subdomain: string,
    itemId: number,
): string {
    const { teamManagerHost } = getD4HServer(serverCode);
    return `https://${subdomain}.${teamManagerHost}/team/equipment/edit/${itemId}`;
}

/**
 * The D4H web-app URL for viewing an equipment item, e.g.
 * `https://my-team.team-manager.ap.d4h.com/team/equipment/view/1234`.
 */
export function d4hEquipmentItemViewUrl(
    serverCode: D4HServerCode,
    subdomain: string,
    itemId: number,
): string {
    const { teamManagerHost } = getD4HServer(serverCode);
    return `https://${subdomain}.${teamManagerHost}/team/equipment/view/${itemId}`;
}

/** The D4H records that have a page in D4H's web app, besides items and exercises. */
export type D4HWebRecord = "team" | "member" | "category" | "type" | "brand" | "model";

export const D4HWebRecord = {
    schema: z.enum(["team", "member", "category", "type", "brand", "model"] as const),
};

/**
 * The path of each record's page in D4H's web app, confirmed by hand in D4H. A team's page is the
 * dashboard of its subdomain, so it takes no id. Brands and models use a newer path shape than
 * the rest.
 */
const D4H_WEB_RECORD_PATHS: Record<D4HWebRecord, (id: number) => string> = {
    team: () => "/dashboard",
    member: (id) => `/team/members/view/${id}`,
    category: (id) => `/team/equipment/categories/view/${id}`,
    type: (id) => `/team/equipment/types/view/${id}`,
    brand: (id) => `/equipment/brands/${id}/view`,
    model: (id) => `/equipment/models/${id}/view`,
};

/**
 * The D4H web-app URL for viewing a team, member or catalogue record, e.g.
 * `https://my-team.team-manager.ap.d4h.com/team/members/view/1234`.
 */
export function d4hRecordViewUrl(
    serverCode: D4HServerCode,
    subdomain: string,
    record: D4HWebRecord,
    id: number,
): string {
    const { teamManagerHost } = getD4HServer(serverCode);
    return `https://${subdomain}.${teamManagerHost}${D4H_WEB_RECORD_PATHS[record](id)}`;
}

/**
 * The D4H web-app URL for viewing an exercise, e.g.
 * `https://my-team.team-manager.ap.d4h.com/team/exercises/view/1234`.
 */
export function d4hExerciseViewUrl(
    serverCode: D4HServerCode,
    subdomain: string,
    exerciseId: number,
): string {
    const { teamManagerHost } = getD4HServer(serverCode);
    return `https://${subdomain}.${teamManagerHost}/team/exercises/view/${exerciseId}`;
}
