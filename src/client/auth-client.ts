/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ac, Roles } from "@/lib/permissions";

export const authClient = createAuthClient({
    plugins: [
        emailOTPClient(),
        organizationClient({
            ac,
            roles: Roles,
            teams: {
                enabled: true,
            },
        }),
    ],
});

export type AuthClientSession = typeof authClient.$Infer.Session;

export const sessionQueryOptions = {
    queryKey: ["auth", "session"] as const,
    queryFn: async () => {
        const { data, error } = await authClient.getSession();
        if (error) {
            throw error;
        }
        return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
};
