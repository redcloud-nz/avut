/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { betterAuth, BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { emailOTP, organization } from "better-auth/plugins";

import EmailAddressChangedTemplate from "@/emails/email-address-changed";
import OneTimePasswordTemplate from "@/emails/one-time-password";
import OrganizationInviteTemplate from "@/emails/organization-invite";

import { NoReplyEmailAddress, sendEmail } from "@/server/email";
import { nanoId16 } from "@/lib/id";
import { ac, Roles } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";

import { revalidateOrganization } from "./organization";
import { revalidateOrganizationUser } from "./organization-user-cache";
import { linkPersonOnInvitationAccept } from "./person-user-link";
import prisma from "./prisma";

/**
 * Bridges better-auth's `beforeEmailVerification` and `afterEmailVerification`
 * hooks within a single change-email request: `before` stashes the address the
 * account had, `after` reads it back to notify that address. Keyed by the
 * request object (identical across both calls in one route invocation), so it
 * is request-scoped and garbage-collected with the request.
 */
const previousEmailByRequest = new WeakMap<Request, string>();

export const auth = betterAuth({
    account: {
        accountLinking: {
            enabled: true,
        },
        modelName: "account",
    },
    advanced: {
        database: {
            generateId: nanoId16,
            joins: true,
        },
    },
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    /*
     * better-auth only trusts `baseURL` by default, which rejects origin-checked
     * requests coming from Vercel preview deploys (unique per-branch hosts) and
     * from local dev servers on a non-3000 port. `src/trpc/client.ts` and the
     * email templates already special-case `VERCEL_URL`; mirror that here.
     */
    trustedOrigins: [
        ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
        ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
        ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
        ...(process.env.VERCEL_ENV === "preview" ? ["https://*.vercel.app"] : []),
        ...(process.env.NODE_ENV === "development"
            ? [
                  "http://localhost:3000",
                  "http://localhost:3001",
                  "http://localhost:3002",
                  "http://localhost:3100", // worktree dev servers
              ]
            : []),
    ],
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },
    emailVerification: {
        autoSignInAfterVerification: true,
        async beforeEmailVerification(user, request) {
            if (request) previousEmailByRequest.set(request, user.email);
        },
        async afterEmailVerification(user, request) {
            const previousEmail = request ? previousEmailByRequest.get(request) : undefined;

            // Same hook pair also fires on signup verification, where the
            // address is unchanged - only notify on an actual change.
            if (!previousEmail || previousEmail.toLowerCase() === user.email.toLowerCase()) {
                return;
            }

            await sendEmail({
                from: NoReplyEmailAddress,
                to: previousEmail,
                subject: "Your AVUT email address was changed",
                react: EmailAddressChangedTemplate({
                    name: user.name,
                    previousEmail,
                    newEmail: user.email,
                }),
            });
        },
    },
    plugins: [
        admin(),
        emailOTP({
            changeEmail: {
                enabled: true,
                verifyCurrentEmail: true,
            },
            overrideDefaultEmailVerification: true,
            sendVerificationOnSignUp: true,
            async sendVerificationOTP({ email, otp, type }) {
                console.log(`Sending verification OTP (type: ${type}) to:`, email);
                await sendEmail({
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
                async afterAcceptInvitation({ invitation, organization, user }) {
                    /*
                     * Attach a person record to the membership Better Auth has just created —
                     * the one named by the invitation, or (when the organization opted in) one
                     * matching the accepting user's email.
                     *
                     * All of the logic lives in `person-user-link.ts` rather than here: this
                     * module imports `server-only` transitively, so anything written inline
                     * would be unreachable from the test environment.
                     *
                     * Never allowed to fail the accept. The membership itself is already
                     * committed by this point, so throwing would leave the user staring at an
                     * error for an invitation that did in fact work.
                     */
                    try {
                        const linked = await linkPersonOnInvitationAccept(prisma, {
                            organizationId: OrganizationId.schema.parse(organization.id),
                            actor: {
                                id: UserId.schema.parse(user.id),
                                name: user.name,
                                email: user.email,
                            },
                            invitationPersonId: invitation.personId ?? null,
                        });

                        if (linked) {
                            console.log(
                                `Attached User(${user.id}) to Person(${linked.personId}) in Organization(${organization.id})`,
                            );
                        }
                    } catch (error) {
                        console.error(
                            `Failed to link a person to User(${user.id}) in Organization(${organization.id}) on invitation accept:`,
                            error,
                        );
                    }

                    // Better Auth creates the membership (and its initial role) internally as
                    // part of accepting the invitation, before this hook runs — this is the one
                    // place that happens outside our own tRPC mutations, so it needs the same
                    // cache revalidation they do.
                    await revalidateOrganizationUser(user.id);
                },
                async afterUpdateOrganization({ organization }) {
                    // Revalidate organization cache
                    revalidateOrganization(organization!.slug);
                },
                async afterUpdateMemberRole({ user }) {
                    // `organizationProcedure`'s permission check reads through
                    // `getOrganizationUserRolesOrNull`'s cache — without this, a demoted member
                    // keeps their old permissions on every org-scoped mutation until it expires.
                    await revalidateOrganizationUser(user.id);
                },
                async afterRemoveMember({ user }) {
                    // As above: a removed member must lose access to the organization
                    // immediately, not once the cache entry happens to expire.
                    await revalidateOrganizationUser(user.id);
                },
            },
            roles: Roles,
            schema: {
                organization: {
                    modelName: "organization",
                },
                member: {
                    modelName: "organizationUser",
                    additionalFields: {
                        personId: {
                            type: "string",
                            input: true,
                            required: false,
                        },
                    },
                },
                invitation: {
                    modelName: "organizationInvitation",
                    additionalFields: {
                        personId: {
                            type: "string",
                            input: true,
                            required: false,
                        },
                    },
                },
            },
            async sendInvitationEmail({ invitation, email, organization, inviter }) {
                console.log(
                    `Sending organization invitation to: ${email} (Invitation ID: ${invitation.id})`,
                );
                await sendEmail({
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
        modelName: "user",
    },
    verification: {
        modelName: "verification",
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
