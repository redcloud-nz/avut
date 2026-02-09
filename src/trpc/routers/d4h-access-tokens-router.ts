/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { getD4hFetchClient } from "@/lib/d4h-api/client";
import { diffObject } from "@/lib/diff";
import {
    D4hAccessTokenData,
    D4hAccessTokenId,
} from "@/lib/schemas/d4h-access-token";

import { createTrpcRouter, organizationProcedure } from "../init";
import { addYears } from "date-fns";
import { TRPCError } from "@trpc/server";

export const d4hAccessTokensRouter = createTrpcRouter({
    /**
     * Create a new D4H access token for the organization.
     */
    createOrganizationAccessToken: organizationProcedure({
        d4hAccessToken: ["create"],
    })
        .input(
            D4hAccessTokenData.schema.pick({
                id: true,
                label: true,
                serverCode: true,
                token: true,
                metadata: true,
            }),
        )
        .output(D4hAccessTokenData.schema)
        .mutation(async ({ ctx, input }) => {
            const token = {
                ...input,

                organizationId: ctx.organizationId,
                userId: null,
                status: "",
                createdAt: new Date().toISOString(),
                expiresAt: addYears(new Date(), 10).toISOString(),
                metadata: input.metadata,
            } satisfies D4hAccessTokenData;

            // Check the token by making a request to the D4H API
            const fetchClient = getD4hFetchClient(token);
            const { response } = await fetchClient.GET("/v3/whoami");

            const created = await ctx.prisma.d4hAccessToken.create({
                data: {
                    ...token,
                    status: response.statusText,
                },
            });

            const changes = diffObject({}, input);

            await ctx.logEvent({
                action: "Create",
                objectType: "D4hAccessToken",
                objectId: created.id,
                changes,
            });

            return D4hAccessTokenData.fromRecord(created);
        }),

    /**
     * Delete a saved organization access token. This does not revoke the token in D4H, but removes it from AVUT.
     */
    deleteOrganizationAccessToken: organizationProcedure({
        d4hAccessToken: ["delete"],
    })
        .input(
            z.object({
                tokenId: D4hAccessTokenId.schema,
            }),
        )
        .mutation(async ({ input, ctx }) => {
            const existing = await ctx.prisma.d4hAccessToken.findUnique({
                where: { id: input.tokenId },
            });

            if (!existing || existing.organizationId !== ctx.organizationId) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Access token not found",
                });
            }

            await ctx.prisma.d4hAccessToken.delete({
                where: { id: input.tokenId },
            });

            await ctx.logEvent({
                action: "Delete",
                objectType: "D4hAccessToken",
                objectId: existing.id,
            });

            // Delete any organization config entries that reference this token
            await ctx.prisma.organizationConfig.delete({
                where: {
                    organizationId_key: {
                        organizationId: ctx.organizationId,
                        key: `integrations.d4h.syncToken`,
                    },
                    value: { equals: input.tokenId },
                },
            });
        }),

    getOrganizationAccessToken: organizationProcedure({
        d4hAccessToken: ["view"],
    })
        .input(
            z.object({
                tokenId: D4hAccessTokenId.schema,
            }),
        )
        .output(
            z.object({
                token: D4hAccessTokenData.schema,
            }),
        )
        .query(async ({ input, ctx }) => {
            const token = await ctx.prisma.d4hAccessToken.findUnique({
                where: {
                    id: input.tokenId,
                    organizationId: ctx.organizationId,
                },
            });

            if (!token)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Access token not found",
                });

            return { token: D4hAccessTokenData.fromRecord(token) };
        }),

    listOrganizationAccessTokens: organizationProcedure({
        d4hAccessToken: ["view"],
    })
        .output(D4hAccessTokenData.schema.array())
        .query(async ({ ctx }) => {
            const tokens = await ctx.prisma.d4hAccessToken.findMany({
                where: { organizationId: ctx.organizationId },
            });

            return tokens.map(D4hAccessTokenData.fromRecord);
        }),
});
