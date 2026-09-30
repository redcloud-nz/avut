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
import { recordLogEntry, type LogEntryRef } from "@/server/log-entry";

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
 * The narrow context a user-scoped domain service takes — one acting on the calling user's own
 * records, with no organization. `AuthenticatedContext` (`authenticatedProcedure` in
 * `src/trpc/init.ts`) satisfies it exactly, and its `logEvent` writes `scope: "user"` entries.
 *
 * An `OrgServiceContext` satisfies this too, structurally, but its `logEvent` writes to the
 * organization's log — so passing one would file a user's entry under the org. Call user-scoped
 * services only from `authenticatedProcedure` (or an equivalent user context).
 */
export interface UserServiceContext {
    prisma: PrismaClient;
    userId: UserId;
    logEvent: (
        options: LogEventOptions,
        tx?: Prisma.TransactionClient,
    ) => Prisma.PrismaPromise<LogEntryRecord>;
}

/**
 * The narrow context every organization-scoped domain service (`src/server/services/*.ts`)
 * takes. Reachable from a tRPC procedure, a Server Component, or a test —
 * `AuthenticatedOrganizationContext` (`src/trpc/init.ts`) `satisfies` this, so there is no
 * adapter at call sites. Its `logEvent` writes `scope: "organization"` entries.
 */
export type OrgServiceContext = UserServiceContext & {
    organizationId: OrganizationId;
};

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

/**
 * The context for an unattended run inside one organization (the Rubbish bin auto-purge): no
 * user, so there is no `userId`, and every entry is actor-less and joins `batch` — the only
 * provenance `recordLogEntry` accepts for an entry with no actor.
 */
export function unattendedOrgContext(
    prisma: PrismaClient,
    organizationId: OrganizationId,
    batch: { id: string; actorLabel: string },
): Pick<OrgServiceContext, "prisma" | "organizationId" | "logEvent"> {
    return {
        prisma,
        organizationId,
        logEvent: (options, tx = prisma) =>
            recordLogEntry(
                {
                    scope: "organization",
                    organizationId,
                    actor: null,
                    actorLabel: batch.actorLabel,
                    ...options,
                    batchId: batch.id,
                },
                tx,
            ),
    };
}
