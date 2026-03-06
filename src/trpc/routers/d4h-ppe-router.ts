/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";
import {
    AuthenticatedOrganizationContext,
    createTrpcRouter,
    organizationProcedure,
} from "../init";
import {
    D4hPpeTemplate,
    D4hPpeTemplateId,
} from "@/lib/schemas/d4h-ppe-template";
import { diffObject } from "@/lib/diff";
import { TRPCError } from "@trpc/server";
import {
    getD4HEquipmentBrands,
    getD4HEquipmentModels,
} from "@/lib/d4h-api/client";
import { getConfiguredD4HViewsAccessToken } from "@/server/d4h-access-token";

export const d4hPpeRouter = createTrpcRouter({
    /**
     * Create a new D4H PPE Template.
     */
    createTemplate: organizationProcedure({ d4hPpeTemplate: ["create"] })
        .input(
            z.object({
                d4hPpeTemplateId: z.string(),
                create: D4hPpeTemplate.modifiableSchema,
            }),
        )
        .output(z.object({ created: D4hPpeTemplate.schema }))
        .mutation(async ({ ctx, input: { d4hPpeTemplateId, create } }) => {
            const diff = diffObject({}, create);

            const [created] = await Promise.all([
                ctx.prisma.d4hPpeTemplate.create({
                    data: {
                        id: d4hPpeTemplateId,
                        organizationId: ctx.organizationId,
                        d4hModelIds: [],
                        ...create,
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "D4hPpeTemplate",
                    objectId: d4hPpeTemplateId,
                    changes: diff,
                }),
            ]);

            return { created: D4hPpeTemplate.fromRecord(created) };
        }),

    /**
     * Delete a D4H PPE Template. This is a hard delete and cannot be undone.
     */
    deleteTemplate: organizationProcedure({ d4hPpeTemplate: ["delete"] })
        .input(z.object({ d4hPpeTemplateId: D4hPpeTemplateId.schema }))
        .output(z.object({ deleted: D4hPpeTemplate.schema }))
        .mutation(async ({ ctx, input: { d4hPpeTemplateId } }) => {
            const existing = await getD4hPpeTemplateOrThrow(
                ctx,
                d4hPpeTemplateId,
            );

            await Promise.all([
                ctx.prisma.d4hPpeTemplate.delete({
                    where: { id: d4hPpeTemplateId },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "D4hPpeTemplate",
                    objectId: d4hPpeTemplateId,
                    changes: diffObject(existing, {}),
                }),
            ]);

            return { deleted: existing };
        }),

    /**
     * List all D4H PPE Templates for the organization.
     */
    listTemplates: organizationProcedure({ d4hPpeTemplate: ["view"] })
        .output(z.array(D4hPpeTemplate.schema))
        .query(async ({ ctx }) => {
            const templates = await ctx.prisma.d4hPpeTemplate.findMany({
                where: { organizationId: ctx.organizationId },
            });
            return templates.map(D4hPpeTemplate.fromRecord);
        }),

    /**
     * Update a D4H PPE Template. Only the fields included in the input will be updated.
     */
    updateTemplate: organizationProcedure({ d4hPpeTemplate: ["update"] })
        .input(
            z.object({
                d4hPpeTemplateId: D4hPpeTemplateId.schema,
                update: D4hPpeTemplate.modifiableSchema,
            }),
        )
        .output(z.object({ updated: D4hPpeTemplate.schema }))
        .mutation(async ({ ctx, input: { d4hPpeTemplateId, update } }) => {
            const existing = await getD4hPpeTemplateOrThrow(
                ctx,
                d4hPpeTemplateId,
            );

            const [updated] = await Promise.all([
                ctx.prisma.d4hPpeTemplate.update({
                    where: { id: d4hPpeTemplateId },
                    data: update,
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "D4hPpeTemplate",
                    objectId: d4hPpeTemplateId,
                    changes: diffObject(existing, update),
                }),
            ]);

            return { updated: D4hPpeTemplate.fromRecord(updated) };
        }),
});

async function getD4hPpeTemplateOrThrow(
    ctx: AuthenticatedOrganizationContext,
    d4hPpeTemplateId: D4hPpeTemplateId,
) {
    const d4hPpeTemplate = await ctx.prisma.d4hPpeTemplate.findUnique({
        where: { id: d4hPpeTemplateId, organizationId: ctx.organizationId },
    });

    if (!d4hPpeTemplate) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `D4H PPE Template with id ${d4hPpeTemplateId} not found`,
        });
    }
    return D4hPpeTemplate.fromRecord(d4hPpeTemplate);
}
