/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";
import * as z from "zod";

import {
    D4HListResponse,
    getD4HEquipmentItems,
    getD4hFetchClient,
    getD4HOrganizationsAccessibleWithToken,
    getD4HTeamsAccessibleWithToken,
} from "@/lib/d4h-api/client";
import { D4HEquipmentBrand } from "@/lib/d4h-api/equipment-brand";
import { D4HEquipmentCategory } from "@/lib/d4h-api/equipment-category";
import { D4HEquipmentItem } from "@/lib/d4h-api/equipment-item";
import { D4HEquipmentKind } from "@/lib/d4h-api/equipment-kind";
import { D4HEquipmentModel } from "@/lib/d4h-api/equipment-models";
import { D4HMember } from "@/lib/d4h-api/member";
import { D4HTeamRef } from "@/lib/d4h-api/team";
import { getConfiguredD4HViewsAccessToken } from "@/server/d4h-access-token";

import { createTrpcRouter, organizationProcedure } from "../init";

export const d4hApiRouter = createTrpcRouter({
    /**
     * Lists all equipment brands in the D4H system that are accessible to the organization.
     */
    listEquipmentBrands: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentBrand.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
                ctx.userId,
            );

            const fetchClient = getD4hFetchClient(accessToken);

            const teams = await getD4HTeamsAccessibleWithToken(accessToken);
            const organisations =
                await getD4HOrganizationsAccessibleWithToken(accessToken);

            const brands = (
                await Promise.all(
                    teams.map(async (team) => {
                        const { data } = await fetchClient.GET(
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

                        return (data as D4HListResponse).results.map((raw) => {
                            const parsed =
                                D4HEquipmentBrand.inputSchema.parse(raw);

                            return {
                                ...parsed,
                                owner: {
                                    ...parsed.owner,
                                    title:
                                        parsed.owner.resourceType == "Team"
                                            ? team.title
                                            : (organisations.find(
                                                  (o) =>
                                                      o.id === parsed.owner.id,
                                              )?.title ??
                                              `Organization ${parsed.owner.id}`),
                                },
                            };
                        });
                    }),
                )
            ).flat();

            return R.uniqueBy(brands, (b) => b.id);
        }),

    /**
     * Lists all equipment categories in the D4H system that are accessible to the organization.
     */
    listEquipmentCategories: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentCategory.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
                ctx.userId,
            );

            const fetchClient = getD4hFetchClient(accessToken);

            const teams = await getD4HTeamsAccessibleWithToken(accessToken);
            const organisations =
                await getD4HOrganizationsAccessibleWithToken(accessToken);

            const categories = (
                await Promise.all(
                    teams.map(async (team) => {
                        const { data } = await fetchClient.GET(
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

                        return (data as D4HListResponse).results.map((raw) => {
                            const parsed =
                                D4HEquipmentCategory.inputSchema.parse(raw);

                            return {
                                ...parsed,
                                owner: {
                                    ...parsed.owner,
                                    title:
                                        parsed.owner.resourceType == "Team"
                                            ? team.title
                                            : (organisations.find(
                                                  (o) =>
                                                      o.id === parsed.owner.id,
                                              )?.title ??
                                              `Organization ${parsed.owner.id}`),
                                },
                            };
                        });
                    }),
                )
            ).flat();

            return R.uniqueBy(categories, (c) => c.id);
        }),

    /**
     * Lists all equipment items in the D4H system that are accessible to the organization. Depending on the number of teams and equipment items, this can be a very expensive operation. Use with caution. For more specific queries, use the other endpoints (e.g. listMemberEquipment).
     */
    listEquipmentItems: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentItem.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
                ctx.userId,
            );

            const equipmentItems = await getD4HEquipmentItems(accessToken);

            return equipmentItems;
        }),

    /**
     * Lists all equipment kinds in the D4H system that are accessible to the organization.
     */
    listEquipmentKinds: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentKind.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
                ctx.userId,
            );

            const fetchClient = getD4hFetchClient(accessToken);

            const teams = await getD4HTeamsAccessibleWithToken(accessToken);
            const organisations =
                await getD4HOrganizationsAccessibleWithToken(accessToken);

            const kinds = (
                await Promise.all(
                    teams.map(async (team) => {
                        const { data } = await fetchClient.GET(
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

                        return (data as D4HListResponse).results.map((raw) => {
                            const parsed =
                                D4HEquipmentKind.inputSchema.parse(raw);

                            return {
                                ...parsed,
                                owner: {
                                    ...parsed.owner,
                                    title:
                                        parsed.owner.resourceType == "Team"
                                            ? team.title
                                            : (organisations.find(
                                                  (o) =>
                                                      o.id === parsed.owner.id,
                                              )?.title ??
                                              `Organization ${parsed.owner.id}`),
                                },
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
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
                ctx.userId,
            );

            const fetchClient = getD4hFetchClient(accessToken);

            const teams = await getD4HTeamsAccessibleWithToken(accessToken);

            const models = (
                await Promise.all(
                    teams.map(async (team) => {
                        const { data } = await fetchClient.GET(
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

                        return z
                            .object({
                                results: z.array(D4HEquipmentModel.schema),
                            })
                            .parse(data).results;
                    }),
                )
            ).flat();

            return R.uniqueBy(models, (m) => m.id);
        }),

    /**
     * Lists all members of the teams in the D4H system that are accessible to the organization.
     */
    listMembers: organizationProcedure({ d4hEquipment: ["view"] })
        .output(z.array(D4HMember.schema.extend({ team: D4HTeamRef.schema })))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
                ctx.userId,
            );

            const fetchClient = getD4hFetchClient(accessToken);

            const teams = await getD4HTeamsAccessibleWithToken(accessToken);

            const members = (
                await Promise.all(
                    teams.map(async (team) => {
                        const { data } = await fetchClient.GET(
                            "/v3/{context}/{contextId}/members",
                            {
                                params: {
                                    path: {
                                        context: "team",
                                        contextId: team.id,
                                    },
                                    query: {
                                        status: [
                                            "OPERATIONAL",
                                            "NON_OPERATIONAL",
                                        ],
                                    },
                                },
                            },
                        );
                        return z
                            .object({ results: D4HMember.schema.array() })
                            .parse(data)
                            .results.map((member) => ({ ...member, team }));
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
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
                ctx.userId,
            );

            const fetchClient = getD4hFetchClient(accessToken);

            const { data } = await fetchClient.GET(
                "/v3/{context}/{contextId}/equipment",
                {
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
                },
            );

            return z
                .object({ results: z.array(D4HEquipmentItem.schema) })
                .parse(data).results;
        }),

    /**
     * Lists all teams in the D4H system that are accessible to the organization.
     */
    listTeams: organizationProcedure({ d4hEquipment: ["view"] })
        .output(z.array(D4HTeamRef.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
                ctx.userId,
            );

            const teams = await getD4HTeamsAccessibleWithToken(accessToken);
            return teams;
        }),
});
