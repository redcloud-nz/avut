/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import type { Permissions } from "@/lib/permissions";
import { LogObjectType } from "@/lib/schemas/log-entry";
import {
    HistoryObjects,
    HistoryObjectType,
    ObjectHistoryPage,
    RelatedEntryPermissions,
} from "@/lib/schemas/object-history";
import * as ObjectHistory from "@/server/services/object-history";

import {
    createTrpcRouter,
    organizationProcedure,
    type AuthenticatedOrganizationContext,
} from "../init";

/** `ctx.hasPermission` without the throw: `false` on a `FORBIDDEN` denial, anything else rethrown. */
async function canView(
    ctx: AuthenticatedOrganizationContext,
    permissions: Permissions,
): Promise<boolean> {
    try {
        await ctx.hasPermission(ctx.organizationId, permissions);
        return true;
    } catch (error) {
        if (error instanceof TRPCError && error.code === "FORBIDDEN") return false;
        throw error;
    }
}

/**
 * The permission each gated object type's *related* entries need: a type with a History page
 * falls back to its `HistoryObjects` permission (fail closed), and `RelatedEntryPermissions`
 * overlays that.
 */
const relatedEntryGates: Partial<Record<LogObjectType, Permissions>> = {
    ...Object.fromEntries(
        HistoryObjectType.values.map((type) => [type, HistoryObjects[type].permissions]),
    ),
    ...RelatedEntryPermissions,
};

/**
 * The object types whose *related* entries the caller may see: each type in `relatedEntryGates`
 * whose permission the caller holds, plus every type in neither map (those pass through).
 */
async function allowedRelatedTypes(ctx: AuthenticatedOrganizationContext) {
    const gated = Object.entries(relatedEntryGates) as [LogObjectType, Permissions][];

    const allowed = await Promise.all(
        gated.map(async ([type, permissions]) => ((await canView(ctx, permissions)) ? [type] : [])),
    );

    const ungated = LogObjectType.values.filter((type) => !Object.hasOwn(relatedEntryGates, type));

    return [...allowed.flat(), ...ungated];
}

/**
 * Router for per-object History pages (#48) — the read side of the audit log.
 */
export const historyRouter = createTrpcRouter({
    /**
     * One page of an object's history, newest first: entries about the object, plus related
     * entries (ones that mention it through a ref) of the types the caller may view.
     *
     * Declared with only `organization: ["view"]`; the object type's own permission comes from
     * the `HistoryObjects` registry and is checked here, so one procedure serves every type.
     * @throws TRPCError(FORBIDDEN) if the caller can't view that type of object.
     */
    listObjectHistory: organizationProcedure()
        .input(
            z.object({
                objectType: HistoryObjectType.schema,
                objectId: z.string().min(1),
                /** Named `cursor` so `infiniteQueryOptions` pages through it. */
                cursor: z.number().int().optional(),
                limit: z.number().int().min(1).max(100).default(50),
            }),
        )
        .output(ObjectHistoryPage.schema)
        .query(async ({ ctx, input }) => {
            await ctx.hasPermission(
                ctx.organizationId,
                HistoryObjects[input.objectType].permissions,
            );

            return await ObjectHistory.list(ctx, {
                objectType: input.objectType,
                objectId: input.objectId,
                relatedTypes: await allowedRelatedTypes(ctx),
                cursor: input.cursor,
                limit: input.limit,
            });
        }),
});
