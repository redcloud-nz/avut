/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Deliberately free of any prisma import — the status lookup is injected so this can be exercised
 * from the jsdom test environment, like `organization-user-hooks.ts`.
 */

import "server-only";

import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

/** Of the given user ids, the ones whose account is in the system Rubbish bin (#296). */
export type FindDeletedUserIds = (userIds: string[]) => Promise<Set<string>>;

export const ACCOUNT_DELETED_MESSAGE =
    "This account has been deleted. Contact a system administrator if you need it back.";

/**
 * Keeps a soft-deleted account (`User.status: Deleted`) out of Better Auth:
 *
 * - **No new sessions.** A `session.create.before` database hook — the same place the admin
 *   plugin blocks a banned user — so it covers every sign-in route (password, OTP, OAuth,
 *   impersonation). Existing sessions are revoked by the soft delete itself; with the 5-minute
 *   session cookie cache, one can outlive that by up to the cache window, as with a role change.
 * - **Not listed as a member.** `/organization/list-members` backs the org member list and
 *   dashboard stats; the membership row is kept (recovery restores it), so its response is
 *   filtered here instead.
 */
export function deletedUserPlugin(findDeletedUserIds: FindDeletedUserIds): BetterAuthPlugin {
    return {
        id: "avut-deleted-users",
        init() {
            return {
                options: {
                    databaseHooks: {
                        session: {
                            create: {
                                async before(session) {
                                    const deleted = await findDeletedUserIds([session.userId]);
                                    if (deleted.has(session.userId)) {
                                        throw new APIError("FORBIDDEN", {
                                            message: ACCOUNT_DELETED_MESSAGE,
                                            code: "ACCOUNT_DELETED",
                                        });
                                    }
                                },
                            },
                        },
                    },
                },
            };
        },
        hooks: {
            after: [
                {
                    matcher: (context) => context.path === "/organization/list-members",
                    handler: createAuthMiddleware(async (ctx) => {
                        const returned = ctx.context.returned;
                        if (
                            !returned ||
                            returned instanceof Response ||
                            returned instanceof Error
                        ) {
                            return;
                        }
                        const body = returned as { members?: { userId: string }[]; total?: number };
                        if (!Array.isArray(body.members) || body.members.length === 0) return;

                        const deleted = await findDeletedUserIds(body.members.map((m) => m.userId));
                        if (deleted.size === 0) return;

                        const members = body.members.filter((m) => !deleted.has(m.userId));
                        return ctx.json({
                            ...body,
                            members,
                            total:
                                (body.total ?? body.members.length) -
                                (body.members.length - members.length),
                        });
                    }),
                },
            ],
        },
    };
}
