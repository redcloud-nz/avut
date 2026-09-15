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
            /*
             * Mirrors the `schema.invitation` / `schema.member` additionalFields declared on the
             * server in `src/server/auth.ts`. Declared again here because the client plugin types
             * `inviteMember`'s body from its own options — without this, passing `personId` is a
             * type error even though the server route accepts it. Keep the two in step.
             */
            schema: {
                invitation: {
                    additionalFields: {
                        personId: { type: "string", input: true, required: false },
                    },
                },
                member: {
                    additionalFields: {
                        personId: { type: "string", input: true, required: false },
                    },
                },
            },
        }),
    ],
});

export type AuthClientSession = typeof authClient.$Infer.Session;
