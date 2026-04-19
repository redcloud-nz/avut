/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { OrganizationData } from "@/lib/schemas/organization";
import { auth } from "@/server/auth";
import { revalidateOrganization } from "@/server/organization";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

export const organizationsRouter = createTrpcRouter({
    /**
     * Retrieves the organization details.
     * @param ctx The authenticated context.
     * @returns The organization object.
     * @throws TRPCError(NOT_FOUND) if the organization does not exist.
     */
    getOrganization: organizationProcedure({ organization: ["view"] })
        .output(OrganizationData.schema)
        .query(async ({ ctx }) => {
            const organization = await ctx.prisma.organization.findUnique({
                where: { id: ctx.organizationId },
            });

            if (!organization) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Organization not found",
                });
            }

            return OrganizationData.fromRecord(organization);
        }),

    /**
     * Updates the organization details.
     */
    updateOrganization: organizationProcedure({ organization: ["update"] })
        .input(
            z.object({
                update: OrganizationData.modifiableSchema,
            }),
        )
        .output(
            z.object({
                updated: OrganizationData.schema,
            }),
        )
        .mutation(async ({ ctx, input: { update } }) => {
            const existing = await ctx.prisma.organization.findUnique({
                where: { id: ctx.organizationId },
            });

            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.organizationNotFound(ctx.organizationId),
                });
            }

            await auth.api.updateOrganization({
                headers: ctx.headers,
                body: {
                    organizationId: ctx.organizationId,
                    data: {
                        slug: update.slug,
                        name: update.name,
                    },
                },
            });

            const changes = diffObject(OrganizationData.modifiableSchema.parse(existing), update);

            await ctx.logEvent({
                action: "Update",
                objectType: "Organization",
                objectId: ctx.organizationId,
                changes,
            });

            await revalidateOrganization(update.slug);

            return {
                updated: OrganizationData.fromRecord({
                    ...existing,
                    ...update,
                }),
            };
        }),
});
