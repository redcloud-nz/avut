/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { D4HTask as D4HTaskRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

export type { D4HTaskRecord };

export const D4HTaskId = {
    schema: zodNanoId16("D4HTaskId expected").brand<"D4HTaskId">(),

    create: (): D4HTaskId => D4HTaskId.schema.parse(nanoId16()),
} as const;

export type D4HTaskId = string & z.BRAND<"D4HTaskId">;

/**
 * A task's lifecycle: `Open → Done | Dismissed`. `Done` means the change was confirmed applied in
 * D4H; `Dismissed` closes it without applying (e.g. the item was already handled or deleted).
 */
export const D4HTaskStatus = {
    schema: z.enum(["Open", "Done", "Dismissed"]),
} as const;

export type D4HTaskStatus = z.infer<typeof D4HTaskStatus.schema>;

/**
 * What the task does to its D4H resource: `Retire` (queued by an I3 Return), or `SetSerial`,
 * `SetVariant` and `MarkLost` (queued by a Self Audit Campaign's fixes).
 */
export const D4HTaskKind = {
    schema: z.enum(["Retire", "SetSerial", "SetVariant", "MarkLost"]),
} as const;

export type D4HTaskKind = z.infer<typeof D4HTaskKind.schema>;

/** How the task is applied: `Manual` (by hand in D4H's web app) or `Api`. v1 only writes `Manual`. */
export const D4HTaskApplyMethod = {
    schema: z.enum(["Manual", "Api"]),
} as const;

export type D4HTaskApplyMethod = z.infer<typeof D4HTaskApplyMethod.schema>;

/** The D4H resource type a task applies to. v1 has only `Equipment`. */
export const D4HTaskResourceType = {
    schema: z.enum(["Equipment"]),
} as const;

export type D4HTaskResourceType = z.infer<typeof D4HTaskResourceType.schema>;

const retirePayloadSchema = z.object({
    /** Shown to whoever applies the task; AVUT doesn't look up D4H's retired-reason ids. */
    reason: z.string().min(1),
    /**
     * Context for whoever applies the task, e.g. who received a returned item and the Return's
     * comments. A Return makes no D4H write of its own, so this is the only place they're kept.
     */
    note: z.string().min(1).optional(),
});

/** Context for whoever applies the task, e.g. which self-audit reported the change. */
const taskNoteSchema = z.string().min(1).optional();

const setSerialPayloadSchema = z.object({
    /** The serial to set, trimmed. */
    serial: z.string().min(1),
    note: taskNoteSchema,
});

const setVariantPayloadSchema = z.object({
    /** D4H's brand title, as D4H's edit form lists it. */
    brand: z.string().min(1),
    /** D4H's model title, as D4H's edit form lists it. */
    model: z.string().min(1),
    note: taskNoteSchema,
});

const markLostPayloadSchema = z.object({
    note: taskNoteSchema,
});

/** A task's `kind` paired with the `payload` that kind carries. */
export const D4HTaskPayload = {
    schema: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("Retire"), payload: retirePayloadSchema }),
        z.object({ kind: z.literal("SetSerial"), payload: setSerialPayloadSchema }),
        z.object({ kind: z.literal("SetVariant"), payload: setVariantPayloadSchema }),
        z.object({ kind: z.literal("MarkLost"), payload: markLostPayloadSchema }),
    ]),

    retireSchema: retirePayloadSchema,
    setSerialSchema: setSerialPayloadSchema,
    setVariantSchema: setVariantPayloadSchema,
    markLostSchema: markLostPayloadSchema,
} as const;

export type D4HTaskPayload = z.infer<typeof D4HTaskPayload.schema>;

export type D4HRetireTaskPayload = z.infer<typeof D4HTaskPayload.retireSchema>;
export type D4HSetSerialTaskPayload = z.infer<typeof D4HTaskPayload.setSerialSchema>;
export type D4HSetVariantTaskPayload = z.infer<typeof D4HTaskPayload.setVariantSchema>;
export type D4HMarkLostTaskPayload = z.infer<typeof D4HTaskPayload.markLostSchema>;

const d4hTaskBaseSchema = z.object({
    id: D4HTaskId.schema,
    organizationId: z.string(),
    d4hTeamId: z.number().int(),
    resourceType: D4HTaskResourceType.schema,
    resourceId: z.number().int(),
    /** A display label for the resource, e.g. `#1234 Helmet`. */
    itemLabel: z.string(),
    status: D4HTaskStatus.schema,
    applyMethod: D4HTaskApplyMethod.schema,
    /** Null once the requester's account has been purged. */
    requestedById: z.string().nullable(),
    requestedAt: z.iso.datetime(),
    /** For a `Manual` task, whoever confirmed the change was applied. Null while open or dismissed. */
    appliedById: z.string().nullable(),
    appliedAt: z.iso.datetime().nullable(),
    formInstanceId: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

const d4hTaskSchema = z.discriminatedUnion("kind", [
    d4hTaskBaseSchema.extend({ kind: z.literal("Retire"), payload: retirePayloadSchema }),
    d4hTaskBaseSchema.extend({ kind: z.literal("SetSerial"), payload: setSerialPayloadSchema }),
    d4hTaskBaseSchema.extend({ kind: z.literal("SetVariant"), payload: setVariantPayloadSchema }),
    d4hTaskBaseSchema.extend({ kind: z.literal("MarkLost"), payload: markLostPayloadSchema }),
]);

export const D4HTask = {
    schema: d4hTaskSchema,

    fromRecord: (record: D4HTaskRecord): D4HTask =>
        d4hTaskSchema.parse({
            ...record,
            requestedAt: record.requestedAt.toISOString(),
            appliedAt: record.appliedAt?.toISOString() ?? null,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        }),
} as const;

export type D4HTask = z.infer<typeof d4hTaskSchema>;
