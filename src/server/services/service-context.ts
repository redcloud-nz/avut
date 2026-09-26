/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { DiffChange } from "@/lib/diff";
import type { LogAction, LogEntryRecord, LogObjectType } from "@/lib/schemas/log-entry";
import type { OrganizationId } from "@/lib/schemas/organization";
import type { UserId } from "@/lib/schemas/user";
import type { LogEntryRef } from "@/server/log-entry";

export interface LogEventOptions {
    action: LogAction;
    objectType: LogObjectType;
    objectId: string;
    changes?: DiffChange[];
    description?: string;
    /** Extra entities this entry is relevant to. The primary is implicit. */
    refs?: LogEntryRef[];
    /** An existing `LogBatch.id`, when this entry is part of a multi-entry operation. */
    batchId?: string;
}

/**
 * The narrow context every domain service (`src/server/services/*.ts`) takes. Reachable from a
 * tRPC procedure, a Server Component, or a test — `AuthenticatedOrganizationContext`
 * (`src/trpc/init.ts`) `satisfies` this, so there is no adapter at call sites.
 */
export interface OrgServiceContext {
    prisma: PrismaClient;
    organizationId: OrganizationId;
    userId: UserId;
    logEvent: (
        options: LogEventOptions,
        tx?: Prisma.TransactionClient,
    ) => Prisma.PrismaPromise<LogEntryRecord>;
}

/**
 * Binds an existing `LogBatch` so every `ctx.logEvent` call made through the returned context
 * joins it, without threading a `batchId` parameter through every helper in between. Does not
 * create the batch — pass the id from `createLogBatch`.
 */
export function withBatch<C extends OrgServiceContext>(ctx: C, batchId: string): C {
    return {
        ...ctx,
        logEvent: (options, tx) => ctx.logEvent({ ...options, batchId }, tx),
    };
}
