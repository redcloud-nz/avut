/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { SkillCheck, SkillCheckId, SkillCheckResultValue } from "@/lib/schemas/skill-check";
import { SkillCheckSession, SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import * as SkillChecks from "@/server/services/skill-checks";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

export const skillCheckSessionsRouter = createTrpcRouter({
    /**
     * Approves a session by stamping each skill check as Include or Exclude and moving the session to Include status.
     */
    approveSession: organizationProcedure({ skillCheckSession: ["approve"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
                includedCheckIds: z.array(SkillCheckId.schema),
            }),
        )
        .output(z.object({ updated: SkillCheckSession.schema }))
        .mutation(async ({ ctx, input }) => {
            const { sessionId, includedCheckIds } = input;

            const session = await ctx.prisma.skillCheckSession.findUnique({
                where: { id: sessionId, organizationId: ctx.organizationId },
            });
            if (!session) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillCheckSessionNotFound(sessionId),
                });
            }

            await ctx.prisma.$transaction([
                ctx.prisma.skillCheck.updateMany({
                    where: {
                        organizationId: ctx.organizationId,
                        sessionId,
                        id: { in: includedCheckIds },
                    },
                    data: { status: "Include" },
                }),
                ctx.prisma.skillCheck.updateMany({
                    where: {
                        organizationId: ctx.organizationId,
                        sessionId,
                        NOT: { id: { in: includedCheckIds } },
                    },
                    data: { status: "Exclude" },
                }),
                ctx.prisma.skillCheckSession.update({
                    where: { id: sessionId, organizationId: ctx.organizationId },
                    data: { status: "Include" },
                }),
                ctx.logEvent({
                    action: "Approve",
                    objectType: "SkillCheckSession",
                    objectId: sessionId,
                    description: `Approved session "${session.name}".`,
                }),
            ]);

            return {
                updated: SkillCheckSession.fromRecord({
                    ...session,
                    status: "Include",
                    updatedAt: new Date(),
                }),
            };
        }),

    /**
     * Create a new skill check session for the organization. The caller is assigned as the
     * session's sole assessor, so they must have a linked person record.
     * @param name The name of the session.
     * @param startsAt Optional start datetime for the session.
     * @param endsAt Optional end datetime for the session.
     * @param notes Optional notes for the session.
     * @param status The status of the session.
     * @returns The created skill check session.
     * @throws TRPCError(BAD_REQUEST) if the caller has no linked person record.
     */
    createSession: organizationProcedure({ skillCheckSession: ["create"] })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                create: SkillCheckSession.modifiableSchema,
            }),
        )
        .output(
            z.object({
                created: SkillCheckSession.schema.extend({ assessors: z.array(PersonRef.schema) }),
            }),
        )
        .mutation(async ({ ctx, input: { organizationId, skillCheckSessionId, create } }) => {
            const orgUser = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId, userId: ctx.userId },
                select: { personId: true },
            });
            if (!orgUser?.personId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: Messages.noLinkedPersonRecord(),
                });
            }
            const assessorPersonId = orgUser.personId;

            const session = await SkillChecks.createSession(ctx, (sessionNumber) => ({
                id: skillCheckSessionId,
                organizationId,
                name: create.name.trim() || `Session #${sessionNumber}`,
                sessionNumber,
                startsAt: new Date(create.date),
                endsAt: new Date(create.date),
                notes: create.notes,
                status: create.status,
                assessors: { connect: [{ id: assessorPersonId }] },
            }));

            await ctx.logEvent({
                action: "Create",
                objectType: "SkillCheckSession",
                objectId: skillCheckSessionId,
                changes: diffObject({}, create),
            });

            return {
                created: {
                    ...SkillCheckSession.fromRecord(session),
                    assessors: session.assessors.map((person) => PersonRef.schema.parse(person)),
                },
            };
        }),

    /**
     * Delete a skill check session. Requires the "delete" action on "skillCheckSession".
     * @param skillCheckSessionId The ID of the skill check session to delete.
     * @returns The deleted skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    deleteSession: organizationProcedure({ skillCheckSession: ["delete"] })
        .input(z.object({ skillCheckSessionId: SkillCheckSessionId.schema }))
        .output(z.object({ deleted: SkillCheckSession.schema }))
        .mutation(async ({ ctx, input: { organizationId, skillCheckSessionId } }) => {
            const session = await SkillChecks.requireSessionById(ctx, skillCheckSessionId);

            await ctx.prisma.$transaction([
                ctx.prisma.skillCheckSession.delete({
                    where: {
                        id: skillCheckSessionId,
                        organizationId,
                    },
                }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "SkillCheckSession",
                    objectId: skillCheckSessionId,
                }),
            ]);

            return { deleted: session };
        }),

    /**
     * Get a skill check session by ID.
     * @param skillCheckSessionId The ID of the skill check session to retrieve.
     * @returns The skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    getSession: organizationProcedure({ skillCheckSession: ["view"] })
        .input(z.object({ skillCheckSessionId: SkillCheckSessionId.schema }))
        .output(SkillCheckSession.schema.extend({ assessors: z.array(PersonRef.schema) }))
        .query(async ({ ctx, input: { skillCheckSessionId } }) => {
            const session =
                (await ctx.prisma.skillCheckSession.findUnique({
                    where: {
                        id: skillCheckSessionId,
                        organizationId: ctx.organizationId,
                    },
                    include: {
                        assessors: {
                            select: { id: true, name: true },
                        },
                    },
                })) ?? sessionNotFound(skillCheckSessionId);

            return {
                ...SkillCheckSession.fromRecord(session),
                assessors: session.assessors.map((person) => PersonRef.schema.parse(person)),
            };
        }),

    /**
     * Get metrics for a skill check session, including the number of assessees, skills, and checks associated with the session.
     */
    getSessionMetrics: organizationProcedure({ skillCheckSession: ["view"] })
        .input(z.object({ skillCheckSessionId: SkillCheckSessionId.schema }))
        .output(
            z.object({
                assesseeCount: z.number(),
                skillCount: z.number(),
                checkCount: z.number(),
            }),
        )
        .query(async ({ ctx, input: { skillCheckSessionId } }) => {
            const session = await ctx.prisma.skillCheckSession.findUnique({
                where: {
                    organizationId: ctx.organizationId,
                    id: skillCheckSessionId,
                },
                include: {
                    _count: {
                        select: {
                            assessees: true,
                            skills: true,
                            skillChecks: true,
                        },
                    },
                },
            });

            if (!session)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillCheckSessionNotFound(skillCheckSessionId),
                });

            return {
                assesseeCount: session._count.assessees,
                skillCount: session._count.skills,
                checkCount: session._count.skillChecks,
            };
        }),

    /**
     * List the personnel that are assigned to a particular skill check session as assessees.
     * @param skillCheckSessionId The ID of the skill check session to list assessees for.
     * @param scope The scope of assessees to return, either "all" for all personnel that are assigned or have checks recorded in the session, or "assigned" for only those personnel that are currently assigned to the session.
     * @returns An array of assessees assigned to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    listSessionAssessees: organizationProcedure({ skillCheckSession: ["view"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
                scope: z.enum(["all", "assigned"]),
            }),
        )
        .output(z.array(PersonRef.schema))
        .query(async ({ ctx, input: { sessionId, scope } }) => {
            const session =
                (await ctx.prisma.skillCheckSession.findUnique({
                    where: {
                        id: sessionId,
                        organizationId: ctx.organizationId,
                    },
                    include: {
                        assessees: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                })) ?? sessionNotFound(sessionId);

            if (scope == "assigned") {
                // Return only the personnel that are currently assigned.
                return session.assessees
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((person) => PersonRef.schema.parse(person));
            } else {
                // Return all personnel that are either currently assigned or have checks recorded in the session.
                const checks = await ctx.prisma.skillCheck.findMany({
                    where: {
                        sessionId,
                    },
                    select: {
                        assesseeId: true,
                        assessee: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    distinct: ["assesseeId"],
                });
                const allAssessees = [
                    ...session.assessees,
                    ...checks.map((check) => check.assessee),
                ];

                const uniqueAssessees = R.uniqueBy(allAssessees, (a) => a.id);

                return uniqueAssessees
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((person) => PersonRef.schema.parse(person));
            }
        }),

    /**
     * List the personnel that are assigned to a particular skill check session as assessors.
     * @param skillCheckSessionId The ID of the skill check session to list assessors for.
     * @param scope The scope of assessors to return, either "all" for all personnel that are assigned or have checks recorded in the session, or "assigned" for only those personnel that are currently assigned to the session.
     * @returns An array of assessors assigned to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    listSessionAssessors: organizationProcedure({ skillCheckSession: ["view"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
                scope: z.enum(["all", "assigned"]),
            }),
        )
        .output(z.array(PersonRef.schema))
        .query(async ({ ctx, input: { sessionId, scope } }) => {
            const session =
                (await ctx.prisma.skillCheckSession.findUnique({
                    where: {
                        id: sessionId,
                        organizationId: ctx.organizationId,
                    },
                    include: {
                        assessors: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                })) ?? sessionNotFound(sessionId);

            if (scope === "assigned") {
                return session.assessors
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((person) => PersonRef.schema.parse(person));
            } else {
                const checks = await ctx.prisma.skillCheck.findMany({
                    where: {
                        sessionId,
                    },
                    select: {
                        assessorId: true,
                        assessor: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    distinct: ["assessorId"],
                });

                // A purged assessor (null) has no Person to list.
                const assessors = checks.flatMap((check) =>
                    check.assessor ? [check.assessor] : [],
                );

                const uniqueAssessors = R.uniqueBy(assessors, (a) => a.id);

                return uniqueAssessors
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((person) => PersonRef.schema.parse(person));
            }
        }),

    /**
     * List the skills that are assigned to a particular skill check session.
     * @param skillCheckSessionId The ID of the skill check session to list skills for.
     * @param scope The scope of skills to return, either "all" for all skills that are assigned or have checks recorded in the session, or "assigned" for only those skills that are currently assigned to the session.
     * @returns An array of refs representing the skills assigned to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    listSessionSkills: organizationProcedure({ skillCheckSession: ["view"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
                scope: z.enum(["all", "assigned"]),
            }),
        )
        .output(z.array(SkillRef.schema))
        .query(async ({ ctx, input: { sessionId, scope } }) => {
            const session =
                (await ctx.prisma.skillCheckSession.findUnique({
                    where: {
                        id: sessionId,
                        organizationId: ctx.organizationId,
                    },
                    include: {
                        skills: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                })) ?? sessionNotFound(sessionId);

            if (scope == "assigned") {
                // Return only the skills that are currently assigned.
                return session.skills
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((skill) => SkillRef.schema.parse(skill));
            } else {
                // Return all skills that are either currently assigned or have checks recorded in the session.
                const checks = await ctx.prisma.skillCheck.findMany({
                    where: {
                        sessionId,
                    },
                    select: {
                        skillId: true,
                        skill: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    distinct: ["skillId"],
                });
                const allSkills = [...session.skills, ...checks.map((check) => check.skill)];

                const uniqueSkills = R.uniqueBy(allSkills, (a) => a.id);

                return uniqueSkills
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((skill) => SkillRef.schema.parse(skill));
            }
        }),

    /**
     * List all skill check sessions for the organization. Requires "view" skill on "Skills" module.
     * @returns An array of skill check sessions associated with the organization.
     */
    listSessions: organizationProcedure({
        skillCheckSession: ["view"],
    })
        .output(z.array(SkillCheckSession.schema.extend({ assessors: z.array(PersonRef.schema) })))
        .query(async ({ ctx, input: { organizationId } }) => {
            const sessions = await ctx.prisma.skillCheckSession.findMany({
                where: {
                    organizationId,
                },
                include: {
                    assessors: {
                        select: { id: true, name: true },
                    },
                },
            });

            return sessions.map((session) => ({
                ...SkillCheckSession.fromRecord(session),
                assessors: session.assessors.map((person) => PersonRef.schema.parse(person)),
            }));
        }),

    /**
     * Get the next available session number for the organization, for use as a display default
     * when creating a new session. Advisory only — the number actually assigned at creation may
     * differ if another session is created concurrently.
     * @returns The next available session number.
     */
    nextSessionNumber: organizationProcedure({ skillCheckSession: ["view"] })
        .output(z.object({ nextSessionNumber: z.number().int() }))
        .query(async ({ ctx }) => ({
            nextSessionNumber: await SkillChecks.nextSessionNumber(ctx),
        })),

    /**
     * Update a skill check session.
     * @param skillCheckSessionId The ID of the skill check session to update.
     * @param update The fields to update on the skill check session.
     * @returns The updated skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    updateSession: organizationProcedure({ skillCheckSession: ["update"] })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                update: SkillCheckSession.modifiableSchema,
            }),
        )
        .output(z.object({ updated: SkillCheckSession.schema }))
        .mutation(async ({ ctx, input: { organizationId, skillCheckSessionId, update } }) => {
            const existing = await SkillChecks.requireSessionById(ctx, skillCheckSessionId);

            const changes = diffObject(SkillCheckSession.modifiableSchema.parse(existing), update);

            if (changes.length == 0) return { updated: existing }; // No changes

            const [updated] = await ctx.prisma.$transaction([
                ctx.prisma.skillCheckSession.update({
                    where: {
                        id: skillCheckSessionId,
                        organizationId,
                    },
                    include: {},
                    data: {
                        name: update.name,
                        startsAt: update.date,
                        endsAt: update.date,
                        notes: update.notes,
                        status: update.status,
                    },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "SkillCheckSession",
                    objectId: skillCheckSessionId,
                    changes,
                }),
            ]);

            return { updated: SkillCheckSession.fromRecord(updated) };
        }),

    /**
     * Update the personnel assigned to a skill check session as assessees. This will replace the current list of assessees with the provided list.
     * @param skillCheckSessionId The ID of the skill check session to update assessees for.
     * @param personIds An array of person IDs to assign as assessees to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    updateSessionAssessees: organizationProcedure({ skillCheckSession: ["update"] })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                addedPersonIds: z.array(PersonId.schema),
                removedPersonIds: z.array(PersonId.schema),
            }),
        )
        .output(
            z.object({
                updatedAssessees: z.array(PersonRef.schema),
                updatedSession: SkillCheckSession.schema,
            }),
        )
        .mutation(
            async ({ ctx, input: { skillCheckSessionId, addedPersonIds, removedPersonIds } }) => {
                // Verify that the session exists and belongs to the organization.
                await SkillChecks.requireSessionById(ctx, skillCheckSessionId);

                const changes = [
                    ...addedPersonIds.map((id) => ({
                        path: ["assessees"],
                        type: "arr_add" as const,
                        value: id,
                    })),
                    ...removedPersonIds.map((id) => ({
                        path: ["assessees"],
                        type: "arr_del" as const,
                        value: id,
                    })),
                ];

                const [updated] = await ctx.prisma.$transaction([
                    ctx.prisma.skillCheckSession.update({
                        where: {
                            id: skillCheckSessionId,
                            organizationId: ctx.organizationId,
                        },
                        include: {
                            assessees: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                        data: {
                            assessees: {
                                connect: addedPersonIds.map((id) => ({ id })),
                                disconnect: removedPersonIds.map((id) => ({ id })),
                            },
                        },
                    }),
                    ctx.logEvent({
                        action: "Update",
                        objectType: "SkillCheckSession",
                        objectId: skillCheckSessionId,
                        changes,
                    }),
                ]);
                return {
                    updatedAssessees: updated.assessees,
                    updatedSession: SkillCheckSession.fromRecord(updated),
                };
            },
        ),

    /**
     * Update the skills assigned to a skill check session. This will replace the current list of skills with the provided list.
     * @param skillCheckSessionId The ID of the skill check session to update skills for.
     * @param skillIds An array of skill IDs to assign to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     */
    updateSessionSkills: organizationProcedure({ skillCheckSession: ["update"] })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                addedSkillIds: z.array(SkillId.schema),
                removedSkillIds: z.array(SkillId.schema),
            }),
        )
        .output(
            z.object({
                updatedSkills: z.array(SkillRef.schema),
                updatedSession: SkillCheckSession.schema,
            }),
        )
        .mutation(
            async ({ ctx, input: { skillCheckSessionId, addedSkillIds, removedSkillIds } }) => {
                // Verify that the session exists and belongs to the organization.
                await SkillChecks.requireSessionById(ctx, skillCheckSessionId);

                const changes = [
                    ...addedSkillIds.map((id) => ({
                        path: ["skills"],
                        type: "arr_add" as const,
                        value: id,
                    })),
                    ...removedSkillIds.map((id) => ({
                        path: ["skills"],
                        type: "arr_del" as const,
                        value: id,
                    })),
                ];

                const [updated] = await ctx.prisma.$transaction([
                    ctx.prisma.skillCheckSession.update({
                        where: {
                            id: skillCheckSessionId,
                            organizationId: ctx.organizationId,
                        },
                        include: {
                            skills: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                        data: {
                            skills: {
                                connect: addedSkillIds.map((id) => ({ id })),
                                disconnect: removedSkillIds.map((id) => ({ id })),
                            },
                        },
                    }),
                    ctx.logEvent({
                        action: "Update",
                        objectType: "SkillCheckSession",
                        objectId: skillCheckSessionId,
                        changes,
                    }),
                ]);
                return {
                    updatedSkills: updated.skills,
                    updatedSession: SkillCheckSession.fromRecord(updated),
                };
            },
        ),

    /**
     * Create, update, or delete multiple skill checks for a session. All skill checks must belong to the organization.
     *
     * For each provided skill check update:
     * - If the provided result is null, the skill check will be deleted if it exists.
     * - If there is an existing skill check for the assessee, skill, and session, it will be updated with the provided result and notes.
     * - If there is no existing skill check for the assessee, skill, and session, a new skill check will be created with the provided result and notes.
     */
    // Recording/clearing checks within a session the caller assesses needs both halves: a
    // session update and `skillCheck: ["create"]` (the "records checks" grant). `skillCheck` has
    // no `"update"` action, and every write below is scoped to the caller's own `assessorId`.
    // The `skillCheck` half keeps `skills-admin` — which holds session update, and so could add
    // itself as an assessor — from recording checks.
    upsertSessionSkillChecks: organizationProcedure({
        skillCheckSession: ["update"],
        skillCheck: ["create"],
    })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
                updates: z.array(
                    SkillCheck.schema
                        .pick({
                            assesseeId: true,
                            skillId: true,
                            notes: true,
                        })
                        .extend({ result: SkillCheckResultValue.schema.nullable() }),
                ),
            }),
        )
        .output(
            z.object({
                created: z.array(SkillCheck.schema),
                updated: z.array(SkillCheck.schema),
                deleted: z.array(
                    z.object({ assesseeId: PersonId.schema, skillId: SkillId.schema }),
                ),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { sessionId, updates } = input;

            // Validate session exists
            const session = await ctx.prisma.skillCheckSession.findUnique({
                where: {
                    id: sessionId,
                    organizationId: ctx.organizationId,
                },
                include: {
                    assessors: {
                        select: { id: true },
                    },
                },
            });
            if (!session) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillCheckSessionNotFound(sessionId),
                });
            }

            const orgUser = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId: ctx.organizationId, userId: ctx.userId },
                select: { personId: true },
            });
            if (!orgUser?.personId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: Messages.noLinkedPersonRecord(),
                });
            }
            const assessorId = orgUser.personId;

            if (!session.assessors.some((assessor) => assessor.id === assessorId)) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: Messages.notSessionAssessor(sessionId),
                });
            }

            const created: SkillCheck[] = [];
            const updated: SkillCheck[] = [];
            const deleted: { assesseeId: PersonId; skillId: SkillId }[] = [];

            for (const update of updates) {
                if (update.result === null) {
                    // If there is an existing skill check, delete it. If there isn't, do nothing.
                    // This allows the client to "clear" a skill check by setting its result to null.
                    await ctx.prisma.skillCheck.deleteMany({
                        where: {
                            organizationId: ctx.organizationId,
                            sessionId,
                            skillId: update.skillId,
                            assesseeId: update.assesseeId,
                            assessorId,
                        },
                    });
                    deleted.push({ assesseeId: update.assesseeId, skillId: update.skillId });
                } else {
                    const newSkillCheckId = SkillCheckId.create();

                    const result = await ctx.prisma.skillCheck.upsert({
                        where: {
                            assesseeId_assessorId_sessionId_skillId: {
                                assesseeId: update.assesseeId,
                                assessorId,
                                sessionId,
                                skillId: update.skillId,
                            },
                        },
                        update: {
                            result: update.result,
                            notes: update.notes,
                            assessorId,
                        },
                        create: {
                            id: newSkillCheckId,
                            organizationId: ctx.organizationId,
                            sessionId,
                            assesseeId: update.assesseeId,
                            assessorId,
                            skillId: update.skillId,
                            result: update.result,
                            notes: update.notes,
                        },
                    });

                    if (result.id === newSkillCheckId) {
                        created.push(SkillCheck.fromRecord(result));
                    } else {
                        updated.push(SkillCheck.fromRecord(result));
                    }
                }
            }

            return {
                created,
                updated,
                deleted,
            };
        }),
});

function sessionNotFound(sessionId: SkillCheckSessionId): never {
    throw new TRPCError({
        code: "NOT_FOUND",
        message: Messages.skillCheckSessionNotFound(sessionId),
    });
}
