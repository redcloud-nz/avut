/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins/organization";

import { nanoId16 } from "@/lib/id";
import { ac, owner, admin, member } from "@/lib/permissions";

import prisma from "./prisma";

export const auth = betterAuth({
    account: {
        accountLinking: {
            enabled: true,
        },
        modelName: "user_accounts",
    },
    advanced: {
        database: {
            generateId: nanoId16,
        },
    },
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),

    emailAndPassword: {
        enabled: true,
    },
    experimental: {
        joins: true,
    },

    plugins: [
        nextCookies(),
        organization({
            ac,
            roles: { owner, admin, member },
            schema: {
                organization: {
                    modelName: "organizations",
                },
                membership: {
                    modelName: "organization_members",
                },
                invitation: {
                    modelName: "organization_invitations",
                },
                team: {
                    modelName: "teams",
                },
                teamMembership: {
                    modelName: "team_members",
                },
                teamInvitation: {
                    modelName: "team_invitations",
                },
            },
            teams: {
                enabled: true,
            },
        }),
    ],

    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes
        },
    },

    user: {
        modelName: "users",
    },
    verification: {
        modelName: "user_verification",
    },
});

export type AuthSession = typeof auth.$Infer.Session;
