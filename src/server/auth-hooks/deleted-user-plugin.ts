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
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

/** Of the given user ids, the ones whose account is in the system Rubbish bin (#296). */
export type FindDeletedUserIds = (userIds: string[]) => Promise<Set<string>>;

export const ACCOUNT_CLOSED_MESSAGE =
    "This account is closed. Restore it, or contact a system administrator, to use it again.";

/**
 * Keeps a soft-deleted account (`User.status: Deleted`) inert inside Better Auth.
 *
 * A Deleted account can still sign in — it lands on `/auth/account-closed`, where its owner can
 * restore it — so this doesn't touch sessions. The app-side gate (`requireSession`,
 * `authenticatedProcedure`) keeps it out of everything else; this covers what that gate can't
 * see, Better Auth's own endpoints:
 *
 * - **No organization actions.** Every `/organization/*` endpoint (accepting an invitation,
 *   creating or leaving an org, …) is refused for a Deleted caller, so the client can't route
 *   around the tRPC gate by calling Better Auth directly.
 * - **Not listed as a member.** `/organization/list-members` backs the org member list and
 *   dashboard stats; the membership row is kept (recovery restores it), so its response is
 *   filtered here instead.
 */
export function deletedUserPlugin(findDeletedUserIds: FindDeletedUserIds): BetterAuthPlugin {
    return {
        id: "avut-deleted-users",
        hooks: {
            before: [
                {
                    matcher: (context) => context.path?.startsWith("/organization/") ?? false,
                    handler: createAuthMiddleware(async (ctx) => {
                        const session = await getSessionFromCtx(ctx);
                        if (!session) return;
                        const deleted = await findDeletedUserIds([session.user.id]);
                        if (deleted.has(session.user.id)) {
                            throw new APIError("FORBIDDEN", {
                                message: ACCOUNT_CLOSED_MESSAGE,
                                code: "ACCOUNT_CLOSED",
                            });
                        }
                    }),
                },
            ],
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
