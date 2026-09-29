/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { hasAnyRoleWithPermissions, parseStoredRoles } from "@/lib/permissions";
import { PersonRef } from "@/lib/schemas/person";
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
