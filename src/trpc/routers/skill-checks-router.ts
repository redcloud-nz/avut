/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillCheckSession, SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import { Skill, SkillId, SkillRef } from "@/lib/schemas/skill";
import { SkillCheck, SkillCheckId } from "@/lib/schemas/skill-check";
import { TeamId } from "@/lib/schemas/team";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

export const skillChecksRouter = createTrpcRouter({
    /**
     * Approves a session by stamping each skill check as Include or Exclude and moving the session to Include status.
     */
    approveSession: organizationProcedure({ skillCheckSession: ["update"], skillCheck: ["update"] })
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
            ]);

            await ctx.logEvent({
                action: "Approve",
                objectType: "SkillCheckSession",
                objectId: sessionId,
                description: `Approved session "${session.name}".`,
            });

            return {
                updated: SkillCheckSession.fromRecord({
                    ...session,
                    status: "Include",
                    updatedAt: new Date(),
                }),
            };
        }),

    /**
     * Creates a skill check. If sessionId is provided, the session must exist and belong to the same organization.
     */
    createSkillCheck: organizationProcedure({ skillCheck: ["create"] })
        .input(
            z.object({
                skillCheckId: SkillCheckId.schema,
                sessionId: SkillCheckSessionId.schema.nullable(),
                create: SkillCheck.schema.pick({
                    assesseeId: true,
                    assessorId: true,
                    skillId: true,
                    result: true,
                    notes: true,
                }),
            }),
        )
        .output(SkillCheck.schema)
        .mutation(async ({ ctx, input }) => {
            const { skillCheckId, sessionId, create } = input;

            // Validate session exists if sessionId is provided
            if (sessionId) {
                const session = await ctx.prisma.skillCheckSession.findUnique({
                    where: {
                        id: sessionId,
                        organizationId: ctx.organizationId,
                    },
                });
                if (!session) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: Messages.skillCheckSessionNotFound(sessionId),
                    });
                }
            }

            const record = await ctx.prisma.skillCheck.create({
                data: {
                    id: skillCheckId,
                    organizationId: ctx.organizationId,
                    sessionId,
                    ...create,
                },
            });

            return SkillCheck.fromRecord(record);
        }),

    /**
     * Deletes a skill check. The skill check must belong to the organization.
     */
    deleteSkillCheck: organizationProcedure({ skillCheck: ["delete"] })
        .input(z.object({ skillCheckId: SkillCheckId.schema }))
        .mutation(async ({ ctx, input }) => {
            const { skillCheckId } = input;

            await ctx.prisma.skillCheck.delete({
                where: {
                    id: skillCheckId,
                    organizationId: ctx.organizationId,
                },
            });
        }),

    /**
     * Returns the competency matrix for the given scope. Personnel scope: teamId, personId, or
     * all active org personnel. Skill scope: skillId, skillGroupId, skillPackageId, or all active
     * subscribed skills. Skills, groups and packages are returned as flat sibling arrays in the
     * same shape as `skills.listAssessableSkills`, with only the groups and packages that contain
     * an in-scope skill. Competencies contain only the most recent Include-status check per
     * (assessee, skill) pair, with expiry computed from the skill's frequency (months).
     */
    getCompetencyMatrix: organizationProcedure({ skillCheck: ["view"] })
        .input(
            z
                .object({
                    teamId: TeamId.schema.optional(),
                    personId: PersonId.schema.optional(),
                    skillId: SkillId.schema.optional(),
                    skillGroupId: SkillGroupId.schema.optional(),
                    skillPackageId: SkillPackageId.schema.optional(),
                })
                .refine(
                    (d) => !d.teamId || !d.personId,
                    "Provide at most one of teamId or personId",
                )
                .refine(
                    (d) =>
                        [d.skillId, d.skillGroupId, d.skillPackageId].filter(Boolean).length <= 1,
                    "Provide at most one of skillId, skillGroupId, skillPackageId",
                ),
        )
        .output(
            z.object({
                personnel: z.array(PersonRef.schema),
                skillPackages: z.array(SkillPackage.schema),
                skillGroups: z.array(SkillGroup.schema),
                skills: z.array(Skill.schema),
                competencies: z.array(
                    z.object({
                        assesseeId: PersonId.schema,
                        skillId: SkillId.schema,
                        checkId: SkillCheckId.schema,
                        result: z.string(),
                        checkedAt: z.iso.datetime(),
                        expiresAt: z.iso.datetime(),
                        isCurrent: z.boolean(),
                    }),
                ),
            }),
        )
        .query(async ({ ctx, input }) => {
            // Step 1: Resolve personnel scope
            let personnel: PersonRef[];

            if (input.teamId) {
                const memberships = await ctx.prisma.teamMembership.findMany({
                    where: {
                        organizationId: ctx.organizationId,
                        teamId: input.teamId,
                        person: { status: "Active" },
                    },
                    include: { person: { select: { id: true, name: true } } },
                });
                personnel = memberships.map((m) => PersonRef.schema.parse(m.person));
            } else if (input.personId) {
                const person = await ctx.prisma.person.findFirst({
                    where: {
                        id: input.personId,
                        organizationId: ctx.organizationId,
                        status: "Active",
                    },
                    select: { id: true, name: true },
                });
                personnel = person ? [PersonRef.schema.parse(person)] : [];
            } else {
                const persons = await ctx.prisma.person.findMany({
                    where: { organizationId: ctx.organizationId, status: "Active" },
                    select: { id: true, name: true },
                });
                personnel = persons.map((p) => PersonRef.schema.parse(p));
            }

            const personnelIds = new Set(personnel.map((p) => p.id));

            // Step 2: Resolve skill scope — active skills from active, published subscribed packages
            const subscriptions = await ctx.prisma.skillPackageSubscription.findMany({
                where: { organizationId: ctx.organizationId },
                include: {
                    skillPackage: {
                        include: {
                            skills: true,
                            groups: true,
                        },
                    },
                },
            });

            const packageMap = new Map<string, SkillPackage>();
            const groupMap = new Map<string, SkillGroup>();
            const skillMap = new Map<string, Skill>();

            for (const sub of subscriptions) {
                const pkg = sub.skillPackage;
                if (pkg.status !== "Active" || !pkg.published || packageMap.has(pkg.id)) continue;

                packageMap.set(pkg.id, SkillPackage.fromRecord(pkg));
                for (const group of pkg.groups) {
                    groupMap.set(group.id, SkillGroup.fromRecord(group));
                }
                for (const skill of pkg.skills) {
                    if (skill.status !== "Active") continue;
                    skillMap.set(skill.id, Skill.fromRecord(skill));
                }
            }

            let skills: Skill[];
            if (input.skillId) {
                skills = [...skillMap.values()].filter((s) => s.id === input.skillId);
            } else if (input.skillGroupId) {
                skills = [...skillMap.values()].filter(
                    (s) => s.skillGroupId === input.skillGroupId,
                );
            } else if (input.skillPackageId) {
                skills = [...skillMap.values()].filter(
                    (s) => s.skillPackageId === input.skillPackageId,
                );
            } else {
                skills = [...skillMap.values()];
            }

            // Only return the groups and packages that still contain an in-scope skill, so the
            // client can render the hierarchy without pruning empty sections itself.
            const skillGroups = R.pipe(
                skills,
                R.map((skill) => groupMap.get(skill.skillGroupId)),
                R.filter((group): group is SkillGroup => group !== undefined),
                R.uniqueBy((group) => group.id),
            );
            const skillPackages = R.pipe(
                skills,
                R.map((skill) => packageMap.get(skill.skillPackageId)),
                R.filter((pkg): pkg is SkillPackage => pkg !== undefined),
                R.uniqueBy((pkg) => pkg.id),
            );

            const skillIds = new Set(skills.map((s) => s.id));

            if (personnelIds.size === 0 || skillIds.size === 0) {
                return { personnel, skillPackages, skillGroups, skills, competencies: [] };
            }

            // Step 3: Most recent Include check per (assessee, skill)
            const allChecks = await ctx.prisma.skillCheck.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    status: "Include",
                    assesseeId: { in: [...personnelIds] },
                    skillId: { in: [...skillIds] },
                },
                select: {
                    id: true,
                    assesseeId: true,
                    skillId: true,
                    result: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
            });

            const latestByKey = new Map<string, (typeof allChecks)[number]>();
            for (const check of allChecks) {
                const key = `${check.assesseeId}:${check.skillId}`;
                if (!latestByKey.has(key)) latestByKey.set(key, check);
            }

            // Step 4: Compute expiry from skill frequency
            const now = new Date();
            const competencies = [...latestByKey.values()].map((check) => {
                const skill = skillMap.get(check.skillId)!;
                const expiresAt = new Date(check.createdAt);
                expiresAt.setMonth(expiresAt.getMonth() + skill.frequency);
                return {
                    assesseeId: check.assesseeId as PersonId,
                    skillId: check.skillId as SkillId,
                    checkId: check.id as SkillCheckId,
                    result: check.result,
                    checkedAt: check.createdAt.toISOString(),
                    expiresAt: expiresAt.toISOString(),
                    isCurrent: expiresAt > now,
                };
            });

            return { personnel, skillPackages, skillGroups, skills, competencies };
        }),

    /**
     * Lists skill checks recorded within the last month, with resolved names for assessee,
     * assessor, skill, and session. Ordered by createdAt descending.
     */
    listRecentChecks: organizationProcedure({ skillCheck: ["view"] })
        .output(
            z.array(
                SkillCheck.schema.extend({
                    assessee: PersonRef.schema,
                    assessor: PersonRef.schema,
                    skill: SkillRef.schema,
                    session: z
                        .object({ id: SkillCheckSessionId.schema, name: z.string() })
                        .nullable(),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const since = new Date();
            since.setMonth(since.getMonth() - 1);

            const checks = await ctx.prisma.skillCheck.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    createdAt: { gte: since },
                },
                include: {
                    assessee: { select: { id: true, name: true } },
                    assessor: { select: { id: true, name: true } },
                    skill: { select: { id: true, name: true } },
                    session: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
            });

            return checks.map((check) => ({
                ...SkillCheck.fromRecord(check),
                assessee: PersonRef.schema.parse(check.assessee),
                assessor: PersonRef.schema.parse(check.assessor),
                skill: SkillRef.schema.parse(check.skill),
                session: check.session
                    ? {
                          id: check.session.id as SkillCheckSessionId,
                          name: check.session.name,
                      }
                    : null,
            }));
        }),

    /**
     * Lists skill checks. Optionally filtered by sessionId, skillId, assesseeId, or assessorId.
     */
    listSkillChecks: organizationProcedure({ skillCheck: ["view"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema.optional(),
                skillId: SkillId.schema.optional(),
                assesseeId: PersonId.schema.optional(),
                assessorId: PersonId.schema.optional(),
                ownChecksOnly: z.boolean().optional(),
            }),
        )
        .output(z.array(SkillCheck.schema))
        .query(async ({ ctx, input }) => {
            const { sessionId, skillId, assesseeId, assessorId, ownChecksOnly } = input;

            let resolvedAssessorId = assessorId;
            if (ownChecksOnly) {
                const orgUser = await ctx.prisma.organizationUser.findFirst({
                    where: { organizationId: ctx.organizationId, userId: ctx.userId },
                    select: { personId: true },
                });

                resolvedAssessorId = (orgUser?.personId ?? undefined) as PersonId | undefined;
            }

            const checks = await ctx.prisma.skillCheck.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    sessionId,
                    skillId,
                    assesseeId,
                    assessorId: resolvedAssessorId,
                },
            });

            return checks.map((check) => SkillCheck.fromRecord(check));
        }),

    /**
     * Create, update, or delete multiple skill checks for a session. All skill checks must belong to the organization.
     *
     * For each provided skill check update:
     * - If the provided result is "NotAssessed", the skill check will be deleted if it exists.
     * - If there is an existing skill check for the assessee, skill, and session, it will be updated with the provided result and notes.
     * - If there is no existing skill check for the assessee, skill, and session, a new skill check will be created with the provided result and notes.
     */
    upsertSessionSkillChecks: organizationProcedure({ skillCheck: ["update"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
                updates: z.array(
                    SkillCheck.schema.pick({
                        assesseeId: true,
                        skillId: true,
                        result: true,
                        notes: true,
                    }),
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
                    message: "You must have a linked person record to record skill checks.",
                });
            }
            const assessorId = orgUser.personId;

            const created: SkillCheck[] = [];
            const updated: SkillCheck[] = [];
            const deleted: { assesseeId: PersonId; skillId: SkillId }[] = [];

            for (const update of updates) {
                if (update.result == "NotAssessed") {
                    // If there is an existing skill check, delete it. If there isn't, do nothing.
                    // This allows the client to "clear" a skill check by setting its result to NotAssessed.
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

    /**
     * Updates a skill check's result and notes. The skill check must belong to the organization.
     */
    updateSkillCheck: organizationProcedure({ skillCheck: ["update"] })
        .input(
            z.object({
                skillCheckId: SkillCheckId.schema,
                update: SkillCheck.schema.pick({
                    result: true,
                    notes: true,
                }),
            }),
        )
        .output(SkillCheck.schema)
        .mutation(async ({ ctx, input }) => {
            const { skillCheckId, update } = input;

            const record = await ctx.prisma.skillCheck.update({
                where: {
                    id: skillCheckId,
                    organizationId: ctx.organizationId,
                },
                data: update,
            });

            return SkillCheck.fromRecord(record);
        }),
});
