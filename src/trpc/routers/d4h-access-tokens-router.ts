/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { addYears } from "date-fns";
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import {
    getD4hFetchClient,
    getD4HOrganizationsAccessibleWithToken,
    getD4HTeamsAccessibleWithToken,
} from "@/lib/d4h-api/client";
import { diffObject } from "@/lib/diff";
import {
    D4HAccessToken,
    D4HAccessToken_ServerOnly,
    D4hAccessTokenId,
} from "@/lib/schemas/d4h-access-token";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

/**
 * TRPC router for managing D4H access tokens. These tokens are used to sync data from D4H into AVUT.
 */
export const d4hAccessTokensRouter = createTrpcRouter({
    /**
     * Create a new D4H access token for the organization.
     */
    createOrganizationAccessToken: organizationProcedure({
        d4hAccessToken: ["create"],
    })
        .input(
            D4HAccessToken.schema
                .pick({
                    id: true,
                    label: true,
                    serverCode: true,
                })
                .extend({ token: z.string() }),
        )
        .output(D4HAccessToken.schema)
        .mutation(async ({ ctx, input }) => {
            const token = {
                ...input,

                organizationId: ctx.organizationId,
                userId: null,
                status: "",
                createdAt: new Date().toISOString(),
                expiresAt: addYears(new Date(), 10).toISOString(),
                metadata: {
                    d4HTeams: [],
                    d4HOrganizations: [],
                },
            } satisfies D4HAccessToken;

            // Check the token by making a request to the D4H API
            const fetchClient = getD4hFetchClient(token);
            const { response } = await fetchClient.GET("/v3/whoami");

            // Check which teams and organizations are accessible with this token
            const d4HTeams = await getD4HTeamsAccessibleWithToken(token);
            const d4HOrganizations =
                await getD4HOrganizationsAccessibleWithToken(token);

            const created = await ctx.prisma.d4hAccessToken.create({
                data: {
                    ...token,
                    status: response.statusText,
                    metadata: {
                        d4HTeams: d4HTeams as object[],
                        d4HOrganizations: d4HOrganizations as object[],
                    },
                },
            });

            const changes = diffObject({}, input);

            await ctx.logEvent({
                action: "Create",
                objectType: "D4hAccessToken",
                objectId: created.id,
                changes,
            });

            return D4HAccessToken.fromRecord(created);
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
                    message: Messages.d4HAccessTokenNotFound(input.tokenId),
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

    /**
     * Get a specific D4H access token by ID. Only returns tokens that belong to the organization.
     */
    getOrganizationAccessToken: organizationProcedure({
        d4hAccessToken: ["view"],
    })
        .input(
            z.object({
                tokenId: D4hAccessTokenId.schema,
            }),
        )
        .output(D4HAccessToken.schema)
        .query(async ({ input, ctx }) => {
            const record = await ctx.prisma.d4hAccessToken.findUnique({
                where: {
                    id: input.tokenId,
                    organizationId: ctx.organizationId,
                },
            });

            if (!record)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.d4HAccessTokenNotFound(input.tokenId),
                });

            return D4HAccessToken.fromRecord(record);
        }),

    /**
     * List all D4H access tokens that have been saved for the organization.
     */
    listOrganizationAccessTokens: organizationProcedure({
        d4hAccessToken: ["view"],
    })
        .output(z.array(D4HAccessToken.schema))
        .query(async ({ ctx }) => {
            const records = await ctx.prisma.d4hAccessToken.findMany({
                where: { organizationId: ctx.organizationId },
            });

            return records.map(D4HAccessToken.fromRecord);
        }),

    refreshToken: organizationProcedure({
        d4hAccessToken: ["update"],
    })
        .input(
            z.object({
                tokenId: D4hAccessTokenId.schema,
            }),
        )
        .mutation(async ({ input, ctx }) => {
            const record = await ctx.prisma.d4hAccessToken.findUnique({
                where: {
                    id: input.tokenId,
                    organizationId: ctx.organizationId,
                },
            });

            if (!record)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.d4HAccessTokenNotFound(input.tokenId),
                });

            const token = D4HAccessToken_ServerOnly.fromRecord(record);

            const d4HTeams = await getD4HTeamsAccessibleWithToken(token);
            const d4HOrganizations =
                await getD4HOrganizationsAccessibleWithToken(token);

            await ctx.prisma.d4hAccessToken.update({
                where: { id: input.tokenId },
                data: {
                    metadata: {
                        d4HTeams: d4HTeams as object[],
                        d4HOrganizations: d4HOrganizations as object[],
                    },
                },
            });
        }),
});
