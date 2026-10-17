/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { SystemServiceContext } from "@/server/services/service-context";

import type { SystemAdminContext } from "./init";

/** A system admin's context, as a system-scoped service takes it: every entry system-scoped. */
export function systemServiceContext(ctx: SystemAdminContext): SystemServiceContext {
    return {
        prisma: ctx.prisma,
        logSystemEvent: (options, tx) => ctx.logEvent({ scope: "system", ...options }, tx),
    };
}
