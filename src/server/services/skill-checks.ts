/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { hasAnyRoleWithPermissions, parseStoredRoles } from "@/lib/permissions";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import type { SkillCheckId } from "@/lib/schemas/skill-check";
import { SkillCheckSession, type SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { findConflicts } from "@/lib/skill-check-conflicts";

import type { OrgServiceContext } from "./service-context";

/**
 * Fetch a skill check session by ID and ensure it belongs to the organization.
 * @throws NotFoundError if the session does not exist or does not belong to the organization.
 */
export async function requireSessionById(
    ctx: OrgServiceContext,
    sessionId: SkillCheckSessionId,
): Promise<SkillCheckSession> {
    const session = await ctx.prisma.skillCheckSession.findUnique({
        where: {
            id: sessionId,
            organizationId: ctx.organizationId,
        },
    });

    if (!session) {
        throw new NotFoundError(`SkillCheckSession(id=${sessionId}) not found.`);
    }

    return SkillCheckSession.fromRecord(session);
}

/**
 * The single lock rule for a skill check session: an approved session (`status === "Include"`)
 * accepts no writes to its checks or its configuration (assessees, skills, assessors) until it is
 * reopened. Every procedure that writes either calls this after loading the session. Its name,
 * date and notes stay editable, and it can still be deleted.
 *
 * Check-then-write, not transactional: a write racing an approval can still land a `Draft` check
 * in an approved session. For recording that's accepted — only `Include` checks count, and the
 * stray check shows up for review on the next reopen. A write that changes a check's status can't
 * lean on that, since it could overwrite an approval's `Include`/`Exclude` stamp; such a write
 * (`updateCheckExclusions`) also guards its own `where` on the session not being approved.
 * @throws ConflictError if the session is approved.
 */
export function assertSessionUnlocked(session: Pick<SkillCheckSession, "id" | "status">): void {
    if (session.status === "Include") throw sessionLockedError(session.id);
}

/**
 * The error `assertSessionUnlocked` throws, for a write that finds the session approved some
 * other way (e.g. a conditional update that lost a race with an approval).
 */
export function sessionLockedError(sessionId: SkillCheckSessionId): ConflictError {
    return new ConflictError(
        `SkillCheckSession(id=${sessionId}) is approved. Reopen it to make changes.`,
    );
}

/**
 * A skill check session together with the ids of its assessees and skills, as loaded by
 * `requireSessionAssessor` — enough to validate a single check's target without another query.
 */
export type SessionWithMembers = SkillCheckSession & {
    assesseeIds: PersonId[];
    skillIds: SkillId[];
};

/**
 * Fetch a skill check session and resolve the caller as one of its assigned assessors — the
 * precondition for recording or clearing checks within it. The assessor is always the caller's
 * linked person, derived here rather than accepted from the client.
 * @throws NotFoundError if the session does not exist or does not belong to the organization.
 * @throws ValidationError if the caller has no linked person record in the organization.
 * @throws ForbiddenError if the caller's person is not an assigned assessor for the session.
 *
 * The no-linked-person message is a local literal worded like `Messages.noLinkedPersonRecord`
 * (`src/trpc/messages.ts`) — a domain service can't depend on `src/trpc/`. Keep them in sync by
 * hand.
 */
export async function requireSessionAssessor(
    ctx: OrgServiceContext,
    sessionId: SkillCheckSessionId,
): Promise<{ session: SessionWithMembers; assessorId: PersonId }> {
    const session = await ctx.prisma.skillCheckSession.findUnique({
        where: {
            id: sessionId,
            organizationId: ctx.organizationId,
        },
        include: {
            assessors: { select: { id: true } },
            assessees: { select: { id: true } },
            skills: { select: { id: true } },
        },
    });
    if (!session) {
        throw new NotFoundError(`SkillCheckSession(id=${sessionId}) not found.`);
    }

    const orgUser = await ctx.prisma.organizationUser.findFirst({
        where: { organizationId: ctx.organizationId, userId: ctx.userId },
        select: { personId: true },
    });
    if (!orgUser?.personId) {
        throw new ValidationError(`You must have a linked person record to perform this action.`);
    }
    const assessorId = PersonId.schema.parse(orgUser.personId);

    if (!session.assessors.some((assessor) => assessor.id === assessorId)) {
        throw new ForbiddenError(
            `You are not an assigned assessor for SkillCheckSession(id=${sessionId}).`,
        );
    }

    return {
        session: {
            ...SkillCheckSession.fromRecord(session),
            assesseeIds: session.assessees.map(({ id }) => PersonId.schema.parse(id)),
            skillIds: session.skills.map(({ id }) => SkillId.schema.parse(id)),
        },
        assessorId,
    };
}

/**
 * Ensure a single check's target — an assessee and a skill — is part of the session, so a late
 * write after the session's configuration changed fails loudly rather than orphaning a check.
 * @throws ValidationError if the assessee is not one of the session's assessees, or the skill is
 * not one of its skills.
 */
export function assertSessionCheckTarget(
    session: SessionWithMembers,
    target: { assesseeId: PersonId; skillId: SkillId },
): void {
    if (!session.assesseeIds.includes(target.assesseeId)) {
        throw new ValidationError(
            `Person(id=${target.assesseeId}) is not an assessee of SkillCheckSession(id=${session.id}).`,
        );
    }
    if (!session.skillIds.includes(target.skillId)) {
        throw new ValidationError(
            `Skill(id=${target.skillId}) is not a skill of SkillCheckSession(id=${session.id}).`,
        );
    }
}

/**
 * Ensure an approval includes at most one check per assessee and skill. Only the session's live
 * checks among `includedCheckIds` count: ids from another session, and `Deleted` checks, are
 * ignored, just as approval's stamping ignores them.
 * @throws ValidationError if more than one included check shares an assessee and skill.
 */
export async function assertOneIncludedCheckPerPair(
    ctx: OrgServiceContext,
    sessionId: SkillCheckSessionId,
    includedCheckIds: SkillCheckId[],
): Promise<void> {
    if (includedCheckIds.length < 2) return;

    const checks = await ctx.prisma.skillCheck.findMany({
        where: {
            organizationId: ctx.organizationId,
            sessionId,
            id: { in: includedCheckIds },
            status: { not: "Deleted" },
        },
        select: { id: true, assesseeId: true, skillId: true, status: true },
    });

    const conflicts = findConflicts(checks);
    if (conflicts.length === 0) return;

    const [first] = conflicts;
    throw new ValidationError(
        `Approval includes more than one check for ${conflicts.length} assessee and skill ` +
            `pair(s) in SkillCheckSession(id=${sessionId}); e.g. Person(id=${first.assesseeId}) ` +
            `and Skill(id=${first.skillId}): checks ${first.checks.map(({ id }) => id).join(", ")}.`,
    );
}

/** One check's exclusion decision, as `updateCheckExclusions` takes it. */
export interface CheckExclusionChange {
    skillCheckId: SkillCheckId;
    excluded: boolean;
}

/**
 * Save the review page's exclusion decisions for an unapproved session's checks. `excluded: true`
 * sets a `Draft` or `Pending` check to `Exclude`; `excluded: false` sets an `Exclude` check back to
 * `Draft`. Any other status is left alone, so re-including a `Pending` check doesn't touch it.
 *
 * Both writes also require, in their `where`, that the session isn't approved, so a write racing
 * an approval can't overwrite its stamps (see `assertSessionUnlocked`). A write that loses that
 * race matches no rows and changes nothing.
 * @throws NotFoundError if the session does not exist.
 * @throws ConflictError if the session is approved.
 * @throws ValidationError if an id appears more than once, or isn't a live (non-`Deleted`) check in
 * the session.
 */
export async function updateCheckExclusions(
    ctx: OrgServiceContext,
    sessionId: SkillCheckSessionId,
    changes: CheckExclusionChange[],
): Promise<void> {
    const session = await requireSessionById(ctx, sessionId);
    assertSessionUnlocked(session);

    const ids = changes.map(({ skillCheckId }) => skillCheckId);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
        throw new ValidationError(`A skill check appears more than once in the changes.`);
    }
    if (ids.length === 0) return;

    const found = await ctx.prisma.skillCheck.findMany({
        where: {
            organizationId: ctx.organizationId,
            sessionId,
            id: { in: ids },
            status: { not: "Deleted" },
        },
        select: { id: true },
    });
    if (found.length !== uniqueIds.size) {
        const foundIds = new Set(found.map(({ id }) => id));
        const missing = ids.filter((id) => !foundIds.has(id));
        throw new ValidationError(
            `SkillCheck(id=${missing.join(", ")}) is not a live check in SkillCheckSession(id=${sessionId}).`,
        );
    }

    const excludeIds = changes.filter((c) => c.excluded).map((c) => c.skillCheckId);
    const includeIds = changes.filter((c) => !c.excluded).map((c) => c.skillCheckId);
    const unapprovedSession = {
        organizationId: ctx.organizationId,
        sessionId,
        session: { status: { not: "Include" } },
    } satisfies Prisma.SkillCheckWhereInput;

    await ctx.prisma.$transaction([
        ctx.prisma.skillCheck.updateMany({
            where: {
                ...unapprovedSession,
                id: { in: excludeIds },
                status: { in: ["Draft", "Pending"] },
            },
            data: { status: "Exclude" },
        }),
        ctx.prisma.skillCheck.updateMany({
            where: { ...unapprovedSession, id: { in: includeIds }, status: "Exclude" },
            data: { status: "Draft" },
        }),
    ]);
}

/**
 * List the personnel who may be added as a session's assessors: `Active` people in the
 * organization whose linked `OrganizationUser` holds a role authorizing `skillCheck: ["create"]`,
 * i.e. who could actually record checks. Evaluated against the role definitions rather than a
 * hard-coded role name.
 * @returns The eligible people, sorted by name.
 */
export async function listEligibleAssessors(ctx: OrgServiceContext): Promise<PersonRef[]> {
    const personnel = await ctx.prisma.person.findMany({
        where: {
            organizationId: ctx.organizationId,
            status: "Active",
            organizationUser: { isNot: null },
        },
        select: {
            id: true,
            name: true,
            organizationUser: { select: { role: true } },
        },
    });

    return personnel
        .filter(
            ({ organizationUser }) =>
                organizationUser != null &&
                hasAnyRoleWithPermissions(parseStoredRoles(organizationUser.role), {
                    skillCheck: ["create"],
                }),
        )
        .map(({ id, name }) => PersonRef.schema.parse({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Determine the next available session number for the organization, i.e. one greater than the
 * highest `sessionNumber` currently in use (or 1 if the organization has no sessions yet).
 */
export async function nextSessionNumber(ctx: OrgServiceContext): Promise<number> {
    const { _max } = await ctx.prisma.skillCheckSession.aggregate({
        where: { organizationId: ctx.organizationId },
        _max: { sessionNumber: true },
    });
    return (_max.sessionNumber ?? 0) + 1;
}

const MAX_SESSION_NUMBER_ATTEMPTS = 5;

/**
 * Create a skill check session, assigning it the next available `sessionNumber` for the
 * organization. Two concurrent creates can race for the same number; if the unique constraint on
 * `[organizationId, sessionNumber]` is violated, retries with the next number instead.
 * @param buildData Builds the full create payload given the session number assigned to it.
 * @returns The created session, including its assessors.
 */
export async function createSession(
    ctx: OrgServiceContext,
    buildData: (sessionNumber: number) => Prisma.SkillCheckSessionUncheckedCreateInput,
): Promise<
    Prisma.SkillCheckSessionGetPayload<{
        include: { assessors: { select: { id: true; name: true } } };
    }>
> {
    let sessionNumber = await nextSessionNumber(ctx);

    for (let attempt = 1; attempt <= MAX_SESSION_NUMBER_ATTEMPTS; attempt++) {
        try {
            return await ctx.prisma.skillCheckSession.create({
                data: buildData(sessionNumber),
                include: {
                    assessors: {
                        select: { id: true, name: true },
                    },
                },
            });
        } catch (error) {
            const isConflict =
                error instanceof Object &&
                "code" in error &&
                error.code === "P2002" &&
                attempt < MAX_SESSION_NUMBER_ATTEMPTS;
            if (!isConflict) throw error;
            sessionNumber++;
        }
    }
    throw new Error("unreachable");
}
