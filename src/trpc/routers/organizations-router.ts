/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { TRPCError } from "@trpc/server";

import { createTrpcRouter, organizationProcedure } from "../init";

export const organizationsRouter = createTrpcRouter({
    /**
     * Retrieves the organization details.
     * @param ctx The authenticated context.
     * @returns The organization object.
     * @throws TRPCError(NOT_FOUND) if the organization does not exist.
     */
    getOrganization: organizationProcedure.query(async ({ ctx, input }) => {
        const organization = await ctx.prisma.organization.findUnique({
            where: { id: ctx.organizationId },
        });

        if (!organization) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Organization not found",
            });
        }

        return organization;
    }),
});
