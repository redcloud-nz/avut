/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The "what's new" popup's reads and its read cursor. Entries come from the
 * `updates` content collection (`@/lib/updates`), one per release; the only
 * database state is `User.lastSeenUpdatesVersion`. See content/updates/README.md.
 */

import * as z from "zod";

import {
    clampSeenVersion,
    compareVersions,
    getRecentUpdates,
    getUpdatesAfter,
} from "@/lib/updates";
import { UpdateVersion } from "@/lib/updates-shared";

import { authenticatedProcedure, createTrpcRouter, type AuthenticatedContext } from "../init";

/** How many entries the footer button's "recent" mode shows. */
const RECENT_LIMIT = 5;

/**
 * While an admin is impersonating a user, the popup stays quiet and the
 * impersonated user's cursor is left untouched.
 */
function isImpersonating(ctx: Pick<AuthenticatedContext, "auth">): boolean {
    return !!ctx.auth.session.impersonatedBy;
}

export const whatsNewRouter = createTrpcRouter({
    /**
     * Entries the caller hasn't seen: releases newer than their cursor. A null cursor has seen
     * none, but new accounts start at the newest entry (`auth.ts`), so only accounts from before
     * "What's new" existed are null.
     */
    getUnseen: authenticatedProcedure.query(async ({ ctx }) => {
        if (isImpersonating(ctx)) return { entries: [] };

        const user = await ctx.prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { lastSeenUpdatesVersion: true },
        });

        return { entries: getUpdatesAfter(user?.lastSeenUpdatesVersion ?? null) };
    }),

    /** The most recent entries, for reopening the dialog once nothing is unseen. */
    listRecent: authenticatedProcedure.query(() => {
        return { entries: getRecentUpdates(RECENT_LIMIT) };
    }),

    /**
     * Advance the caller's cursor to `through`, the newest version the dialog showed. It's clamped
     * to the newest visible entry, and it never moves the cursor backwards.
     *
     * Deliberately not audit-logged, departing from the "always `logEvent`"
     * rule: this is a read cursor, like a notification's read state, not a change
     * to the user record, and logging it would add an entry to the User's history
     * on every dismissal.
     */
    markSeen: authenticatedProcedure
        .input(z.object({ through: UpdateVersion }))
        .mutation(async ({ ctx, input }) => {
            if (isImpersonating(ctx)) return;

            const cursor = clampSeenVersion(input.through);
            if (!cursor) return; // No visible entries: nothing can have been shown.

            const user = await ctx.prisma.user.findUnique({
                where: { id: ctx.userId },
                select: { lastSeenUpdatesVersion: true },
            });
            const current = user?.lastSeenUpdatesVersion ?? null;
            if (current !== null && compareVersions(current, cursor) >= 0) return;

            // Versions don't order as strings, so compare above and write only if the cursor is
            // still what was read — a concurrent dismissal can't then be moved back.
            await ctx.prisma.user.updateMany({
                where: { id: ctx.userId, lastSeenUpdatesVersion: current },
                data: { lastSeenUpdatesVersion: cursor },
            });
        }),
});
