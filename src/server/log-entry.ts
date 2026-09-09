/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * The single write path for the audit log.
 *
 * Deliberately NOT marked `server-only` and deliberately free of any `@/server/prisma`
 * import — the Prisma client is injected by the caller, so this can be exercised from the
 * jsdom test environment against `createMockPrisma()`. Same reasoning as
 * `organization-settings-store.ts`.
 *
 * Every write-time invariant lives here rather than in database CHECK constraints, which
 * Prisma models poorly. They are write-time only and DO NOT hold on read: `userId` is
 * `onDelete: SetNull`, so a human-actor entry can later hold a null `userId`. Read-side
 * code must tolerate a null actor and fall back to `actorLabel`. Do not re-assert these
 * invariants as zod parses on query results.
 */

import * as z from "zod";

import type { LogBatch, LogEntry, Prisma, PrismaClient } from "@/generated/prisma/client";
import { DiffChange } from "@/lib/diff";
import { nanoId16 } from "@/lib/id";
import { Operations, type OperationKey } from "@/lib/operations";
import { LogAction, LogObjectType, LogRefRoleInput, LogScope } from "@/lib/schemas/log-entry";
import type { OrganizationId } from "@/lib/schemas/organization";
import type { UserId } from "@/lib/schemas/user";

/** The slice of the Prisma client this module needs. */
export type LogEntryPrisma = Pick<PrismaClient, "logEntry" | "logBatch">;

/**
 * A human actor, or none.
 *
 * An operation run identifies itself through its `LogBatch` instead, which is why a null
 * actor is only legal alongside a `batchId`.
 */
export type LogActor = { userId: UserId; impersonatorId?: UserId } | null;

/**
 * An extra entity an entry is relevant to. The primary is implicit — `role` cannot name it,
 * see `LogRefRoleInput`.
 */
export interface LogEntryRef {
    objectType: LogObjectType;
    objectId: string;
    role?: LogRefRoleInput;
}

export interface RecordLogEntryInput {
    scope: LogScope;
    organizationId?: OrganizationId | null;
    ownerId?: UserId | null;
    actor: LogActor;
    /**
     * The actor's display name and email, denormalized so the entry stays readable after
     * the user is deleted — or the operation label for an unattended run.
     */
    actorLabel?: string;
    /** An existing `LogBatch.id`. Required when `actor` is null. */
    batchId?: string;
    action: LogAction;
    objectType: LogObjectType;
    objectId: string;
    changes?: DiffChange[];
    description?: string;
    /** Extra entities this entry is relevant to. The primary is added automatically. */
    refs?: LogEntryRef[];
}

export interface CreateLogBatchInput {
    operationKey: OperationKey;
    userId?: UserId;
    actorLabel?: string;
    description?: string;
}

/** Thrown when a log entry would violate a write-time invariant. */
export class LogEntryInvariantError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LogEntryInvariantError";
    }
}

/** The denormalized actor label format. One place, so entries render consistently. */
export function formatActorLabel(name: string, email: string): string {
    return `${name} <${email}>`;
}

/**
 * Takes the already-parsed `scope` rather than reading `input.scope`, so the switch is
 * exhaustive over `LogScope` by construction. Reading the unparsed field would let an
 * off-vocabulary scope fall straight through the switch and write an entry with *neither*
 * owner invariant enforced.
 */
function assertOwnerInvariant(scope: LogScope, input: RecordLogEntryInput): void {
    const hasOrganization = input.organizationId != null;
    const hasOwner = input.ownerId != null;

    switch (scope) {
        case "organization":
            if (!hasOrganization)
                throw new LogEntryInvariantError(
                    'A log entry with scope "organization" requires an organizationId.',
                );
            if (hasOwner)
                throw new LogEntryInvariantError(
                    'A log entry with scope "organization" must not set an ownerId.',
                );
            return;
        case "user":
            if (!hasOwner)
                throw new LogEntryInvariantError(
                    'A log entry with scope "user" requires an ownerId.',
                );
            if (hasOrganization)
                throw new LogEntryInvariantError(
                    'A log entry with scope "user" must not set an organizationId.',
                );
            return;
        case "system":
            if (hasOrganization || hasOwner)
                throw new LogEntryInvariantError(
                    'A log entry with scope "system" must set neither an organizationId nor an ownerId.',
                );
            return;
        default: {
            // Unreachable while `scope` is parsed against `LogScope.schema` first — this
            // arm is what makes adding a scope value a compile error here rather than a
            // silently unguarded entry.
            const unhandled: never = scope;
            throw new LogEntryInvariantError(`Unhandled log entry scope "${String(unhandled)}".`);
        }
    }
}

function assertActorInvariant(input: RecordLogEntryInput): void {
    if (input.actor == null && input.batchId == null) {
        throw new LogEntryInvariantError(
            "A log entry with no actor requires a batchId — an entry with neither has no provenance.",
        );
    }
}

/**
 * Record a log entry, and the `LogEntryObject` rows indexing it, as one write.
 *
 * Validates synchronously and returns the un-awaited `PrismaPromise`, so an invariant
 * violation surfaces at the call site and the result still composes into
 * `prisma.$transaction([...])`. Do not make this `async`.
 */
export function recordLogEntry(
    input: RecordLogEntryInput,
    tx: LogEntryPrisma,
): Prisma.PrismaPromise<LogEntry> {
    // `scope` and `action` are stored as text columns, so nothing downstream rejects a value
    // off their unions — the parse here is the whole guarantee, and `scope` in particular
    // must be parsed before the owner invariant switches on it.
    const scope = parseOrThrow(LogScope.schema, input.scope, `Unknown scope "${input.scope}".`);
    const action = parseOrThrow(
        LogAction.schema,
        input.action,
        `Unknown action "${input.action}".`,
    );

    assertOwnerInvariant(scope, input);
    assertActorInvariant(input);

    const objectType = parseOrThrow(
        LogObjectType.schema,
        input.objectType,
        `Unknown objectType "${input.objectType}".`,
    );

    // Refs duplicating the primary are a no-op, not a duplicate row — a caller passing
    // the primary again should not trip the partial unique index.
    const refs = (input.refs ?? []).filter(
        (ref) => !(ref.objectType === objectType && ref.objectId === input.objectId),
    );

    const refRows = refs.map((ref) => ({
        id: nanoId16(),
        objectType: parseOrThrow(
            LogObjectType.schema,
            ref.objectType,
            `Unknown ref objectType "${ref.objectType}".`,
        ),
        objectId: ref.objectId,
        // `LogRefRoleInput`, not `LogRefRole`: the type already forbids `primary`, and this
        // is the runtime half of the same rule for callers that reach here untyped.
        role: parseOrThrow(
            LogRefRoleInput.schema,
            ref.role ?? "context",
            `Invalid ref role "${ref.role}" — "primary" is written by recordLogEntry itself.`,
        ),
    }));

    return tx.logEntry.create({
        data: {
            id: nanoId16(),
            scope,
            organizationId: input.organizationId ?? null,
            ownerId: input.ownerId ?? null,
            userId: input.actor?.userId ?? null,
            actorLabel: input.actorLabel ?? null,
            impersonatorId: input.actor?.impersonatorId ?? null,
            batchId: input.batchId ?? null,
            action,
            objectType,
            objectId: input.objectId,
            // Parsed, not merely cast. `logEvent` used to do this; centralising it here
            // means the better-auth hooks and every future caller get it too. The cast is
            // Prisma's Json input plumbing and is unavoidable — the parse is the guarantee.
            changes: z.array(DiffChange.schema).parse(input.changes ?? []) as object[],
            description: input.description,
            objects: {
                create: [
                    {
                        id: nanoId16(),
                        objectType,
                        objectId: input.objectId,
                        role: "primary",
                    },
                    ...refRows,
                ],
            },
        },
    });
}

/**
 * Open a batch.
 *
 * Entries reference the batch, so the batch row must exist before them. Prisma's
 * sequential `$transaction([...])` runs in array order, so `[createBatch, ...writes,
 * ...logEvents]` is correct — but reordering that array breaks the FK. Keep the batch
 * create first.
 */
export function createLogBatch(
    input: CreateLogBatchInput,
    tx: LogEntryPrisma,
): Prisma.PrismaPromise<LogBatch> {
    // `Object.hasOwn`, not `in`: `in` walks the prototype chain, so `"constructor"` and
    // `"toString"` would pass the very check this function exists to make impossible.
    if (!Object.hasOwn(Operations, input.operationKey)) {
        throw new LogEntryInvariantError(
            `Unknown operationKey "${input.operationKey}". Add it to the Operations registry.`,
        );
    }

    return tx.logBatch.create({
        data: {
            id: nanoId16(),
            operationKey: input.operationKey,
            userId: input.userId ?? null,
            actorLabel: input.actorLabel ?? null,
            description: input.description,
        },
    });
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
    const result = schema.safeParse(value);
    if (!result.success) throw new LogEntryInvariantError(message);
    return result.data;
}
