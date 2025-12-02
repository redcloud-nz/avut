/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { emailOTPClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    plugins: [
        emailOTPClient(),
        organizationClient({
            teams: {
                enabled: true,
            },
        }),
    ],
});

export type AuthClientSession = typeof authClient.$Infer.Session;

type Permissions = Parameters<
    typeof authClient.organization.hasPermission
>[0]["permission"];
