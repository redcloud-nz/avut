/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, organization } from "better-auth/plugins";

import OneTimePasswordTemplate from "@/emails/one-time-password";
import { NoReplyEmailAddress, sendEmail } from "@/lib/email";
import { nanoId16 } from "@/lib/id";
import { ac, owner, admin, member } from "@/lib/permissions";

import prisma from "./prisma";

export const auth = betterAuth({
    account: {
        accountLinking: {
            enabled: true,
        },
        modelName: "Account",
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
        requireEmailVerification: true,
    },
    experimental: {
        joins: true,
    },

    plugins: [
        emailOTP({
            overrideDefaultEmailVerification: true,
            sendVerificationOnSignUp: true,
            async sendVerificationOTP({ email, otp, type }) {
                console.log("Sending verification OTP to:", email, otp, type);
                sendEmail({
                    from: NoReplyEmailAddress,
                    to: email,
                    subject: "Your verification code",
                    react: OneTimePasswordTemplate({
                        email,
                        otp,
                        type,
                    }),
                });
            },
        }),
        nextCookies(),
        organization({
            ac,
            roles: { owner, admin, member },
            schema: {
                organization: {
                    modelName: "Organization",
                },
                member: {
                    modelName: "OrganizationMember",
                },
                invitation: {
                    modelName: "Invitation",
                },
                team: {
                    modelName: "Team",
                },
                teamMembership: {
                    modelName: "TeamMember",
                },
                teamInvitation: {
                    modelName: "TeamInvitation",
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
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
        },
    },

    user: {
        modelName: "User",
    },
    verification: {
        modelName: "Verification",
    },
});

export type AuthSession = typeof auth.$Infer.Session;
