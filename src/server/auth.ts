/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { env } from "@/lib/env";
import { serverEnv } from "@/server/env";

import "server-only";

import { networkInterfaces } from "node:os";
import { betterAuth, BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, organization } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";

import EmailAddressChangedTemplate from "@/emails/email-address-changed";
import OneTimePasswordTemplate from "@/emails/one-time-password";
import OrganizationInviteTemplate from "@/emails/organization-invite";
import { withDevServerPort } from "@/lib/dev-server";
// eslint-disable-next-line avut/ids-via-schemas -- better-auth generates IDs for every auth model (user, session, account, member, …) through one hook
import { nanoId16 } from "@/lib/id";
import { ac, Roles } from "@/lib/permissions";
import { NoReplyEmailAddress, sendEmail } from "@/server/email";

import { deletedUserPlugin } from "./auth-hooks/deleted-user-plugin";
import { revalidateOrganization } from "./cache/organization";
import { revalidateOrganizationUser } from "./cache/organization-user-revalidate";
import prisma from "./prisma";
import { isVerificationOtpEmailSuppressed } from "./verification-otp-suppression";

/**
 * Bridges better-auth's `beforeEmailVerification` and `afterEmailVerification`
 * hooks within a single change-email request: `before` stashes the address the
 * account had, `after` reads it back to notify that address. Keyed by the
 * request object (identical across both calls in one route invocation), so it
 * is request-scoped and garbage-collected with the request.
 */
const previousEmailByRequest = new WeakMap<Request, string>();

/**
 * This machine's LAN IPv4 addresses, so a phone on the same network can sign in
 * against a dev server reached over e.g. `http://192.168.x.x:3000` — better-auth's
 * origin check otherwise rejects it since only `localhost` is trusted below.
 */
function localNetworkOrigins(): string[] {
    const addresses = Object.values(networkInterfaces())
        .flat()
        .filter((info) => info != null && info.family === "IPv4" && !info.internal)
        .map((info) => info!.address);
    return addresses.map((address) => `http://${address}:*`);
}

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
    baseURL: withDevServerPort(serverEnv.BETTER_AUTH_URL ?? "http://localhost:3000"),
    /*
     * With `advanced.database.joins` on, better-auth's Prisma adapter guesses relation field
     * names from the joined model's name (`organizationusers`, `organizationinvitations`),
     * not our schema's `users` / `invitations`. This endpoint is the only better-auth path
     * that joins Organization to those, so it 500s with a PrismaClientValidationError. The
     * app never calls it; keep it off until upstream fixes the key naming (#97).
     *
     * `/organization/delete` would hard-delete the org and cascade everything under it,
     * bypassing the audit log and the Rubbish bin's retention window (#297). Org deletion
     * goes through our own procedure instead.
     */
    // `/organization/leave` refuses the last owner; `user.leaveOrganization` allows it (with a
    // warning) and deletes the membership itself.
    disabledPaths: [
        "/organization/get-full-organization",
        "/organization/delete",
        "/organization/leave",
    ],
    /*
     * better-auth only trusts `baseURL` by default, which rejects origin-checked
     * requests coming from Vercel preview deploys (unique per-branch hosts) and
     * from local dev servers on any port but the one in `baseURL` (see AGENTS.md → Dev
     * servers; any port is trusted in development). `src/trpc/client.ts` and the email
     * templates already special-case `VERCEL_URL`; mirror that here.
     */
    trustedOrigins: [
        ...(env.VERCEL_URL ? [`https://${env.VERCEL_URL}`] : []),
        ...(env.VERCEL_BRANCH_URL ? [`https://${env.VERCEL_BRANCH_URL}`] : []),
        ...(env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
        ...(env.VERCEL_ENV === "preview" ? ["https://*.vercel.app"] : []),
        ...(env.isDevelopment() ? ["http://localhost:*", ...localNetworkOrigins()] : []),
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
        deletedUserPlugin(async (userIds) => {
            const rows = await prisma.user.findMany({
                where: { id: { in: userIds }, status: "Deleted" },
                select: { id: true },
            });
            return new Set(rows.map((r) => r.id));
        }),
        emailOTP({
            changeEmail: {
                enabled: true,
                verifyCurrentEmail: true,
            },
            overrideDefaultEmailVerification: true,
            sendVerificationOnSignUp: true,
            async sendVerificationOTP({ email, otp, type }) {
                // An account made from an invitation link is verified without this code.
                if (type === "email-verification" && isVerificationOtpEmailSuppressed()) return;

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
                async afterAcceptInvitation({ user }) {
                    // Person-linking now runs in `userRouter.acceptInvitation`, alongside the
                    // rest of the accept — that mutation is the only caller of
                    // `auth.api.acceptInvitation`, so nothing bypasses it here.

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
                async afterAddMember({ user }) {
                    // The lookup caches "not a member" too, so a member added outside our own
                    // mutations (Better Auth's server-side `addMember`) would otherwise stay
                    // locked out until the cached `null` expires.
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
            clientId: serverEnv.GITHUB_OAUTH_CLIENT_ID as string,
            clientSecret: serverEnv.GITHUB_OAUTH_CLIENT_SECRET as string,
        },
        google: {
            clientId: serverEnv.GOOGLE_OAUTH_CLIENT_ID as string,
            clientSecret: serverEnv.GOOGLE_OAUTH_CLIENT_SECRET as string,
        },
    },

    user: {
        modelName: "user",
        /*
         * Read-only on the session so the closed-account gate (`requireSession`,
         * `authenticatedProcedure`) costs no extra query. Fresh where it matters: deleting an
         * account revokes every session, so the next one is minted with `Deleted`; restoring
         * refetches the session past the cookie cache (see `account-closed-content.tsx`).
         */
        additionalFields: {
            status: { type: "string", input: false, required: false },
            deletedBy: { type: "string", input: false, required: false },
        },
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
