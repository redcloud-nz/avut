/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { ConflictError, ValidationError } from "@/lib/errors";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { SkillCheck, SkillCheckId, SkillCheckResultValue } from "@/lib/schemas/skill-check";
import { SkillCheckSession, SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { isPrismaRecordNotFound } from "@/server/prisma-errors";
import * as SkillChecks from "@/server/services/skill-checks";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

export const skillCheckSessionsRouter = createTrpcRouter({
    /**
     * Approves a session as saved: every live check that isn't `Exclude` is included, the rest
     * excluded. `includedCheckIds` confirms that set as the review page showed it, and must match
     * it exactly (`SkillChecks.assertApprovalMatchesSavedState`). In one transaction: purges the
     * session's `Deleted` tombstones, stamps `includedCheckIds` Include and every other check
     * Exclude (by id rather than by status), and moves the session to Include status. No `Pending`
     * or `Deleted` check survives an approval. The log entry records how many checks were included
     * and excluded.
     *
     * The comparison reads outside the transaction, so the transaction re-checks it: it fails if
     * the session's `updatedAt` moved (any write to the session row: an exclusion saved, but also
     * `updateSession` or an `updateSession{Assessees,Assessors,Skills}` write, so a name or notes
     * edit trips it too) or a check was recorded or
     * re-recorded since (a `Draft` check the stamps skipped remains). A write committing after the
     * transaction's last check is the stray `Draft` `assertSessionUnlocked` accepts.
     * @throws TRPCError(NOT_FOUND) if the session does not exist.
     * @throws TRPCError(CONFLICT) if the session is already approved (reopen it first), or if
     * `includedCheckIds` isn't the session's saved set of included checks, up front or by the
     * time the transaction runs.
     * @throws TRPCError(BAD_REQUEST) if more than one included check shares an assessee and
     * skill, i.e. a conflict is unresolved.
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

            const session = await SkillChecks.requireSessionById(ctx, sessionId);
            SkillChecks.assertSessionUnlocked(session);
            const { includedCount, excludedCount, sessionUpdatedAt, checksAsOf } =
                await SkillChecks.assertApprovalMatchesSavedState(ctx, sessionId, includedCheckIds);

            // Every live check was either confirmed or left out, so once the stamps below have
            // run, a check still `Draft` or `Pending` is one the stamps skipped for changing after
            // the comparison.
            const unchangedSince = { updatedAt: { lte: checksAsOf } };

            await ctx.prisma
                .$transaction([
                    // Conditional on not already being approved, so two concurrent approvals can't
                    // both commit and double-log: the loser's update matches no row, throws P2025
                    // and rolls its transaction back. Also conditional on the session's
                    // `updatedAt` as the comparison read it: any write to the session row bumps it
                    // (`updateCheckExclusions` writes this row first, and `updateSession` and its
                    // assessee/assessor/skill writes touch it too), so any of those since turns
                    // this into P2025 too.
                    ctx.prisma.skillCheckSession.update({
                        where: {
                            id: sessionId,
                            organizationId: ctx.organizationId,
                            status: { not: "Include" },
                            updatedAt: sessionUpdatedAt,
                        },
                        data: { status: "Include" },
                    }),
                    // Purge before stamping, so the Exclude stamp can't turn a tombstone back
                    // into a check.
                    ctx.prisma.skillCheck.deleteMany({
                        where: { organizationId: ctx.organizationId, sessionId, status: "Deleted" },
                    }),
                    // Both stamps skip a check recorded or re-recorded since the comparison (a
                    // later `updatedAt`), leaving it `Draft` for the guard below.
                    ctx.prisma.skillCheck.updateMany({
                        where: {
                            organizationId: ctx.organizationId,
                            sessionId,
                            id: { in: includedCheckIds },
                            ...unchangedSince,
                        },
                        data: { status: "Include" },
                    }),
                    ctx.prisma.skillCheck.updateMany({
                        where: {
                            organizationId: ctx.organizationId,
                            sessionId,
                            NOT: { id: { in: includedCheckIds } },
                            ...unchangedSince,
                        },
                        data: { status: "Exclude" },
                    }),
                    // The guard: a check the stamps skipped fails the approval (P2025, rolled
                    // back) rather than sitting unconfirmed in an approved session. A write that
                    // commits after this point is the accepted stray `Draft` of
                    // `assertSessionUnlocked`.
                    ctx.prisma.skillCheckSession.update({
                        where: {
                            id: sessionId,
                            organizationId: ctx.organizationId,
                            skillChecks: { none: { status: { in: ["Draft", "Pending"] } } },
                        },
                        data: { status: "Include" },
                    }),
                    ctx.logEvent({
                        action: "Approve",
                        objectType: "SkillCheckSession",
                        objectId: sessionId,
                        description: `Approved session "${session.name}": ${includedCount} included, ${excludedCount} excluded.`,
                    }),
                ])
                .catch(async (error: unknown) => {
                    if (!isPrismaRecordNotFound(error)) throw error;
                    // Either someone else approved first, or the session or its checks changed
                    // since the comparison; the transaction rolled back, so the session's status tells.
                    const current = await SkillChecks.requireSessionById(ctx, sessionId);
                    throw current.status === "Include"
                        ? SkillChecks.sessionLockedError(sessionId)
                        : SkillChecks.staleChecksError();
                });

            return {
                updated: { ...session, status: "Include", updatedAt: new Date().toISOString() },
            };
        }),

    /**
     * Create a new skill check session for the organization. The caller is assigned as the
     * session's sole assessor, so they must have a linked person record.
     * @param name The name of the session.
     * @param startsAt Optional start datetime for the session.
     * @param endsAt Optional end datetime for the session.
     * @param notes Optional notes for the session.
     * @returns The created skill check session, in `Draft` status.
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
                status: "Draft",
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
     * Delete a skill check session. Requires the "delete" action on "skillCheckSession". Its
     * `Deleted` tombstones are purged with it; `SkillCheck.sessionId` is `onDelete: SetNull`, so
     * they would otherwise survive as standalone `Deleted` rows nothing ever purges. Its other
     * checks are kept and detached: `Draft` ones, and a reopened session's `Pending` ones, survive
     * as standalone rows in that status. That's harmless — only `Include` checks count.
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
                ctx.prisma.skillCheck.deleteMany({
                    where: { organizationId, sessionId: skillCheckSessionId, status: "Deleted" },
                }),
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
     * Delete the caller's own check for an assessee and skill within a session. The check is
     * tombstoned (`status: "Deleted"`), not removed, so it stays on its unique key for a later
     * re-record to revive; `approveSession` and `deleteSession` purge tombstones. The assessor is
     * the caller's linked person, derived server-side; another assessor's check on the same
     * assessee and skill is left alone.
     * @returns `deleted: true` if a live check was deleted, `false` if there was none.
     * @throws TRPCError(NOT_FOUND) if the session does not exist.
     * @throws TRPCError(BAD_REQUEST) if the caller has no linked person, or the assessee or skill
     * is not part of the session.
     * @throws TRPCError(FORBIDDEN) if the caller is not an assigned assessor for the session.
     * @throws TRPCError(CONFLICT) if the session is approved.
     */
    // Same gate as `setSessionSkillCheck` (see there). `skills-assessor` holds no
    // `skillCheck: ["delete"]`, which is why clearing a check doesn't go through `deleteSkillCheck`.
    deleteSessionSkillCheck: organizationProcedure({
        skillCheckSession: ["update"],
        skillCheck: ["create"],
    })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                assesseeId: PersonId.schema,
                skillId: SkillId.schema,
            }),
        )
        .output(z.object({ deleted: z.boolean() }))
        .mutation(async ({ ctx, input: { skillCheckSessionId, assesseeId, skillId } }) => {
            const { session, assessorId } = await SkillChecks.requireSessionAssessor(
                ctx,
                skillCheckSessionId,
            );
            SkillChecks.assertSessionUnlocked(session);
            SkillChecks.assertSessionCheckTarget(session, { assesseeId, skillId });

            const { count } = await ctx.prisma.skillCheck.updateMany({
                where: {
                    organizationId: ctx.organizationId,
                    sessionId: skillCheckSessionId,
                    assesseeId,
                    skillId,
                    assessorId,
                    status: { not: "Deleted" },
                },
                data: { status: "Deleted" },
            });

            return { deleted: count > 0 };
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
                        },
                    },
                },
            });

            if (!session)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.skillCheckSessionNotFound(skillCheckSessionId),
                });

            // Counted separately rather than through `_count`, so the `Deleted` filter is
            // testable (prisma-mock ignores a `where` inside `_count.select`).
            const checkCount = await ctx.prisma.skillCheck.count({
                where: { sessionId: skillCheckSessionId, status: { not: "Deleted" } },
            });

            return {
                assesseeCount: session._count.assessees,
                skillCount: session._count.skills,
                checkCount,
            };
        }),

    /**
     * List the personnel who may be added as a session's assessors: active people linked to a
     * user whose role can record skill checks. Gated on session view (not `member: ["view"]`) so
     * that roles like `skills-assessor`, which lack member access, still see the candidates.
     * @returns The eligible people, sorted by name.
     */
    listEligibleAssessors: organizationProcedure({ skillCheckSession: ["view"] })
        .output(z.array(PersonRef.schema))
        .query(async ({ ctx }) => SkillChecks.listEligibleAssessors(ctx)),

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
                        status: { not: "Deleted" },
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
                        status: { not: "Deleted" },
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
                        status: { not: "Deleted" },
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
     * Reopens an approved session so its checks can be changed. In one transaction: moves the
     * session back to `Draft`, moves its `Include` checks to `Pending` (so re-approval can start
     * from the previous selection), and logs a `Reopen`. `Exclude` checks stay `Exclude`. The
     * session's results leave the competency reports until it's approved again.
     * @throws TRPCError(NOT_FOUND) if the session does not exist.
     * @throws TRPCError(CONFLICT) if the session is not approved.
     */
    reopenSession: organizationProcedure({ skillCheckSession: ["approve"] })
        .input(z.object({ skillCheckSessionId: SkillCheckSessionId.schema }))
        .output(z.object({ updated: SkillCheckSession.schema }))
        .mutation(async ({ ctx, input: { skillCheckSessionId } }) => {
            const notApproved = () =>
                new ConflictError(
                    `SkillCheckSession(id=${skillCheckSessionId}) is not approved, so it can't be reopened.`,
                );

            const session = await SkillChecks.requireSessionById(ctx, skillCheckSessionId);
            if (session.status !== "Include") throw notApproved();

            const [updated] = await ctx.prisma
                .$transaction([
                    // Conditional on still being approved, so two concurrent reopens (or a reopen
                    // racing an approve) can't both commit and double-log: the loser's update
                    // matches no row, throws P2025 and rolls its transaction back.
                    ctx.prisma.skillCheckSession.update({
                        where: {
                            id: skillCheckSessionId,
                            organizationId: ctx.organizationId,
                            status: "Include",
                        },
                        data: { status: "Draft" },
                    }),
                    ctx.prisma.skillCheck.updateMany({
                        where: {
                            organizationId: ctx.organizationId,
                            sessionId: skillCheckSessionId,
                            status: "Include",
                        },
                        data: { status: "Pending" },
                    }),
                    ctx.logEvent({
                        action: "Reopen",
                        objectType: "SkillCheckSession",
                        objectId: skillCheckSessionId,
                        description: `Reopened session "${session.name}".`,
                    }),
                ])
                .catch((error: unknown) => {
                    if (isPrismaRecordNotFound(error)) {
                        throw notApproved();
                    }
                    throw error;
                });

            return { updated: SkillCheckSession.fromRecord(updated) };
        }),

    /**
     * Record the caller's check for an assessee and skill within a session: creates it, or
     * updates the result and notes of the caller's existing check on that key. The assessor is
     * the caller's linked person, derived server-side. Either way the check ends up `Draft`: an
     * update sends a `Pending` or `Exclude` check in a reopened session back for fresh review.
     * Re-recording over a `Deleted` tombstone revives that row and resets its `createdAt` (it's a
     * fresh assessment); updating a live check keeps its `createdAt`.
     * @returns The created or updated skill check.
     * @throws TRPCError(NOT_FOUND) if the session does not exist.
     * @throws TRPCError(BAD_REQUEST) if the caller has no linked person, or the assessee or skill
     * is not part of the session.
     * @throws TRPCError(FORBIDDEN) if the caller is not an assigned assessor for the session.
     * @throws TRPCError(CONFLICT) if the session is approved.
     */
    // Recording a check within a session the caller assesses needs both halves: a session update
    // and `skillCheck: ["create"]` (the "records checks" grant). `skillCheck` has no `"update"`
    // action, and the write is scoped to the caller's own `assessorId`. The `skillCheck` half
    // keeps `skills-admin` — which holds session update, and so could add itself as an assessor —
    // from recording checks.
    //
    // No `ctx.logEvent` (here or in `deleteSessionSkillCheck`): no skill check write is logged yet,
    // and `SkillCheck` isn't a `LogObjectType`. Tracked in #46.
    setSessionSkillCheck: organizationProcedure({
        skillCheckSession: ["update"],
        skillCheck: ["create"],
    })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                assesseeId: PersonId.schema,
                skillId: SkillId.schema,
                result: SkillCheckResultValue.schema,
                notes: z.string(),
            }),
        )
        .output(SkillCheck.schema)
        .mutation(async ({ ctx, input }) => {
            const { skillCheckSessionId, assesseeId, skillId, result, notes } = input;
            const { session, assessorId } = await SkillChecks.requireSessionAssessor(
                ctx,
                skillCheckSessionId,
            );
            SkillChecks.assertSessionUnlocked(session);
            SkillChecks.assertSessionCheckTarget(session, { assesseeId, skillId });

            const key = {
                assesseeId,
                assessorId,
                sessionId: skillCheckSessionId,
                skillId,
            };
            const [, check] = await ctx.prisma.$transaction([
                // Only a tombstone gets a fresh `createdAt`; a live check keeps its "checked at".
                ctx.prisma.skillCheck.updateMany({
                    where: { ...key, organizationId: ctx.organizationId, status: "Deleted" },
                    data: { createdAt: new Date() },
                }),
                // Upsert on the unique key, so a double tap can't race two creates.
                ctx.prisma.skillCheck.upsert({
                    where: { assesseeId_assessorId_sessionId_skillId: key },
                    update: { result, notes, status: "Draft" },
                    create: {
                        id: SkillCheckId.create(),
                        organizationId: ctx.organizationId,
                        sessionId: skillCheckSessionId,
                        assesseeId,
                        assessorId,
                        skillId,
                        result,
                        notes,
                    },
                }),
            ]);

            return SkillCheck.fromRecord(check);
        }),

    /**
     * Save the review page's include/exclude decisions for an unapproved session's checks:
     * `excluded: true` sets a `Draft` or `Pending` check to `Exclude`, `excluded: false` sets an
     * `Exclude` check back to `Draft`. Other statuses are left alone. `approveSession` then
     * approves the saved state.
     * @throws TRPCError(NOT_FOUND) if the session does not exist.
     * @throws TRPCError(CONFLICT) if the session is approved, or a `skillCheckId` isn't a live
     * check in the session (a stale view, most likely a check deleted since the page loaded).
     * @throws TRPCError(BAD_REQUEST) if a `skillCheckId` is repeated.
     */
    // No `ctx.logEvent`, deliberately, as an exception to the rule that state changes are logged:
    // the review page saves each tick as it's made, and logging every one would flood the log.
    // `approveSession`'s entry records the outcome (how many checks were included and excluded).
    updateCheckExclusions: organizationProcedure({ skillCheckSession: ["approve"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema,
                changes: z
                    .array(z.object({ skillCheckId: SkillCheckId.schema, excluded: z.boolean() }))
                    .max(1000),
            }),
        )
        .output(z.void())
        .mutation(async ({ ctx, input: { sessionId, changes } }) => {
            await SkillChecks.updateCheckExclusions(ctx, sessionId, changes);
        }),

    /**
     * Update a skill check session's name, date and notes. Not subject to the approval lock.
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
                        startsAt: new Date(update.date),
                        endsAt: new Date(update.date),
                        notes: update.notes,
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
     * @throws TRPCError(CONFLICT) if the session is approved.
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
                const session = await SkillChecks.requireSessionById(ctx, skillCheckSessionId);
                SkillChecks.assertSessionUnlocked(session);

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
     * Add and remove the personnel assigned to a skill check session as assessors.
     * Every added person must be an eligible assessor (see `listEligibleAssessors`); removal is
     * never validated, so an assessor who has since lost the ability to record can still be
     * taken off.
     * @param skillCheckSessionId The ID of the skill check session to update assessors for.
     * @param addedPersonIds The people to add as assessors.
     * @param removedPersonIds The people to remove as assessors.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     * @throws TRPCError(BAD_REQUEST) if any added person is not an eligible assessor.
     * @throws TRPCError(CONFLICT) if the session is approved.
     */
    updateSessionAssessors: organizationProcedure({ skillCheckSession: ["update"] })
        .input(
            z.object({
                skillCheckSessionId: SkillCheckSessionId.schema,
                addedPersonIds: z.array(PersonId.schema),
                removedPersonIds: z.array(PersonId.schema),
            }),
        )
        .output(
            z.object({
                updatedAssessors: z.array(PersonRef.schema),
                updatedSession: SkillCheckSession.schema,
            }),
        )
        .mutation(
            async ({ ctx, input: { skillCheckSessionId, addedPersonIds, removedPersonIds } }) => {
                const session = await SkillChecks.requireSessionById(ctx, skillCheckSessionId);
                SkillChecks.assertSessionUnlocked(session);

                if (addedPersonIds.length > 0) {
                    const eligibleIds = new Set(
                        (await SkillChecks.listEligibleAssessors(ctx)).map((person) => person.id),
                    );
                    const ineligibleIds = addedPersonIds.filter((id) => !eligibleIds.has(id));
                    if (ineligibleIds.length > 0) {
                        throw new ValidationError(Messages.ineligibleAssessors(ineligibleIds));
                    }
                }

                const changes = [
                    ...addedPersonIds.map((id) => ({
                        path: ["assessors"],
                        type: "arr_add" as const,
                        value: id,
                    })),
                    ...removedPersonIds.map((id) => ({
                        path: ["assessors"],
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
                            assessors: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                        data: {
                            assessors: {
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
                    updatedAssessors: updated.assessors
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((person) => PersonRef.schema.parse(person)),
                    updatedSession: SkillCheckSession.fromRecord(updated),
                };
            },
        ),

    /**
     * Update the skills assigned to a skill check session. This will replace the current list of skills with the provided list.
     * @param skillCheckSessionId The ID of the skill check session to update skills for.
     * @param skillIds An array of skill IDs to assign to the skill check session.
     * @throws TRPCError(NOT_FOUND) if the skill check session does not exist.
     * @throws TRPCError(CONFLICT) if the session is approved.
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
                const session = await SkillChecks.requireSessionById(ctx, skillCheckSessionId);
                SkillChecks.assertSessionUnlocked(session);

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
});

function sessionNotFound(sessionId: SkillCheckSessionId): never {
    throw new TRPCError({
        code: "NOT_FOUND",
        message: Messages.skillCheckSessionNotFound(sessionId),
    });
}
