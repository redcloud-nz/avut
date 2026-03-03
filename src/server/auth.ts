/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { betterAuth, BetterAuthOptions, InferUser } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, organization } from "better-auth/plugins";

import OneTimePasswordTemplate from "@/emails/one-time-password";
import OrganizationInviteTemplate from "@/emails/organization-invite";

import { NoReplyEmailAddress, sendEmail } from "@/lib/email";
import { nanoId16 } from "@/lib/id";
import { ac, Roles } from "@/lib/permissions";

import { revalidateOrganization } from "./organization";
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
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
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
                console.log(
                    `Sending verification OTP (type: ${type}) to:`,
                    email,
                );
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
            cancelPendingInvitationsOnReInvite: true,
            organizationHooks: {
                async afterUpdateOrganization({ organization }) {
                    // Revalidate organization cache
                    revalidateOrganization(organization!.slug);
                },
            },
            roles: Roles,
            schema: {
                organization: {
                    modelName: "Organization",
                },
                member: {
                    modelName: "OrganizationUser",
                },
                invitation: {
                    modelName: "OrganizationInvitation",
                },
                team: {
                    modelName: "Team",
                },
                teamMember: {
                    modelName: "TeamUser",
                },
            },
            async sendInvitationEmail({
                invitation,
                email,
                organization,
                inviter,
            }) {
                console.log(
                    `Sending organization invitation to: ${email} (Invitation ID: ${invitation.id})`,
                );
                sendEmail({
                    from: NoReplyEmailAddress,
                    to: email,
                    subject: `Invitation to join ${organization.name} on AVUT`,
                    react: OrganizationInviteTemplate({
                        invitation,
                        organization,
                        inviter,
                    }),
                });
            },
            teams: {
                enabled: true,
                allowRemovingAllTeams: true,
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
        github: {
            clientId: process.env.GITHUB_OAUTH_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET as string,
        },
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
} satisfies BetterAuthOptions);

export type Auth = typeof auth;

/**
 * Inferred invitation type from better-auth instance
 */
export type AuthInvitation = typeof auth.$Infer.Invitation;

/**
 * Inferred organization type from better-auth instance
 */
export type AuthOrganization = typeof auth.$Infer.Organization;

/**
 * Inferred organization member type from better-auth instance
 */
export type AuthOrganizationMember = typeof auth.$Infer.Member;

/**
 * Inferred session type from better-auth instance
 */
export type AuthSession = typeof auth.$Infer.Session;

/**
 * Inferred user type from better-auth instance
 */
export type AuthUser = InferUser<typeof auth>;
