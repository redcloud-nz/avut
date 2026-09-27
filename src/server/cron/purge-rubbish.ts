/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import prisma from "@/server/prisma";
import * as Trash from "@/server/services/trash";

/**
 * Binds the Rubbish bin auto-purge to the real Prisma client for `/api/cron/purge-rubbish`. The
 * logic lives in `Trash.runAutoPurge`, which takes the client so it stays testable.
 */
export function purgeRubbish(now: Date = new Date()): Promise<Trash.AutoPurgeResult[]> {
    return Trash.runAutoPurge(prisma, now);
}
