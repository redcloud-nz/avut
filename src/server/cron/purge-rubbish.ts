/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import prisma from "@/server/prisma";
import * as Trash from "@/server/services/trash";
import * as UserAccounts from "@/server/services/user-accounts";

/**
 * Binds the Rubbish bin auto-purge to the real Prisma client for `/api/cron/purge-rubbish`: every
 * organization's bin, then the system bin's accounts. The logic lives in the services, which
 * take the client so they stay testable.
 */
export async function purgeRubbish(now: Date = new Date()) {
    const organizations = await Trash.runAutoPurge(prisma, now);
    const users = await UserAccounts.runAutoPurge(prisma, now);
    return { organizations, users };
}
