/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
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

/** What the task does to its D4H resource. v1 has only `Retire`. */
export const D4HTaskKind = {
    schema: z.enum(["Retire"]),
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

/** A task's `kind` paired with the `payload` that kind carries. */
export const D4HTaskPayload = {
    schema: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("Retire"), payload: retirePayloadSchema }),
    ]),

    retireSchema: retirePayloadSchema,
} as const;

export type D4HTaskPayload = z.infer<typeof D4HTaskPayload.schema>;

export type D4HRetireTaskPayload = z.infer<typeof D4HTaskPayload.retireSchema>;

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
