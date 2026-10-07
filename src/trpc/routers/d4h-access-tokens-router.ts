/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { addYears } from "date-fns";
import * as R from "remeda";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { D4HServerCode } from "@/lib/d4h-servers";
import { DiffChange, diffObject } from "@/lib/diff";
import { D4HAccessToken, D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { D4HAccessTokenMetadata } from "@/lib/schemas/d4h-provider-metadata";
import { OrganizationData } from "@/lib/schemas/organization";
import {
    ProviderCredentialId,
    type ProviderCredentialRecord,
} from "@/lib/schemas/provider-credential";
import { revalidateOrganizationSettings } from "@/server/cache/organization-settings";
import {
    revalidateD4HAccessToken,
    revalidateD4HApiCache,
    revalidatePersonalD4HAccessTokenForUser,
    toServerOnlyD4HAccessToken,
} from "@/server/d4h-access-token";
import { validateD4HCredential, type D4HCredentialValidation } from "@/server/d4h-api/client";
import { decryptDBValue, encryptDBValue } from "@/server/encrypt";

import {
    authenticatedProcedure,
    createTrpcRouter,
    organizationProcedure,
    type AuthenticatedOrganizationContext,
} from "../init";
import { Messages } from "../messages";

/**
 * The status text to store for a validation result. `statusText` is often empty (HTTP/2 has no
 * reason phrase), so fall back to the status code.
 */
function credentialStatus(validation: D4HCredentialValidation): string {
    return validation.statusText || `HTTP ${validation.status}`;
}

/**
 * The error for a create whose validation failed. Only 401/403 mean the token itself is bad; any
 * other status is D4H (or the network) failing, which says nothing about the token.
 */
function credentialRejectedError(validation: D4HCredentialValidation): TRPCError {
    if (validation.status === 401 || validation.status === 403) {
        return new TRPCError({
            code: "BAD_REQUEST",
            message: Messages.d4HAccessTokenRejected(validation.status),
        });
    }
    return new TRPCError({
        code: "BAD_GATEWAY",
        message: Messages.d4HUnavailable(validation.status),
    });
}

/**
 * Re-validate a stored D4H credential against D4H, then save its new status (and, if D4H accepted
 * it, its new metadata) and log the change. Shared by `refreshToken` (org tokens) and
 * `refreshPersonalAccessToken`. Cache revalidation is left to the caller, since which caches apply
 * depends on the kind of token.
 *
 * A failure other than 401/403 says nothing about the token (D4H or the network is failing), so it
 * throws without writing anything rather than marking a good token as broken.
 */
async function refreshD4HCredential(
    ctx: AuthenticatedOrganizationContext,
    record: ProviderCredentialRecord,
) {
    const token = toServerOnlyD4HAccessToken(record);

    const validation = await validateD4HCredential(token);
    if (!validation.ok && validation.status !== 401 && validation.status !== 403) {
        throw credentialRejectedError(validation);
    }
    const status = credentialStatus(validation);

    // On a failed whoami, record the new status but keep the last known metadata, rather than
    // overwriting it with empty lists.
    const metadata = validation.metadata
        ? { provider: "D4H", serverCode: token.serverCode, ...validation.metadata }
        : undefined;

    await ctx.prisma.$transaction([
        ctx.prisma.providerCredential.update({
            where: { id: record.id },
            data: { metadata, status },
        }),
        ctx.logEvent({
            action: "Update",
            objectType: "D4HAccessToken",
            objectId: record.id,
            changes: diffObject({ status: record.status }, { status }),
            description: validation.ok
                ? "Refreshed D4H access token metadata."
                : "D4H rejected the access token; kept its last known metadata.",
        }),
    ]);
}

/**
 * TRPC router for managing D4H access tokens. These tokens are used to sync data from D4H into AVUT.
 * Stored in the shared `ProviderCredential` table (#286), filtered/tagged with `provider: "D4H"`.
 */
export const d4hAccessTokensRouter = createTrpcRouter({
    /**
     * Create a new D4H access token for the organization.
     */
    createOrganizationAccessToken: organizationProcedure({
        organization: ["update"],
    })
        .input(
            z.object({
                tokenId: ProviderCredentialId.schema,
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

            // Check the token and fetch metadata. A token D4H rejects is never saved.
            const validation = await validateD4HCredential(token);
            if (!validation.ok) throw credentialRejectedError(validation);

            const metadata: D4HAccessTokenMetadata = validation.metadata ?? {
                d4HTeams: [],
                d4HOrganisations: [],
            };

            const changes: DiffChange[] = [
                ...diffObject({}, R.omit(create, ["token"])),
                { type: "obj_mask", path: ["token"] },
            ];

            const [created] = await ctx.prisma.$transaction([
                ctx.prisma.providerCredential.create({
                    data: {
                        provider: "D4H",
                        id: tokenId,
                        organizationId: ctx.organizationId,
                        userId: null,
                        label: create.label,
                        token: encryptDBValue(create.token),
                        status: credentialStatus(validation),
                        expiresAt: addYears(new Date(), 10),
                        metadata: { provider: "D4H", serverCode: create.serverCode, ...metadata },
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "D4HAccessToken",
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
                tokenId: ProviderCredentialId.schema,
                create: z.object({
                    serverCode: D4HServerCode.schema,
                    token: z.string(),
                }),
            }),
        )
        .output(z.object({ created: D4HAccessToken.schema }))
        .mutation(async ({ ctx, input: { tokenId, create } }) => {
            // One personal token per user per org, so lookups by (org, user) are unambiguous.
            // No unique index backs this: a race or a direct DB write can still add a duplicate.
            const existing = await ctx.prisma.providerCredential.findFirst({
                where: { provider: "D4H", organizationId: ctx.organizationId, userId: ctx.userId },
            });
            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: Messages.personalD4HAccessTokenExists(),
                });
            }

            const label = `Personal token for ${ctx.auth.user.name}`;

            const token = {
                ...create,
                id: tokenId,
                organizationId: ctx.organizationId,
                userId: ctx.userId,
                label,
                metadata: { d4HTeams: [], d4HOrganisations: [] },
            } satisfies D4HAccessToken_ServerOnly;

            // Check the token and fetch metadata. A token D4H rejects is never saved.
            const validation = await validateD4HCredential(token);
            if (!validation.ok) throw credentialRejectedError(validation);

            const metadata: D4HAccessTokenMetadata = validation.metadata ?? {
                d4HTeams: [],
                d4HOrganisations: [],
            };

            const changes: DiffChange[] = [
                ...diffObject({}, R.omit(create, ["token"])),
                { type: "obj_mask", path: ["token"] },
            ];

            const [created] = await ctx.prisma.$transaction([
                ctx.prisma.providerCredential.create({
                    data: {
                        provider: "D4H",
                        id: tokenId,
                        organizationId: ctx.organizationId,
                        userId: ctx.userId,
                        label,
                        token: encryptDBValue(create.token),
                        status: credentialStatus(validation),
                        expiresAt: addYears(new Date(), 10),
                        metadata: { provider: "D4H", serverCode: create.serverCode, ...metadata },
                    },
                }),
                ctx.logEvent({
                    action: "Create",
                    objectType: "D4HAccessToken",
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
        organization: ["update"],
    })
        .input(
            z.object({
                tokenId: ProviderCredentialId.schema,
            }),
        )
        .mutation(async ({ input, ctx }) => {
            // `userId: null`: only organization tokens. A member's personal token is theirs to delete.
            const existing = await ctx.prisma.providerCredential.findUnique({
                where: {
                    id: input.tokenId,
                    provider: "D4H",
                    organizationId: ctx.organizationId,
                    userId: null,
                },
            });

            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.d4HAccessTokenNotFound(input.tokenId),
                });
            }

            await ctx.prisma.$transaction([
                ctx.prisma.providerCredential.delete({
                    where: { id: input.tokenId },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "D4HAccessToken",
                    objectId: existing.id,
                }),
                // Delete any organization config entries that reference this token. `deleteMany`,
                // not `delete`: most tokens aren't the sync token, and `delete` throws when nothing
                // matches, which would roll back the whole transaction.
                ctx.prisma.organizationConfig.deleteMany({
                    where: {
                        organizationId: ctx.organizationId,
                        key: `integrations.d4h.syncToken`,
                        value: { equals: input.tokenId },
                    },
                }),
            ]);

            // Neither is a Prisma operation, so they can't join the $transaction above.
            // Drop the cached credential so the deleted token stops working immediately.
            revalidateD4HAccessToken(input.tokenId);
            revalidateD4HApiCache(input.tokenId);
            // Revalidate organization settings in case this token was being used.
            await revalidateOrganizationSettings(ctx.organizationId);
        }),

    deletePersonalAccessToken: organizationProcedure({
        organization: ["view"],
    }).mutation(async ({ ctx }) => {
        const existing = await ctx.prisma.providerCredential.findFirst({
            where: {
                provider: "D4H",
                organizationId: ctx.organizationId,
                userId: ctx.auth.user.id,
            },
        });

        if (!existing) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: Messages.personalD4HAccessTokenNotFound(),
            });
        }

        await ctx.prisma.$transaction([
            ctx.prisma.providerCredential.delete({
                where: { id: existing.id },
            }),

            ctx.logEvent({
                action: "Delete",
                objectType: "D4HAccessToken",
                objectId: existing.id,
            }),
        ]);

        revalidatePersonalD4HAccessTokenForUser(ctx.organizationId, ctx.userId);
        // Personal refs resolve through the ID-tagged credential cache too, so clear that as well.
        const tokenId = ProviderCredentialId.schema.parse(existing.id);
        revalidateD4HAccessToken(tokenId);
        revalidateD4HApiCache(tokenId);
    }),

    /**
     * Get a specific D4H access token by ID. Only returns tokens that belong to the organization.
     */
    getOrganizationAccessToken: organizationProcedure({
        organization: ["update"],
    })
        .input(
            z.object({
                tokenId: ProviderCredentialId.schema,
            }),
        )
        .output(D4HAccessToken.schema)
        .query(async ({ input, ctx }) => {
            const record = await ctx.prisma.providerCredential.findUnique({
                where: {
                    id: input.tokenId,
                    provider: "D4H",
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
            const record = await ctx.prisma.providerCredential.findFirst({
                where: {
                    provider: "D4H",
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
                    console.log("Error decrypting personal D4H access token:", error);
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
        organization: ["update"],
    })
        .output(z.array(D4HAccessToken.schema))
        .query(async ({ ctx }) => {
            const records = await ctx.prisma.providerCredential.findMany({
                where: { provider: "D4H", organizationId: ctx.organizationId, userId: null },
            });

            return records.map(D4HAccessToken.fromRecord);
        }),

    /**
     * List all personal D4H access tokens belonging to the current user, across every organization they are a member of.
     */
    listPersonalAccessTokens: authenticatedProcedure
        .output(
            z.array(
                D4HAccessToken.schema.extend({
                    organization: OrganizationData.schema.pick({
                        id: true,
                        name: true,
                        slug: true,
                    }),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const records = await ctx.prisma.providerCredential.findMany({
                where: { provider: "D4H", userId: ctx.auth.user.id },
                include: { organization: true },
            });

            return records.map((record) => ({
                ...D4HAccessToken.fromRecord(record),
                organization: OrganizationData.fromRecord(record.organization!),
            }));
        }),

    /**
     * Re-check the current user's personal D4H access token against D4H and update its status and metadata.
     */
    refreshPersonalAccessToken: organizationProcedure({
        organization: ["view"],
    })
        .input(
            z.object({
                tokenId: ProviderCredentialId.schema,
            }),
        )
        .mutation(async ({ input, ctx }) => {
            // Scoped to the caller and org: another user's token, or one in another org, is NOT_FOUND.
            const record = await ctx.prisma.providerCredential.findFirst({
                where: {
                    id: input.tokenId,
                    provider: "D4H",
                    organizationId: ctx.organizationId,
                    userId: ctx.userId,
                },
            });

            if (!record) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.personalD4HAccessTokenNotFound(),
                });
            }

            await refreshD4HCredential(ctx, record);

            revalidatePersonalD4HAccessTokenForUser(ctx.organizationId, ctx.userId);
            revalidateD4HAccessToken(input.tokenId);
            revalidateD4HApiCache(input.tokenId);
        }),

    refreshToken: organizationProcedure({
        organization: ["update"],
    })
        .input(
            z.object({
                tokenId: ProviderCredentialId.schema,
            }),
        )
        .mutation(async ({ input, ctx }) => {
            const record = await ctx.prisma.providerCredential.findUnique({
                where: {
                    id: input.tokenId,
                    provider: "D4H",
                    organizationId: ctx.organizationId,
                    userId: null,
                },
            });

            if (!record)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.d4HAccessTokenNotFound(input.tokenId),
                });

            await refreshD4HCredential(ctx, record);

            revalidateD4HAccessToken(input.tokenId);
            revalidateD4HApiCache(input.tokenId);
        }),
});
