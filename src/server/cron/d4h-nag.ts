/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import prisma from "@/server/prisma";
import * as D4HNagRunner from "@/server/services/d4h-nag-runner";

/**
 * Binds the D4H attendance reminder dispatcher to the real Prisma client for
 * `/api/cron/d4h-nag`: stuck runs cleaned up, due rules run in every organization with the module
 * on, old runs pruned in every organization. The logic lives in the service, which takes the
 * client so it stays testable.
 */
export async function runD4HNagDue(now: Date = new Date()) {
    return D4HNagRunner.runDue(prisma, now);
}
