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
import { D4HActivity, formatD4HActivityLocation } from "@/lib/schemas/d4h/activity";
import { D4HTeam, D4HTeamRef } from "@/lib/schemas/d4h/team";
import { D4HTeamPermissions } from "@/lib/schemas/d4h-access-token";
import {
    buildD4HToday,
    d4hTodayTeamGroupSchema,
    D4HTodayActivityInput,
    zonedTodayRange,
} from "@/lib/d4h-today";

import {
    getConfiguredD4HAccessToken,
    getPersonalD4HAccessTokenForUser,
} from "@/server/d4h-access-token";
import {
    D4HListResponse,
    fetchD4HMemberAttendance,
    fetchD4HTeamDetailCached,
    fetchD4HWhoamiCached,
    getD4HFetchClient,
    getD4HTokenMetadata,
} from "@/server/d4h-api/client";

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

    /**
     * The current user's events, exercises and incidents scheduled for today, across every
     * D4H team their personal access token can see, with their attendance status for each.
     *
     * "Today" is the civil day in each team's own timezone. Events and exercises overlapping
     * today are always listed (as `not-involved` when the user has no attendance record);
     * incidents appear only when the user has an attendance record for them.
     */
    myActivitiesToday: organizationProcedure({})
        .output(z.array(d4hTodayTeamGroupSchema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            const fetchClient = getD4HFetchClient(accessToken);
            const whoami = await fetchD4HWhoamiCached(accessToken);
            const now = new Date();

            const parseList = (data: unknown) =>
                (data as D4HListResponse).results.map((raw) => D4HActivity.schema.parse(raw));

            const toInput = (
                a: D4HActivity,
                resourceType: D4HTodayActivityInput["resourceType"],
            ): D4HTodayActivityInput => ({
                id: a.id,
                resourceType,
                reference: a.reference,
                referenceDescription: a.referenceDescription,
                startsAt: a.startsAt,
                endsAt: a.endsAt,
                location: formatD4HActivityLocation(a.address),
            });

            const teams = await Promise.all(
                whoami.members
                    .filter((member) => member.hasAccess)
                    .map(async (member) => {
                        const teamId = member.owner.id;
                        const { timezone } = await fetchD4HTeamDetailCached(accessToken, teamId);
                        const { start, end } = zonedTodayRange(now, timezone);
                        const path = { context: "team", contextId: teamId } as const;
                        // Overlaps today: starts before end-of-day and ends after start-of-day.
                        // No `published` filter — some teams never publish activities, but
                        // members still have attendance records to act on, and unrostered
                        // drafts simply show as "not involved".
                        const overlapQuery = {
                            after: start.toISOString(),
                            before: end.toISOString(),
                            size: 250,
                        };

                        const [eventsRes, exercisesRes, attendances] = await Promise.all([
                            fetchClient.GET("/v3/{context}/{contextId}/events", {
                                params: { path, query: overlapQuery },
                            }),
                            fetchClient.GET("/v3/{context}/{contextId}/exercises", {
                                params: { path, query: overlapQuery },
                            }),
                            fetchD4HMemberAttendance(accessToken, teamId, {
                                memberId: member.id,
                                startsBefore: end.toISOString(),
                                endsAfter: start.toISOString(),
                            }),
                        ]);

                        if (!eventsRes.response.ok || !eventsRes.data)
                            throw new Error(
                                `Failed to fetch events for team ${teamId} (${eventsRes.response.status})`,
                            );
                        if (!exercisesRes.response.ok || !exercisesRes.data)
                            throw new Error(
                                `Failed to fetch exercises for team ${teamId} (${exercisesRes.response.status})`,
                            );

                        const listed = [
                            ...parseList(eventsRes.data).map((a) => toInput(a, "Event")),
                            ...parseList(exercisesRes.data).map((a) => toInput(a, "Exercise")),
                        ];
                        const key = (t: string, id: number) => `${t}:${id}`;
                        const listedKeys = new Set(listed.map((a) => key(a.resourceType, a.id)));

                        // Activities the member has an attendance record for but that the list
                        // queries didn't return (incidents, unpublished drafts, window edges) —
                        // fetch each by id so it still appears with the right status.
                        const missing = R.uniqueBy(
                            attendances
                                .map((a) => a.activity)
                                .filter((act) => !listedKeys.has(key(act.resourceType, act.id))),
                            (act) => key(act.resourceType, act.id),
                        );
                        const fetched = (
                            await Promise.all(
                                missing.map(async (act) => {
                                    const activityPath = { ...path, activityId: act.id };
                                    const { data, error } =
                                        act.resourceType === "Event"
                                            ? await fetchClient.GET(
                                                  "/v3/{context}/{contextId}/events/{activityId}",
                                                  { params: { path: activityPath } },
                                              )
                                            : act.resourceType === "Exercise"
                                              ? await fetchClient.GET(
                                                    "/v3/{context}/{contextId}/exercises/{activityId}",
                                                    { params: { path: activityPath } },
                                                )
                                              : await fetchClient.GET(
                                                    "/v3/{context}/{contextId}/incidents/{activityId}",
                                                    { params: { path: activityPath } },
                                                );
                                    // The attendance record can outlive the activity (deleted,
                                    // archived, or no longer visible to this token) — skip it
                                    // rather than failing the whole view.
                                    if (error || !data) return null;
                                    return toInput(
                                        D4HActivity.schema.parse(data),
                                        act.resourceType,
                                    );
                                }),
                            )
                        ).filter((a): a is D4HTodayActivityInput => a !== null);

                        return {
                            team: { id: teamId, title: member.owner.title },
                            timezone,
                            activities: [...listed, ...fetched],
                            attendances: attendances.map((a) => ({
                                activity: a.activity,
                                status: a.status,
                            })),
                        };
                    }),
            );

            return buildD4HToday(teams);
        }),
});
