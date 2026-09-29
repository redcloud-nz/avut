/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { PersonId, PersonRef } from "@/lib/schemas/person";
import { Skill, SkillId, SkillRef } from "@/lib/schemas/skill";
import { SkillCheck, SkillCheckId, SkillCheckResultValue } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import { TeamId } from "@/lib/schemas/team";
import * as SkillChecks from "@/server/services/skill-checks";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

/**
 * A `.catch` handler for a skill check write guarded by `status: { not: "Deleted" }`: the row
 * matched the pre-check but was tombstoned (or removed) before the write, so Prisma raises
 * `P2025`. Report that as the `NOT_FOUND` the pre-check would have given, not a 500.
 */
function rethrowSkillCheckGone(skillCheckId: string) {
    return (error: unknown): never => {
        if (error instanceof Object && "code" in error && error.code === "P2025") {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: Messages.skillCheckNotFound(skillCheckId),
                cause: error,
            });
        }
        throw error;
    };
}

export const skillChecksRouter = createTrpcRouter({
    /**
     * Creates a standalone skill check, outside any session. Checks within a session are recorded
     * through `skillCheckSessions.setSessionSkillCheck`, which enforces assessor membership and
     * the approval lock.
     * @throws TRPCError(BAD_REQUEST) if `sessionId` is not null.
     */
    // `sessionId` stays in the input (nullable) so existing callers keep their shape; only `null`
    // is accepted.
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

            if (sessionId !== null) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: Messages.sessionCheckNotAllowed(sessionId),
                });
            }

            const record = await ctx.prisma.skillCheck.create({
                data: {
                    id: skillCheckId,
                    organizationId: ctx.organizationId,
                    sessionId: null,
                    ...create,
                },
            });

            return SkillCheck.fromRecord(record);
        }),

    /**
     * Deletes a skill check. The skill check must belong to the organization. A check within a
     * session is tombstoned (`status: "Deleted"`) for `approveSession`/`deleteSession` to purge;
     * a standalone check is removed outright.
     * @throws TRPCError(NOT_FOUND) if the check does not exist or is already `Deleted`.
     * @throws TRPCError(CONFLICT) if the check belongs to an approved session.
     */
    // No ownership check: `skillCheck: ["delete"]` is an admin grant for removing erroneous checks.
    deleteSkillCheck: organizationProcedure({ skillCheck: ["delete"] })
        .input(z.object({ skillCheckId: SkillCheckId.schema }))
        .mutation(async ({ ctx, input }) => {
            const { skillCheckId } = input;

            const existing = await ctx.prisma.skillCheck.findFirst({
                where: {
                    id: skillCheckId,
                    organizationId: ctx.organizationId,
                    status: { not: "Deleted" },
                },
                select: { sessionId: true },
            });
            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillCheckNotFound(skillCheckId),
                });
            }
            if (existing.sessionId) {
                const session = await SkillChecks.requireSessionById(
                    ctx,
                    SkillCheckSessionId.schema.parse(existing.sessionId),
                );
                SkillChecks.assertSessionUnlocked(session);

                // Guarded so a concurrent delete loses as NOT_FOUND rather than re-tombstoning.
                await ctx.prisma.skillCheck
                    .update({
                        where: {
                            id: skillCheckId,
                            organizationId: ctx.organizationId,
                            status: { not: "Deleted" },
                        },
                        data: { status: "Deleted" },
                    })
                    .catch(rethrowSkillCheckGone(skillCheckId));
            } else {
                await ctx.prisma.skillCheck.delete({
                    where: {
                        id: skillCheckId,
                        organizationId: ctx.organizationId,
                    },
                });
            }
        }),

    /**
     * Returns the competency matrix for the given scope. Personnel scope: teamId, personId, or
     * all active org personnel. Skill scope: skillId, skillGroupId, skillPackageId, or all active
     * subscribed skills. Skills, groups and packages are returned as flat sibling arrays in the
     * same shape as `skillPackageSubscriptions.listAssessableSkills`, with only the groups and packages that contain
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
                        result: SkillCheckResultValue.schema,
                        checkedAt: z.iso.datetime(),
                        // Null when the skill has no reassessment interval (frequency <= 0).
                        expiresAt: z.iso.datetime().nullable(),
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
                        status: { not: "Deleted" },
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
                // A frequency of 0 (or less) means the skill never needs reassessment, so a
                // passing check stays current forever and has no expiry date.
                const neverExpires = skill.frequency <= 0;
                let expiresAt: Date | null = null;
                if (!neverExpires) {
                    expiresAt = new Date(check.createdAt);
                    expiresAt.setMonth(expiresAt.getMonth() + skill.frequency);
                }
                return {
                    assesseeId: check.assesseeId as PersonId,
                    skillId: check.skillId as SkillId,
                    checkId: check.id as SkillCheckId,
                    result: check.result,
                    checkedAt: check.createdAt.toISOString(),
                    expiresAt: expiresAt ? expiresAt.toISOString() : null,
                    isCurrent: neverExpires || expiresAt! > now,
                };
            });

            return { personnel, skillPackages, skillGroups, skills, competencies };
        }),

    /**
     * Returns a single skill check by id, with the assessor's name resolved. Used by the
     * competency reports to populate the "check details" popover on demand.
     */
    getSkillCheck: organizationProcedure({ skillCheck: ["view"] })
        .input(z.object({ skillCheckId: SkillCheckId.schema }))
        .output(SkillCheck.schema.extend({ assessor: PersonRef.schema.nullable() }))
        .query(async ({ ctx, input }) => {
            const check = await ctx.prisma.skillCheck.findFirst({
                where: {
                    id: input.skillCheckId,
                    organizationId: ctx.organizationId,
                    status: { not: "Deleted" },
                },
                include: { assessor: { select: { id: true, name: true } } },
            });

            if (!check) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillCheckNotFound(input.skillCheckId),
                });
            }

            return {
                ...SkillCheck.fromRecord(check),
                assessor: check.assessor ? PersonRef.schema.parse(check.assessor) : null,
            };
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
                    assessor: PersonRef.schema.nullable(),
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
                    status: { not: "Deleted" },
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
                assessor: check.assessor ? PersonRef.schema.parse(check.assessor) : null,
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
                    status: { not: "Deleted" },
                },
            });

            return checks.map((check) => SkillCheck.fromRecord(check));
        }),

    /**
     * Updates a skill check's result and notes. The skill check must belong to the organization.
     *
     * `skillCheck` no longer has an `"update"` action at all — editing an existing check is a
     * row-ownership check below (`assessorId === current user`), not a permission gate. The gate
     * here is `["create"]`, the same broad "records checks" grant a `skills-assessor` already
     * holds; it's the ownership check that stops one assessor editing another's check.
     *
     * A check within a session also needs the session unlocked, and the caller still an assigned
     * assessor of it; the edit moves it to `Draft`, so a `Pending` or `Exclude` check in a
     * reopened session goes back for fresh review.
     * @throws TRPCError(NOT_FOUND) if the check does not exist or is `Deleted`.
     * @throws TRPCError(FORBIDDEN) if the caller did not record the check, or is no longer an
     * assigned assessor of its session.
     * @throws TRPCError(CONFLICT) if the check belongs to an approved session.
     */
    updateSkillCheck: organizationProcedure({ skillCheck: ["create"] })
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

            const existing = await ctx.prisma.skillCheck.findFirst({
                where: {
                    id: skillCheckId,
                    organizationId: ctx.organizationId,
                    status: { not: "Deleted" },
                },
                select: { assessorId: true, sessionId: true },
            });
            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillCheckNotFound(skillCheckId),
                });
            }

            const orgUser = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId: ctx.organizationId, userId: ctx.userId },
                select: { personId: true },
            });
            if (!orgUser?.personId || orgUser.personId !== existing.assessorId) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: Messages.notCheckAssessor(skillCheckId),
                });
            }

            if (existing.sessionId) {
                const { session } = await SkillChecks.requireSessionAssessor(
                    ctx,
                    SkillCheckSessionId.schema.parse(existing.sessionId),
                );
                SkillChecks.assertSessionUnlocked(session);
            }

            // Guarded so a delete landing after the pre-check isn't revived as `Draft` (with a
            // stale `createdAt`); the lost race surfaces as NOT_FOUND.
            const record = await ctx.prisma.skillCheck
                .update({
                    where: {
                        id: skillCheckId,
                        organizationId: ctx.organizationId,
                        status: { not: "Deleted" },
                    },
                    data: existing.sessionId ? { ...update, status: "Draft" } : update,
                })
                .catch(rethrowSkillCheckGone(skillCheckId));

            return SkillCheck.fromRecord(record);
        }),
});
