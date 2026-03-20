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
    name: string;
}

export const D4HServerList: D4HServerInfo[] = [
    {
        code: "ap",
        apiUrl: "https://api.team-manager.ap.d4h.com",
        tokensUrl: "https://myaccount.ap.d4h.com/tokens",
        name: "Asia Pacific",
    },
    {
        code: "eu",
        apiUrl: "https://api.team-manager.eu.d4h.com",
        tokensUrl: "https://myaccount.eu.d4h.com/tokens",
        name: "Europe",
    },
    {
        code: "us",
        apiUrl: "https://api.team-manager.us.d4h.com",
        tokensUrl: "https://myaccount.us.d4h.com/tokens",
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
