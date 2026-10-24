/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";
import * as z from "zod";

import { d4hEquipmentItemViewUrl } from "@/lib/d4h-servers";
import {
    buildD4HToday,
    D4HTodayActivityInput,
    d4hTodayTeamGroupSchema,
    zonedTodayRange,
} from "@/lib/d4h-today";
import { diffObject } from "@/lib/diff";
import { NotFoundError } from "@/lib/errors";
import { D4HTeamPermissions } from "@/lib/schemas/d4h-provider-metadata";
import { D4HActivity, formatD4HActivityLocation } from "@/lib/schemas/d4h/activity";
import { D4HEquipmentBrand } from "@/lib/schemas/d4h/equipment-brand";
import { D4HEquipmentCategory } from "@/lib/schemas/d4h/equipment-category";
import {
    D4HEquipmentItem,
    D4HEquipmentItemDetail,
    D4HEquipmentItemUpdate,
    D4HEquipmentListItem,
} from "@/lib/schemas/d4h/equipment-item";
import { D4HEquipmentKind } from "@/lib/schemas/d4h/equipment-kind";
import { D4HEquipmentModel } from "@/lib/schemas/d4h/equipment-model";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { D4HTeam, D4HTeamRef } from "@/lib/schemas/d4h/team";
import { getConfiguredD4HAccessToken, toD4HCredentialRef } from "@/server/d4h-access-token";
import {
    D4HListResponse,
    fetchD4HMemberAttendance,
    fetchD4HTeamDetailCached,
    fetchD4HWhoamiCached,
    getD4HFetchClient,
    getD4HTeamMembers,
    getD4HTokenMetadata,
} from "@/server/d4h-api/client";
import {
    fetchD4HEquipmentItem,
    fetchD4HEquipmentItemContents,
    fetchD4HEquipmentItemsByKind,
    fetchD4HTeamEquipmentItems,
    patchD4HEquipmentItem,
} from "@/server/d4h-api/equipment";
import { requireD4HTeamPermission } from "@/server/d4h-permissions";

import { createTrpcRouter, organizationProcedure } from "../init";

/** The item fields D4H's equipment PATCH can change, compared for the audit log. */
const PATCHABLE_ITEM_FIELDS = ["status", "isCritical", "isMonitor", "barcode", "notes"] as const;

export const d4hApiRouter = createTrpcRouter({
    /**
     * One equipment item, fetched live from D4H, with the URL of its view page in D4H's web app
     * and, when it's issued to a person, who holds it. An item owned by a team other than
     * `teamId` is treated as not found.
     *
     * The holder's name comes from the team's (cached) member list, never from the item's
     * `location`, which keeps only the holder's type and id. It's `null` when the holder isn't in
     * that list (e.g. a retired member), or when the list can't be fetched: the page shouldn't
     * fail over a display name.
     */
    getEquipmentItem: organizationProcedure({ d4hEquipment: ["view"] })
        .input(z.object({ teamId: z.number(), itemId: z.number() }))
        .output(
            z.object({
                item: D4HEquipmentItemDetail.schema,
                d4hUrl: z.string(),
                holder: z.object({ id: z.number(), name: z.string().nullable() }).nullable(),
            }),
        )
        .query(async ({ ctx, input: { teamId, itemId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            const credentialRef = toD4HCredentialRef(accessToken);

            const item = await fetchD4HEquipmentItem(accessToken, teamId, itemId);
            if (!item || item.owner.id !== teamId) {
                throw new NotFoundError(`Equipment item ${itemId} not found in team ${teamId}.`);
            }

            const holderId =
                item.location?.resourceType === "Member" ? (item.location.id ?? null) : null;
            const [{ subdomain }, members] = await Promise.all([
                fetchD4HTeamDetailCached(credentialRef, teamId),
                holderId == null ? [] : getD4HTeamMembers(credentialRef, teamId).catch(() => []),
            ]);

            return {
                item,
                d4hUrl: d4hEquipmentItemViewUrl(accessToken.serverCode, subdomain, itemId),
                holder:
                    holderId == null
                        ? null
                        : {
                              id: holderId,
                              name: members.find((member) => member.id === holderId)?.name ?? null,
                          },
            };
        }),

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

            const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));
            return d4HTeams;
        }),

    /**
     * List the D4H teams that are accessible to the user through their personal access token.
     */
    listTeamsAccessibleToUser: organizationProcedure({ organization: ["view"] })
        .output(
            z.array(
                D4HTeamRef.schema.extend({
                    permissions: D4HTeamPermissions.schema,
                    owner: z
                        .object({ id: z.number(), title: z.string() })
                        .nullish()
                        .transform((v) => v ?? null),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));
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
            const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));

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
            const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));

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
     * The current items stored directly in one equipment item, in one D4H team. A team the token
     * can't reach is not found.
     */
    listEquipmentItemContents: organizationProcedure({ d4hEquipment: ["view"] })
        .input(z.object({ teamId: z.number(), itemId: z.number() }))
        .output(z.array(D4HEquipmentListItem.schema))
        .query(async ({ ctx, input: { teamId, itemId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));
            if (!d4HTeams.some((team) => team.id === teamId)) {
                throw new NotFoundError(`D4H team ${teamId} not found.`);
            }

            return fetchD4HEquipmentItemContents(accessToken, teamId, itemId);
        }),

    /**
     * The current items of one equipment kind, in every D4H team the token reaches, each with
     * the team that owns it and, when it's issued to a person, who holds it.
     *
     * An item listed under more than one team is kept once and attributed to its `owner` team,
     * or to the team that listed it when the token can't reach the owner.
     *
     * Holder names come from the owning team's (cached) member list, never from the item's
     * `location`, which keeps only the holder's type and id. A team's members are fetched only
     * when one of its items is held by a member, and a name is `null` when the holder isn't in
     * that list (e.g. a retired member) or the list can't be fetched.
     */
    listEquipmentKindItems: organizationProcedure({ d4hEquipment: ["view"] })
        .input(z.object({ kindId: z.number() }))
        .output(
            z.array(
                D4HEquipmentListItem.schema.extend({
                    team: z.object({ id: z.number(), title: z.string() }),
                    holder: z.object({ id: z.number(), name: z.string().nullable() }).nullable(),
                }),
            ),
        )
        .query(async ({ ctx, input: { kindId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            const credentialRef = toD4HCredentialRef(accessToken);
            const { d4HTeams } = await getD4HTokenMetadata(credentialRef);

            const listed = (
                await Promise.all(
                    d4HTeams.map(async (listingTeam) => {
                        const teamItems = await fetchD4HEquipmentItemsByKind(
                            accessToken,
                            listingTeam.id,
                            kindId,
                        );
                        return teamItems.map((item) => ({
                            item,
                            team: d4HTeams.find((team) => team.id === item.owner.id) ?? listingTeam,
                        }));
                    }),
                )
            ).flat();

            // Keep each item once, preferring a row attributed to the item's owner.
            const rows = R.uniqueBy(
                R.sortBy(listed, ({ item, team }) => (team.id === item.owner.id ? 0 : 1)),
                ({ item }) => item.id,
            );

            const holderTeamIds = R.unique(
                rows
                    .filter(({ item }) => item.location?.resourceType === "Member")
                    .map(({ team }) => team.id),
            );
            const nameByIdByTeam = new Map(
                await Promise.all(
                    holderTeamIds.map(async (teamId) => {
                        const members = await getD4HTeamMembers(credentialRef, teamId).catch(
                            () => [],
                        );
                        return [
                            teamId,
                            new Map(members.map((member) => [member.id, member.name])),
                        ] as const;
                    }),
                ),
            );

            return rows.map(({ item, team }) => {
                const holderId =
                    item.location?.resourceType === "Member" ? (item.location.id ?? null) : null;
                return {
                    ...item,
                    team: { id: team.id, title: team.title },
                    holder:
                        holderId == null
                            ? null
                            : {
                                  id: holderId,
                                  name: nameByIdByTeam.get(team.id)?.get(holderId) ?? null,
                              },
                };
            });
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
            const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));

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
            const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));

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
                                owner:
                                    model.owner.resourceType == "Team"
                                        ? (d4HTeams.find((t) => t.id === model.owner.id) ?? team)
                                        : team.owner!,
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
            const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));

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
     * One D4H team's current items that are issued to a person, each with who holds it, from a
     * single equipment-list request. A team the token can't reach is not found.
     *
     * Only items the team owns are kept, since the item page they link to treats any other as not
     * found. Holder names come from the team's (cached) member list, never from the item's
     * `location`, which keeps only the holder's type and id. A name is `null` when the holder
     * isn't in that list (e.g. a retired member) or the list can't be fetched.
     */
    listTeamIssuedEquipment: organizationProcedure({ d4hEquipment: ["view"] })
        .input(z.object({ teamId: z.number() }))
        .output(
            z.array(
                D4HEquipmentListItem.schema.extend({
                    holder: z.object({ id: z.number(), name: z.string().nullable() }),
                }),
            ),
        )
        .query(async ({ ctx, input: { teamId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            const credentialRef = toD4HCredentialRef(accessToken);

            const { d4HTeams } = await getD4HTokenMetadata(credentialRef);
            if (!d4HTeams.some((team) => team.id === teamId)) {
                throw new NotFoundError(`D4H team ${teamId} not found.`);
            }

            const items = await fetchD4HTeamEquipmentItems(accessToken, teamId);
            const issued = items.flatMap((item) =>
                item.owner.id === teamId &&
                item.location?.resourceType === "Member" &&
                item.location.id != null
                    ? [{ item, holderId: item.location.id }]
                    : [],
            );
            if (issued.length === 0) return [];

            const members = await getD4HTeamMembers(credentialRef, teamId).catch(() => []);
            const nameById = new Map(members.map((member) => [member.id, member.name]));

            return issued.map(({ item, holderId }) => ({
                ...item,
                holder: { id: holderId, name: nameById.get(holderId) ?? null },
            }));
        }),

    /**
     * One D4H team's Operational and Non-operational members, from the cached member list. A team
     * the token can't reach is not found.
     */
    listTeamMembers: organizationProcedure({ d4hEquipment: ["view"] })
        .input(z.object({ teamId: z.number() }))
        .output(z.array(D4HMember.schema))
        .query(async ({ ctx, input: { teamId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            const credentialRef = toD4HCredentialRef(accessToken);

            const { d4HTeams } = await getD4HTokenMetadata(credentialRef);
            if (!d4HTeams.some((team) => team.id === teamId)) {
                throw new NotFoundError(`D4H team ${teamId} not found.`);
            }

            return getD4HTeamMembers(credentialRef, teamId);
        }),

    /**
     * Lists all teams in the D4H system that are accessible to the organization.
     */
    listTeams: organizationProcedure({ d4hEquipment: ["view"] })
        .output(z.array(D4HTeamRef.schema))
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const { d4HTeams } = await getD4HTokenMetadata(toD4HCredentialRef(accessToken));
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
            const credentialRef = toD4HCredentialRef(accessToken);
            const fetchClient = getD4HFetchClient(accessToken);
            const whoami = await fetchD4HWhoamiCached(credentialRef);
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
                        const { timezone } = await fetchD4HTeamDetailCached(credentialRef, teamId);
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

    /**
     * Update an equipment item in D4H. Needs D4H's own Equipment UPDATE permission on the team as
     * well as AVUT's `d4hEquipment: ["update"]`. Returns the item as D4H holds it after the update.
     *
     * The D4H write can't join a Prisma transaction, so the log entry is written after it
     * succeeds (the non-Prisma exception in `docs/patterns/transactional-writes.md`).
     */
    updateEquipmentItem: organizationProcedure({ d4hEquipment: ["update"] })
        .input(
            D4HEquipmentItemUpdate.schema.extend({ teamId: z.number(), itemId: z.number() }).refine(
                // `updateNotes` only annotates a change, so it doesn't count as one.
                ({ teamId: _teamId, itemId: _itemId, updateNotes: _updateNotes, ...update }) =>
                    Object.values(update).some((value) => value !== undefined),
                { error: "At least one field must be updated." },
            ),
        )
        .output(D4HEquipmentItemDetail.schema)
        .mutation(async ({ ctx, input }) => {
            const { teamId, itemId, organizationId: _organizationId, ...update } = input;
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            await requireD4HTeamPermission(accessToken, teamId, "Equipment", "UPDATE");

            const before = await fetchD4HEquipmentItem(accessToken, teamId, itemId);
            if (!before || before.owner.id !== teamId) {
                throw new NotFoundError(`Equipment item ${itemId} not found in team ${teamId}.`);
            }

            await patchD4HEquipmentItem(accessToken, teamId, itemId, update);

            // The PATCH has landed by now, so a failed re-fetch mustn't leave it unlogged or
            // report it as failed: fall back to the item as the PATCH should have left it.
            const after = await fetchD4HEquipmentItem(accessToken, teamId, itemId).catch(
                (err: unknown) => {
                    console.error(`Failed to re-fetch D4H equipment item ${itemId}:`, err);
                    return null;
                },
            );
            const result = after ?? { ...before, ...R.pick(update, PATCHABLE_ITEM_FIELDS) };

            await ctx.logEvent({
                action: "Update",
                objectType: "D4HEquipmentItem",
                objectId: String(itemId),
                changes: diffObject(
                    R.pick(before, PATCHABLE_ITEM_FIELDS),
                    R.pick(result, PATCHABLE_ITEM_FIELDS),
                ),
            });

            return result;
        }),
});
