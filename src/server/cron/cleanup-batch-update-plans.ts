/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import prisma from "@/server/prisma";
import * as BatchUpdatePlans from "@/server/services/batch-update-plans";

/**
 * Binds the batch-update-plan cleanup to the real Prisma client for
 * `/api/cron/cleanup-batch-update-plans`: stale `Executing` plans are marked `Failed` and expired
 * plans are deleted. The logic lives in the service, which takes the client so it stays testable.
 */
export async function cleanupBatchUpdatePlans(now: Date = new Date()) {
    return BatchUpdatePlans.runCleanup(prisma, now);
}
