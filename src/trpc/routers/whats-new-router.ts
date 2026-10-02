/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The "what's new" popup's reads and its read cursor. Entries come from the
 * `updates` content collection (`@/lib/updates`); the only database state is
 * `User.lastSeenUpdatesAt`. See docs/plans/2026-09-30-whats-new-popup.md.
 */

import * as z from "zod";

import { clampSeenCursor, getRecentUpdates, getUpdatesAfter } from "@/lib/updates";

import { authenticatedProcedure, createTrpcRouter, type AuthenticatedContext } from "../init";

/** How many entries the footer button's "recent" mode shows. */
const RECENT_LIMIT = 10;

/**
 * While an admin is impersonating a user, the popup stays quiet and the
 * impersonated user's cursor is left untouched.
 */
function isImpersonating(ctx: Pick<AuthenticatedContext, "auth">): boolean {
    return !!ctx.auth.session.impersonatedBy;
}

export const whatsNewRouter = createTrpcRouter({
    /**
     * Entries the caller hasn't seen: published after their cursor, which falls
     * back to their account's `createdAt` so new users don't get the backlog.
     */
    getUnseen: authenticatedProcedure.query(async ({ ctx }) => {
        if (isImpersonating(ctx)) return { entries: [] };

        const user = await ctx.prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { lastSeenUpdatesAt: true },
        });

        return { entries: getUpdatesAfter(user?.lastSeenUpdatesAt ?? ctx.auth.user.createdAt) };
    }),

    /** The most recent entries, for reopening the dialog once nothing is unseen. */
    listRecent: authenticatedProcedure.query(() => {
        return { entries: getRecentUpdates(RECENT_LIMIT) };
    }),

    /**
     * Advance the caller's cursor to `through`, the newest `publishedAt` the
     * dialog showed. It's clamped to the newest entry in the collection, and it
     * never moves the effective cursor (`lastSeenUpdatesAt ?? createdAt`) backwards.
     *
     * Deliberately not audit-logged, departing from the "always `logEvent`"
     * rule: this is a read cursor, like a notification's read state, not a change
     * to the user record, and logging it would add an entry to the User's history
     * on every dismissal. See the plan's Decisions ("Mark-seen isn't audit-logged").
     */
    markSeen: authenticatedProcedure
        .input(z.object({ through: z.iso.date() }))
        .mutation(async ({ ctx, input }) => {
            if (isImpersonating(ctx)) return;

            const cursor = clampSeenCursor(new Date(`${input.through}T00:00:00Z`));
            if (!cursor) return; // Empty collection: nothing can have been shown.

            // Conditional write, so a stale or out-of-order dismissal can't move the cursor back.
            await ctx.prisma.user.updateMany({
                where: {
                    id: ctx.userId,
                    OR: [
                        { lastSeenUpdatesAt: { lt: cursor } },
                        { lastSeenUpdatesAt: null, createdAt: { lt: cursor } },
                    ],
                },
                data: { lastSeenUpdatesAt: cursor },
            });
        }),
});
