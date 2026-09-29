/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { hasAnyRoleWithPermissions, parseStoredRoles } from "@/lib/permissions";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSession, type SkillCheckSessionId } from "@/lib/schemas/skill-check-session";

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
 * The messages are local literals worded like `Messages.noLinkedPersonRecord` /
 * `Messages.notSessionAssessor` (`src/trpc/messages.ts`) — a domain service can't depend on
 * `src/trpc/`. Keep them in sync by hand.
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
