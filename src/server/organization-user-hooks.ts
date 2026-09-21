/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Deliberately NOT marked `server-only` and free of any prisma import — the revalidation callback
 * is injected so this can be exercised against a real Better Auth instance from the jsdom test
 * environment.
 */

import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

/**
 * Global `hooks.after` that drops a user's cached organization roles when they leave an
 * organization.
 *
 * `organizationProcedure` authorizes against `getOrganizationUserRolesOrNull`, a `"use cache"`
 * lookup, so a membership change has to invalidate it or the old roles keep granting access. The
 * `organizationHooks` covering removal and role changes never fire for `/organization/leave`:
 * Better Auth's `leaveOrganization` endpoint deletes the member through the adapter directly,
 * unlike `removeMember`. A global after-hook on the path is the only place that write can't
 * route around.
 *
 * Revalidates whether or not the leave succeeded — dropping a cache tag is harmless, and it
 * spares this from inspecting the endpoint's result.
 */
export function revalidateRolesAfterLeave(revalidate: (userId: string) => Promise<void>) {
    return createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/organization/leave") return;

        const session = await getSessionFromCtx(ctx);
        if (session) await revalidate(session.user.id);
    });
}
