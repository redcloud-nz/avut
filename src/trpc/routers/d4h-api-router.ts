/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";
import * as z from "zod";

import { D4HEquipmentBrand } from "@/lib/schemas/d4h/equipment-brand";
import { D4HEquipmentCategory } from "@/lib/schemas/d4h/equipment-category";
import { D4HEquipmentItem } from "@/lib/schemas/d4h/equipment-item";
import { D4HEquipmentKind } from "@/lib/schemas/d4h/equipment-kind";
import { D4HEquipmentModel } from "@/lib/schemas/d4h/equipment-model";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { D4HTeam, D4HTeamRef } from "@/lib/schemas/d4h/team";
import { D4HTeamPermissions } from "@/lib/schemas/d4h-access-token";

import {
    getConfiguredD4HAccessToken,
    getPersonalD4HAccessTokenForUser,
} from "@/server/d4h-access-token";
import { D4HListResponse, getD4HFetchClient, getD4HTokenMetadata } from "@/server/d4h-api/client";

import { createTrpcRouter, organizationProcedure } from "../init";
import { TRPCError } from "@trpc/server";

export const d4hApiRouter = createTrpcRouter({
    /**
     * List the teams that the current user has access to in the D4H system for the organization. This is used to populate the team selector in the UI.
     */
    listAccessibleTeams: organizationProcedure({})
        .output(
            z.array(
                D4HTeam.schema.extend({
                    permissions: D4HTeamPermissions.schema,
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const { d4HTeams } = await getD4HTokenMetadata(accessToken);
            return d4HTeams;
        }),

    /**
     * List the D4H teams that are accessible to the user through their personal access token.
     */
    listTeamsAccessibleToUser: organizationProcedure({ organization: ["view"] })
        .output(z.array(D4HTeamRef.schema.extend({ permissions: D4HTeamPermissions.schema })))
        .query(async ({ ctx }) => {
            const accessToken = await getPersonalD4HAccessTokenForUser(
                ctx.organizationId,
                ctx.userId,
            );
            if (!accessToken)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "No personal D4H Access Token found for user",
                });

            const { d4HTeams } = await getD4HTokenMetadata(accessToken);
            return d4HTeams;
        }),

    /**
     * Lists all equipment brands in the D4H system that are accessible to the organization.
     */
    listEquipmentBrands: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentBrand.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const fetchClient = getD4HFetchClient(accessToken);
            const { d4HTeams } = await getD4HTokenMetadata(accessToken);

            const brands = (
                await Promise.all(
                    d4HTeams.map(async (team) => {
                        const { data, error } = await fetchClient.GET(
                            "/v3/{context}/{contextId}/equipment-brands",
                            {
                                params: {
                                    path: {
                                        context: "team",
                                        contextId: team.id,
                                    },
                                },
                            },
                        );

                        if (error)
                            throw new Error(
                                `Failed to fetch equipment brands for team ${team.id}`,
                                { cause: error },
                            );

                        return (data as D4HListResponse).results.map((raw) => {
                            const brand = D4HEquipmentBrand.inputSchema.parse(raw);

                            return {
                                ...brand,
                                owner: brand.owner.resourceType == "Team" ? team : team.owner!,
                            };
                        });
                    }),
                )
            ).flat();

            return R.uniqueBy(brands, (b) => b.id).sort((a, b) => a.title.localeCompare(b.title));
        }),

    /**
     * Lists all equipment categories in the D4H system that are accessible to the organization.
     */
    listEquipmentCategories: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentCategory.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const fetchClient = getD4HFetchClient(accessToken);
            const { d4HTeams } = await getD4HTokenMetadata(accessToken);

            const categories = (
                await Promise.all(
                    d4HTeams.map(async (team) => {
                        const { data, error } = await fetchClient.GET(
                            "/v3/{context}/{contextId}/equipment-categories",
                            {
                                params: {
                                    path: {
                                        context: "team",
                                        contextId: team.id,
                                    },
                                },
                            },
                        );

                        if (error)
                            throw new Error(
                                `Failed to fetch equipment categories for team ${team.id}`,
                                { cause: error },
                            );

                        return (data as D4HListResponse).results.map((raw) => {
                            const category = D4HEquipmentCategory.inputSchema.parse(raw);

                            return {
                                ...category,
                                owner: category.owner.resourceType == "Team" ? team : team.owner!,
                            };
                        });
                    }),
                )
            ).flat();

            return R.uniqueBy(categories, (c) => c.id).sort((a, b) =>
                a.title.localeCompare(b.title),
            );
        }),

    /**
     * Lists all equipment items in the D4H system that are accessible to the organization. Depending on the number of teams and equipment items, this can be a very expensive operation. Use with caution. For more specific queries, use the other endpoints (e.g. listMemberEquipment).
     */
    listEquipmentItems: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentItem.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const fetchClient = getD4HFetchClient(accessToken);
            const { d4HTeams } = await getD4HTokenMetadata(accessToken);

            const items = (
                await Promise.all(
                    d4HTeams.map(async (team) => {
                        const { data } = await fetchClient.GET(
                            "/v3/{context}/{contextId}/equipment",
                            {
                                params: {
                                    path: {
                                        context: "team",
                                        contextId: team.id,
                                    },
                                    query: {
                                        size: 10000,
                                        only_current: true,
                                    },
                                },
                            },
                        );

                        return (data as D4HListResponse).results.map((raw) => {
                            const item = D4HEquipmentItem.schema.parse(raw);

                            return item;
                        });
                    }),
                )
            ).flat();

            return R.uniqueBy(items, (e) => e.id);
        }),

    /**
     * Lists all equipment kinds in the D4H system that are accessible to the organization.
     */
    listEquipmentKinds: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentKind.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const fetchClient = getD4HFetchClient(accessToken);
            const { d4HTeams } = accessToken.metadata;

            const kinds = (
                await Promise.all(
                    d4HTeams.map(async (team) => {
                        const { data, error } = await fetchClient.GET(
                            "/v3/{context}/{contextId}/equipment-kinds",
                            {
                                params: {
                                    path: {
                                        context: "team",
                                        contextId: team.id,
                                    },
                                },
                            },
                        );

                        if (error)
                            throw new Error(`Failed to fetch equipment kinds for team ${team.id}`, {
                                cause: error,
                            });

                        return (data as D4HListResponse).results.map((raw) => {
                            const kind = D4HEquipmentKind.inputSchema.parse(raw);

                            return {
                                ...kind,
                                owner: kind.owner.resourceType == "Team" ? team : team.owner!,
                            };
                        });
                    }),
                )
            ).flat();

            return R.uniqueBy(kinds, (k) => k.id);
        }),

    /**
     * Lists all equipment models in the D4H system that are accessible to the organization.
     */
    listEquipmentModels: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentModel.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const fetchClient = getD4HFetchClient(accessToken);
            const { d4HTeams } = await getD4HTokenMetadata(accessToken);

            const models = (
                await Promise.all(
                    d4HTeams.map(async (team) => {
                        const { data, error } = await fetchClient.GET(
                            "/v3/{context}/{contextId}/equipment-models",
                            {
                                params: {
                                    path: {
                                        context: "team",
                                        contextId: team.id,
                                    },
                                },
                            },
                        );
                        if (error)
                            throw new Error(
                                `Failed to fetch equipment models for team ${team.id}`,
                                { cause: error },
                            );

                        return (data as D4HListResponse).results.map((raw) => {
                            const model = D4HEquipmentModel.inputSchema.parse(raw);

                            return {
                                ...model,
                                owner: model.owner.resourceType == "Team" ? team : team.owner!,
                            };
                        });
                    }),
                )
            ).flat();

            return R.uniqueBy(models, (m) => m.id).sort((a, b) => a.title.localeCompare(b.title));
        }),

    /**
     * Lists all members of the teams in the D4H system that are accessible to the organization.
     */
    listMembers: organizationProcedure({ d4hEquipment: ["view"] })
        .output(z.array(D4HMember.schema.extend({ team: D4HTeamRef.schema })))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const fetchClient = getD4HFetchClient(accessToken);
            const { d4HTeams } = await getD4HTokenMetadata(accessToken);

            const members = (
                await Promise.all(
                    d4HTeams.map(async (team) => {
                        const { data, error } = await fetchClient.GET(
                            "/v3/{context}/{contextId}/members",
                            {
                                params: {
                                    path: {
                                        context: "team",
                                        contextId: team.id,
                                    },
                                    query: {
                                        status: ["OPERATIONAL", "NON_OPERATIONAL"],
                                    },
                                },
                            },
                        );
                        if (error)
                            throw new Error(`Failed to fetch members for team ${team.id}`, {
                                cause: error,
                            });

                        return (data as D4HListResponse).results.map((raw) => {
                            const member = D4HMember.schema.parse(raw);
                            return { ...member, team };
                        });
                    }),
                )
            ).flat();

            return members;
        }),

    /**
     * Lists all equipment items in the D4H system that are accessible to the organization.
     */
    listMemberEquipment: organizationProcedure({ d4hEquipment: ["view"] })
        .input(
            z.object({
                teamId: z.number(),
                memberId: z.number(),
            }),
        )
        .output(z.array(D4HEquipmentItem.schema))
        .query(async ({ ctx, input: { teamId, memberId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const fetchClient = getD4HFetchClient(accessToken);

            const { data, error } = await fetchClient.GET("/v3/{context}/{contextId}/equipment", {
                params: {
                    path: {
                        context: "team",
                        contextId: teamId,
                    },
                    query: {
                        only_current: true,
                        member_id: memberId,
                    },
                },
            });

            if (error)
                throw new Error(
                    `Failed to fetch equipment for member ${memberId} in team ${teamId}`,
                    { cause: error },
                );

            return (data as D4HListResponse).results.map((raw) => {
                const item = D4HEquipmentItem.schema.parse(raw);
                return item;
            });
        }),

    /**
     * Lists all teams in the D4H system that are accessible to the organization.
     */
    listTeams: organizationProcedure({ d4hEquipment: ["view"] })
        .output(z.array(D4HTeamRef.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const { d4HTeams } = await getD4HTokenMetadata(accessToken);
            return d4HTeams;
        }),
});
