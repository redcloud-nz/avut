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

import {
    mapAccountLink,
    mapImpersonation,
    mapPasswordChange,
    mapUserUpdate,
    type HookActor,
    type UserUpdateSnapshot,
} from "./auth-log-hooks";
import { recordLogEntry, type RecordLogEntryInput } from "./log-entry";
import { revalidateOrganization } from "./organization";
import prisma from "./prisma";

/**
 * Bridges better-auth's `beforeEmailVerification` and `afterEmailVerification`
 * hooks within a single change-email request: `before` stashes the address the
 * account had, `after` reads it back to notify that address. Keyed by the
 * request object (identical across both calls in one route invocation), so it
 * is request-scoped and garbage-collected with the request.
 */
const previousEmailByRequest = new WeakMap<Request, string>();

/**
 * Carries what a `*.before` database hook observed into its matching `*.after` hook.
 *
 * better-auth's hooks cannot supply a previous value: `update.before` receives only the
 * update payload and `update.after` only the resulting row. So `before` records which keys
 * the payload carried — and, for an email change, reads the address the row still holds —
 * and `after` maps that into an entry.
 *
 * Recording in `after` rather than `before` means a write that fails leaves no entry.
 * Keyed by the endpoint context object, so it is request-scoped and collected with the
 * request; nothing leaks if `after` never runs. Same pattern as
 * `previousEmailByRequest` above.
 */
const userUpdateSnapshotByContext = new WeakMap<object, UserUpdateSnapshot>();
const passwordTouchedByContext = new WeakMap<object, boolean>();

/**
 * The user driving the request, from better-auth's endpoint context.
 *
 * `GenericEndpointContext` is `EndpointContext & { context: AuthContext }`, and the admin
 * middleware populates `session` on the endpoints that matter (ban, unban, set-role).
 * Read structurally so a better-auth type change cannot break the build here.
 */
function resolveHookActor(context: unknown): HookActor | null {
    const session = (
        context as {
            context?: { session?: { user?: { id?: string; name?: string; email?: string } } };
        }
    )?.context?.session;

    const user = session?.user;
    if (!user?.id || !user.name || !user.email) return null;

    return { userId: user.id, name: user.name, email: user.email };
}

/**
 * Record entries produced by a hook, swallowing every failure.
 *
 * `databaseHooks.*.after` runs AFTER the underlying write commits, and better-auth
 * rethrows what the hook throws (it never passes its core's `onAfterCommitHookError`
 * handler). So a throwing hook does not roll back the password change — it returns a 500
 * for an operation that already succeeded. Fail-closed is not available on this path, so
 * we fail open and accept audit gaps, which are at least visible in the logs.
 */
async function recordFromHook(entries: (RecordLogEntryInput | null)[]): Promise<void> {
    for (const entry of entries) {
        if (!entry) continue;
        try {
            await recordLogEntry(entry, prisma);
        } catch (error) {
            console.error("[audit] failed to record log entry from an auth hook", error);
        }
    }
}

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
            joins: true,
        },
    },
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    /*
     * Account-security events reach us here rather than through tRPC, because they run
     * through better-auth's own endpoints. All the logic lives in `auth-log-hooks.ts` —
     * this is a thin wire, and is deliberately untested: it cannot run under jsdom.
     */
    databaseHooks: {
        user: {
            update: {
                async before(user, context) {
                    try {
                        if (!context) return;
                        const touched = Object.keys(user);
                        const snapshot: UserUpdateSnapshot = { touched };

                        if (touched.includes("email")) {
                            // The only previous value the `after` hook cannot recover.
                            // The row still holds the pre-update address at this point.
                            const existing = await prisma.user.findUnique({
                                where: { id: String(user.id) },
                                select: { email: true },
                            });
                            if (existing) snapshot.previousEmail = existing.email;
                        }

                        userUpdateSnapshotByContext.set(context, snapshot);
                    } catch (error) {
                        console.error("[audit] user.update.before snapshot failed", error);
                    }
                },
                async after(user, context) {
                    try {
                        const snapshot = context
                            ? userUpdateSnapshotByContext.get(context)
                            : undefined;
                        if (context) userUpdateSnapshotByContext.delete(context);

                        const actor = resolveHookActor(context);
                        if (!actor && snapshot?.touched.includes("banned")) {
                            console.warn(
                                "[audit] no actor resolvable for a ban change; attributing to the affected user",
                            );
                        }

                        await recordFromHook(mapUserUpdate(user, snapshot, actor));
                    } catch (error) {
                        console.error("[audit] user.update.after failed", error);
                    }
                },
            },
        },
        account: {
            create: {
                async after(account, context) {
                    try {
                        await recordFromHook([
                            mapAccountLink(account, "Create", resolveHookActor(context)),
                        ]);
                    } catch (error) {
                        console.error("[audit] account.create.after failed", error);
                    }
                },
            },
            update: {
                async before(account, context) {
                    try {
                        if (context) {
                            passwordTouchedByContext.set(
                                context,
                                Object.keys(account).includes("password"),
                            );
                        }
                    } catch (error) {
                        console.error("[audit] account.update.before snapshot failed", error);
                    }
                },
                async after(account, context) {
                    try {
                        const passwordTouched = context
                            ? (passwordTouchedByContext.get(context) ?? false)
                            : false;
                        if (context) passwordTouchedByContext.delete(context);

                        await recordFromHook([mapPasswordChange(account, passwordTouched)]);
                    } catch (error) {
                        console.error("[audit] account.update.after failed", error);
                    }
                },
            },
            delete: {
                async after(account, context) {
                    try {
                        await recordFromHook([
                            mapAccountLink(account, "Delete", resolveHookActor(context)),
                        ]);
                    } catch (error) {
                        console.error("[audit] account.delete.after failed", error);
                    }
                },
            },
        },
        session: {
            create: {
                async after(session) {
                    try {
                        await recordFromHook([mapImpersonation(session, "start")]);
                    } catch (error) {
                        console.error("[audit] session.create.after failed", error);
                    }
                },
            },
            delete: {
                async after(session) {
                    try {
                        await recordFromHook([mapImpersonation(session, "end")]);
                    } catch (error) {
                        console.error("[audit] session.delete.after failed", error);
                    }
                },
            },
        },
    },
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

            sendEmail({
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
                async afterAcceptInvitation({ invitation, organization, user }) {
                    if (invitation.personId) {
                        // Copy personId from invitation to organization user
                        console.log(
                            `Attaching User(${user.id}) to Person(${invitation.personId}) in Organization(${organization.id})`,
                        );
                        await prisma.organizationUser.updateMany({
                            where: {
                                organizationId: organization.id,
                                userId: user.id,
                            },
                            data: {
                                personId: invitation.personId,
                            },
                        });
                    }
                },
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
                    additionalFields: {
                        personId: {
                            type: "string",
                            input: true,
                            required: false,
                        },
                    },
                },
                invitation: {
                    modelName: "OrganizationInvitation",
                    additionalFields: {
                        personId: {
                            type: "string",
                            input: true,
                            required: false,
                        },
                    },
                },
                team: {
                    modelName: "Team",
                },
                teamMember: {
                    modelName: "TeamUser",
                },
            },
            async sendInvitationEmail({ invitation, email, organization, inviter }) {
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
