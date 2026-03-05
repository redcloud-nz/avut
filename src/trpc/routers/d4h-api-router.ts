/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import {
    getD4HEquipmentCategories,
    getD4HEquipmentItems,
    getD4hFetchClient,
    getD4HTeamMembers,
    getD4HTeamsAccessibleWithToken,
} from "@/lib/d4h-api/client";
import { D4HEquipmentCategory } from "@/lib/d4h-api/equipment-category";
import { D4HEquipmentItem } from "@/lib/d4h-api/equipment-item";
import { getConfiguredD4HViewsAccessToken } from "@/server/d4h-access-token";

import { createTrpcRouter, organizationProcedure } from "../init";
import { D4HMember } from "@/lib/d4h-api/member";
import { D4HTeamRef } from "@/lib/d4h-api/team";

export const d4hApiRouter = createTrpcRouter({
    listEquipmentCategories: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentCategory.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
            );

            const equipmentCategories =
                await getD4HEquipmentCategories(accessToken);

            return equipmentCategories;
        }),

    listEquipmentItems: organizationProcedure({
        d4hEquipment: ["view"],
    })
        .output(z.array(D4HEquipmentItem.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
            );

            const equipmentItems = await getD4HEquipmentItems(accessToken);

            return equipmentItems;
        }),

    listMembers: organizationProcedure({ d4hEquipment: ["view"] })
        .output(z.array(D4HMember.schema.extend({ team: D4HTeamRef.schema })))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HViewsAccessToken(
                ctx.organizationId,
            );

            const teams = await getD4HTeamsAccessibleWithToken(accessToken);

            const members = (
                await Promise.all(
                    teams.map(async (team) => {
                        const teamMembers = await getD4HTeamMembers(
                            accessToken,
                            team.id,
                        );
                        return teamMembers.map((member) => ({
                            ...member,
                            team,
                        }));
                    }),
                )
            ).flat();

            return members;
        }),

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
});
