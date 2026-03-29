/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { addYears } from "date-fns";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { getD4HFetchClient, getD4HTokenMetadata } from "@/server/d4h-api/client";
import { D4HWhoami } from "@/lib/schemas/d4h/whoami";
import { diffObject } from "@/lib/diff";
import {
    D4HAccessToken,
    D4HAccessToken_ServerOnly,
    D4HAccessTokenId,
    D4HAccessTokenMetadata,
} from "@/lib/schemas/d4h-access-token";
import { D4HServerCode } from "@/lib/d4h-servers";

import { decryptDBValue, encryptDBValue } from "@/server/encrypt";
import { revalidateOrganizationSettings } from "@/server/organization-settings";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";
import { revalidatePersonalD4HAccessTokenForUser } from "@/server/d4h-access-token";

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
            z.object({
                tokenId: D4HAccessTokenId.schema,
                create: z.object({
                    serverCode: D4HServerCode.schema,
                    label: z.string(),
                    token: z.string(),
                }),
            }),
        )
        .output(z.object({ created: D4HAccessToken.schema }))
        .mutation(async ({ ctx, input: { tokenId, create } }) => {
            const token = {
                ...create,
                id: tokenId,
                organizationId: ctx.organizationId,
                userId: null,
                metadata: { d4HTeams: [], d4HOrganisations: [] },
            } satisfies D4HAccessToken_ServerOnly;

            // Check the token and fetch metadata
            const fetchClient = getD4HFetchClient(token);
            const { data, response } = await fetchClient.GET("/v3/whoami");

            const metadata = data
                ? await getD4HTokenMetadata(token, {
                      whoami: D4HWhoami.schema.parse(data),
                  })
                : { d4HTeams: [], d4HOrganisations: [] };

            const changes = diffObject({}, create);

            const [created] = await Promise.all([
                ctx.prisma.d4hAccessToken.create({
                    data: {
                        ...token,
                        token: encryptDBValue(token.token),
                        status: response.statusText,
                        expiresAt: addYears(new Date(), 10).toISOString(),
                        metadata,
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "D4hAccessToken",
                    objectId: tokenId,
                    changes,
                }),
            ]);

            return { created: D4HAccessToken.fromRecord(created) };
        }),

    /**
     * Create a personal D4H access token for the current user/organization. Each user can only have one personal access token per organization and it is not visible to other users.
     */
    createPersonalAccessToken: organizationProcedure({ organization: ["view"] })
        .input(
            z.object({
                tokenId: D4HAccessTokenId.schema,
                create: z.object({
                    serverCode: D4HServerCode.schema,
                    token: z.string(),
                }),
            }),
        )
        .mutation(async ({ ctx, input: { tokenId, create } }) => {
            const token = {
                ...create,
                id: tokenId,
                organizationId: ctx.organizationId,
                userId: ctx.userId,
                label: `Personal token for ${ctx.auth.user.name}`,
                metadata: { d4HTeams: [], d4HOrganisations: [] },
            } satisfies D4HAccessToken_ServerOnly;

            // Check the token and fetch metadata
            const fetchClient = getD4HFetchClient(token);
            const { data, response } = await fetchClient.GET("/v3/whoami");

            const metadata = data
                ? await getD4HTokenMetadata(token, {
                      whoami: D4HWhoami.schema.parse(data),
                  })
                : { d4HTeams: [], d4HOrganizations: [] };

            const changes = diffObject({}, create);

            const [created] = await Promise.all([
                ctx.prisma.d4hAccessToken.create({
                    data: {
                        ...token,
                        token: encryptDBValue(token.token),
                        status: response.statusText,
                        expiresAt: addYears(new Date(), 10).toISOString(),
                        metadata,
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "D4hAccessToken",
                    objectId: tokenId,
                    changes,
                }),
            ]);

            revalidatePersonalD4HAccessTokenForUser(ctx.organizationId, ctx.userId);

            return { created: D4HAccessToken.fromRecord(created) };
        }),

    /**
     * Delete a saved organization access token. This does not revoke the token in D4H, but removes it from AVUT.
     */
    deleteOrganizationAccessToken: organizationProcedure({
        d4hAccessToken: ["delete"],
    })
        .input(
            z.object({
                tokenId: D4HAccessTokenId.schema,
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

            await Promise.all([
                ctx.prisma.d4hAccessToken.delete({
                    where: { id: input.tokenId },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "D4hAccessToken",
                    objectId: existing.id,
                }),
                // Delete any organization config entries that reference this token
                ctx.prisma.organizationConfig.delete({
                    where: {
                        organizationId_key: {
                            organizationId: ctx.organizationId,
                            key: `integrations.d4h.syncToken`,
                        },
                        value: { equals: input.tokenId },
                    },
                }),
                // Revalidate organization settings in case this token was being used.
                revalidateOrganizationSettings(ctx.organizationId),
            ]);
        }),

    deletePersonalAccessToken: organizationProcedure({
        organization: ["view"],
    }).mutation(async ({ ctx }) => {
        const existing = await ctx.prisma.d4hAccessToken.findFirst({
            where: {
                organizationId: ctx.organizationId,
                userId: ctx.auth.user.id,
            },
        });

        if (!existing) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: `Personal access token for user ${ctx.auth.user.id} not found.`,
            });
        }

        await Promise.all([
            ctx.prisma.d4hAccessToken.delete({
                where: { id: existing.id },
            }),

            ctx.logEvent({
                action: "Delete",
                objectType: "D4hAccessToken",
                objectId: existing.id,
            }),
        ]);

        revalidatePersonalD4HAccessTokenForUser(ctx.organizationId, ctx.userId);
    }),

    /**
     * Get a specific D4H access token by ID. Only returns tokens that belong to the organization.
     */
    getOrganizationAccessToken: organizationProcedure({
        d4hAccessToken: ["view"],
    })
        .input(
            z.object({
                tokenId: D4HAccessTokenId.schema,
            }),
        )
        .output(D4HAccessToken.schema)
        .query(async ({ input, ctx }) => {
            const record = await ctx.prisma.d4hAccessToken.findUnique({
                where: {
                    id: input.tokenId,
                    organizationId: ctx.organizationId,
                    userId: null,
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
     * Get the D4H access token that belongs to the current user, if it exists.
     */
    getPersonalAccessToken: organizationProcedure({})
        .output(D4HAccessToken.schema.nullable())
        .query(async ({ ctx }) => {
            const record = await ctx.prisma.d4hAccessToken.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    userId: ctx.auth.user.id,
                },
            });

            let status = record?.status;
            if (record) {
                try {
                    // Try to decrypt the token to determine if we can use it
                    decryptDBValue(record.token);
                } catch (error) {
                    status = "Decrypt Error";
                }
            }

            return record
                ? D4HAccessToken.fromRecord({ ...record, status: status ?? record.status })
                : null;
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
                tokenId: D4HAccessTokenId.schema,
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

            const fetchClient = getD4HFetchClient(token);
            const { data, response } = await fetchClient.GET("/v3/whoami");

            const metadata: D4HAccessTokenMetadata = data
                ? await getD4HTokenMetadata(token, {
                      whoami: D4HWhoami.schema.parse(data),
                  })
                : { d4HTeams: [], d4HOrganisations: [] };

            await ctx.prisma.d4hAccessToken.update({
                where: { id: input.tokenId },
                data: {
                    metadata,
                    status: response.statusText,
                },
            });
        }),
});
