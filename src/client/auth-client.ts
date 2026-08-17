/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { adminClient, emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ac, Roles } from "@/lib/permissions";

export const authClient = createAuthClient({
    plugins: [
        adminClient(),
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
