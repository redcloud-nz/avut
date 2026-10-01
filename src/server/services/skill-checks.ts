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
import { findConflicts, isCheckIncluded } from "@/lib/skill-check-conflicts";
import { isPrismaRecordNotFound } from "@/server/prisma-errors";

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
 * Check-then-write, so on its own it can't stop a write racing an approval: a write whose check
 * passed just before an approval committed would still land, and could overwrite the approval's
 * `Include`/`Exclude` stamp or leave an unreviewed check in an approved session. So every write to
 * a session's checks also opens its `$transaction` with `lockUnapprovedSession`, which serializes
 * it with `approveSession` and refuses it once the session is approved. The configuration writes
 * (`updateSession{Assessees,Assessors,Skills}`) rely on this check alone.
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
 * The statement that opens every `$transaction` writing a session's checks: a conditional update
 * of the session row (not approved), which takes that row's lock before any check is written.
 * `approveSession` writes the same row first, so the two can't interleave: one commits before the
 * other starts writing checks. If an approval commits first, this re-reads the session, matches no
 * row and throws P2025 (map it with `rethrowSessionLocked`), rolling the whole write back.
 *
 * `updatedAt` is the only field it touches, and bumping it matters too: `approveSession` is
 * conditional on the `updatedAt` its comparison read, so a check recorded, edited or deleted while
 * the Approve dialog is open makes that approval refuse. That's intended: the approver reviews the
 * change and approves again.
 */
export function lockUnapprovedSession(ctx: OrgServiceContext, sessionId: SkillCheckSessionId) {
    return ctx.prisma.skillCheckSession.update({
        where: { id: sessionId, organizationId: ctx.organizationId, status: { not: "Include" } },
        data: { updatedAt: new Date() },
    });
}

/**
 * A `.catch` handler for a `$transaction` opened by `lockUnapprovedSession`: its P2025 becomes
 * `sessionLockedError`. Only for a transaction none of whose other statements can throw P2025.
 */
export function rethrowSessionLocked(sessionId: SkillCheckSessionId) {
    return (error: unknown): never => {
        if (isPrismaRecordNotFound(error)) throw sessionLockedError(sessionId);
        throw error;
    };
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
 * Check an approval against the session's saved state, and count what it approves. The review
 * page saves each exclusion as it's made, so an approval takes the session as saved: every live
 * check that isn't `Exclude` is included. `includedCheckIds` is the approver's confirmation of that
 * set, as the page showed it. If a check was recorded, deleted, excluded or re-included since, the
 * two differ and the approval is refused, so what's approved is what the approver saw.
 *
 * This reads outside the approval's transaction, so it also returns what `approveSession` needs to
 * catch a change between here and its commit: the session's `updatedAt` (which any write to the
 * session row bumps: every check write, through `lockUnapprovedSession`, but also `updateSession`
 * and the `updateSession{Assessees,Assessors,Skills}` writes, so a name or notes edit trips it too)
 * and `checksAsOf`, the latest `recordedAt` among the session's checks, tombstones included (a
 * check recorded, re-recorded or deleted since has a later one; a tombstone left before this read
 * doesn't). Exclusions don't move `recordedAt`, but they bump the session's `updatedAt`. The
 * session is read before the checks, so a change landing between the two reads errs towards a
 * refusal.
 * @returns How many live checks the approval includes and excludes, the session's `updatedAt`,
 * and `checksAsOf`.
 * @throws NotFoundError if the session does not exist.
 * @throws ConflictError if `includedCheckIds` isn't exactly the session's live non-`Exclude` checks.
 * @throws ValidationError if more than one included check shares an assessee and skill, i.e. a
 * conflict is unresolved.
 */
export async function assertApprovalMatchesSavedState(
    ctx: OrgServiceContext,
    sessionId: SkillCheckSessionId,
    includedCheckIds: SkillCheckId[],
): Promise<{
    includedCount: number;
    excludedCount: number;
    sessionUpdatedAt: Date;
    checksAsOf: Date;
}> {
    const session = await ctx.prisma.skillCheckSession.findUnique({
        where: { id: sessionId, organizationId: ctx.organizationId },
        select: { updatedAt: true },
    });
    if (!session) throw new NotFoundError(`SkillCheckSession(id=${sessionId}) not found.`);

    // Tombstones too, but only for `checksAsOf`: the comparison is over the live checks.
    const rows = await ctx.prisma.skillCheck.findMany({
        where: { organizationId: ctx.organizationId, sessionId },
        select: { id: true, assesseeId: true, skillId: true, status: true, recordedAt: true },
    });
    const checks = rows.filter(({ status }) => status !== "Deleted");
    const included = checks.filter(isCheckIncluded);

    const confirmed = new Set<string>(includedCheckIds);
    if (confirmed.size !== included.length || included.some(({ id }) => !confirmed.has(id))) {
        throw staleChecksError();
    }

    const conflicts = findConflicts(included);
    if (conflicts.length > 0) {
        const [first] = conflicts;
        throw new ValidationError(
            `Approval includes more than one check for ${conflicts.length} assessee and skill ` +
                `pair(s) in SkillCheckSession(id=${sessionId}); e.g. Person(id=${first.assesseeId}) ` +
                `and Skill(id=${first.skillId}): checks ${first.checks.map(({ id }) => id).join(", ")}.`,
        );
    }

    const checksAsOf = new Date(Math.max(0, ...rows.map(({ recordedAt }) => recordedAt.getTime())));
    return {
        includedCount: included.length,
        excludedCount: checks.length - included.length,
        sessionUpdatedAt: session.updatedAt,
        checksAsOf,
    };
}

/**
 * The error for an approval made from a stale view of the session: a check was recorded, deleted,
 * excluded or re-included since the approver's page loaded them, or the session row itself was
 * written (any write bumps its `updatedAt`, including a name or notes edit). Worded neutrally
 * because the approval can't tell which.
 */
export function staleChecksError(): ConflictError {
    return new ConflictError(
        `The session changed since you opened this. Review it and approve again.`,
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
 * The transaction opens with `lockUnapprovedSession`, so an approval and these writes can't
 * interleave, and a call that finds the session approved by then changes nothing and throws
 * `ConflictError`. Only the session's `updatedAt` changes besides the checks.
 * @throws NotFoundError if the session does not exist.
 * @throws ConflictError if the session is approved, up front or by the time the writes run, or if
 * an id isn't a live (non-`Deleted`) check in the session (a stale view: most likely it was deleted
 * since the page loaded it).
 * @throws ValidationError if an id appears more than once.
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
        // Most likely deleted since the page loaded it: a stale view, so a conflict, which has
        // the client refetch the session's checks.
        throw new ConflictError(
            `SkillCheck(id=${missing.join(", ")}) is not a live check in SkillCheckSession(id=${sessionId}). Review the session's checks and try again.`,
        );
    }

    const excludeIds = changes.filter((c) => c.excluded).map((c) => c.skillCheckId);
    const includeIds = changes.filter((c) => !c.excluded).map((c) => c.skillCheckId);
    const inSession = { organizationId: ctx.organizationId, sessionId };

    await ctx.prisma
        .$transaction([
            lockUnapprovedSession(ctx, sessionId),
            ctx.prisma.skillCheck.updateMany({
                where: {
                    ...inSession,
                    id: { in: excludeIds },
                    status: { in: ["Draft", "Pending"] },
                },
                data: { status: "Exclude" },
            }),
            ctx.prisma.skillCheck.updateMany({
                where: { ...inSession, id: { in: includeIds }, status: "Exclude" },
                data: { status: "Draft" },
            }),
        ])
        .catch(rethrowSessionLocked(sessionId));
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
