/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { ConflictError, NotFoundError } from "@/lib/errors";
import type { TeamId } from "@/lib/schemas/team";
import {
    TeamUserData,
    TeamUserId,
    type GrantableUserData,
    type TeamScopeGrantData,
    type UserTeamData,
} from "@/lib/schemas/team-user";
import type { UserId } from "@/lib/schemas/user";
import type { LogEntryRef } from "@/server/log-entry";
import { isUniqueViolation } from "@/server/prisma-errors";

import type { OrgServiceContext, UserServiceContext } from "./service-context";

// Access grants (`TeamUser`) never `include` through the composite `organizationUser` relation:
// prisma-mock resolves relations by the first FK field only, so in tests it would match the
// wrong member. User details come through the direct `user` relation, and the member row from an
// explicit `organizationUser.findUnique({ where: { organizationId_userId } })`.

/**
 * The organization's members who can be granted access to a team: those whose account isn't
 * soft-deleted and who have no grant on it yet, ordered by name.
 * @throws NotFoundError if the team isn't in the organization.
 */
export async function listGrantableUsers(
    ctx: OrgServiceContext,
    teamId: TeamId,
): Promise<GrantableUserData[]> {
    const team = await ctx.prisma.team.findUnique({
        where: { id: teamId, organizationId: ctx.organizationId },
        select: { id: true },
    });
    if (!team) throw new NotFoundError(`Team(id=${teamId}) not found.`);

    const [members, grants] = await Promise.all([
        ctx.prisma.organizationUser.findMany({
            where: { organizationId: ctx.organizationId, user: { status: { not: "Deleted" } } },
            select: { user: { select: { id: true, name: true, email: true } } },
        }),
        ctx.prisma.teamUser.findMany({ where: { teamId }, select: { userId: true } }),
    ]);
    const grantedUserIds = new Set(grants.map((grant) => grant.userId));

    return members
        .filter((member) => !grantedUserIds.has(member.user.id))
        .map((member) => TeamUserData.grantableUserSchema.parse(member.user))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The users granted access to a team, leaving out soft-deleted users, ordered by name. `onRoster`
 * is true when the user's linked person has an Active membership of the team.
 * @throws NotFoundError if the team isn't in the organization.
 */
export async function listForTeam(ctx: OrgServiceContext, teamId: TeamId): Promise<TeamUserData[]> {
    const team = await ctx.prisma.team.findUnique({
        where: { id: teamId, organizationId: ctx.organizationId },
        select: { id: true },
    });
    if (!team) throw new NotFoundError(`Team(id=${teamId}) not found.`);

    const grants = await ctx.prisma.teamUser.findMany({
        where: {
            teamId,
            organizationId: ctx.organizationId,
            user: { status: { not: "Deleted" } },
        },
        select: {
            id: true,
            teamId: true,
            userId: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true, image: true } },
        },
    });
    if (grants.length === 0) return [];

    const members = await ctx.prisma.organizationUser.findMany({
        where: {
            organizationId: ctx.organizationId,
            userId: { in: grants.map((grant) => grant.userId) },
            personId: { not: null },
        },
        select: { userId: true, personId: true },
    });
    const personIdByUserId = new Map(members.map((member) => [member.userId, member.personId!]));

    const rosterMemberships = await ctx.prisma.teamMembership.findMany({
        where: {
            teamId,
            status: "Active",
            personId: { in: [...personIdByUserId.values()] },
        },
        select: { personId: true },
    });
    const onRosterPersonIds = new Set(rosterMemberships.map((membership) => membership.personId));

    return grants
        .map((grant) => {
            const personId = personIdByUserId.get(grant.userId);
            return TeamUserData.teamGrantSchema.parse({
                id: grant.id,
                teamId: grant.teamId,
                userId: grant.userId,
                createdAt: grant.createdAt.toISOString(),
                user: { ...grant.user, image: grant.user.image || null },
                onRoster: personId !== undefined && onRosterPersonIds.has(personId),
            });
        })
        .sort((a, b) => a.user.name.localeCompare(b.user.name));
}

/**
 * The teams a user has been granted access to in the organization, ordered by team name. Leaves out
 * teams in the Rubbish bin (`Deleted`); archived teams stay, shown with their status.
 */
export async function listForUser(ctx: OrgServiceContext, userId: UserId): Promise<UserTeamData[]> {
    const grants = await ctx.prisma.teamUser.findMany({
        where: {
            organizationId: ctx.organizationId,
            userId,
            team: { status: { not: "Deleted" } },
        },
        select: {
            id: true,
            createdAt: true,
            team: { select: { id: true, name: true, slug: true, status: true } },
        },
    });

    return grants
        .map((grant) =>
            TeamUserData.userGrantSchema.parse({
                id: grant.id,
                team: grant.team,
                createdAt: grant.createdAt.toISOString(),
            }),
        )
        .sort((a, b) => a.team.name.localeCompare(b.team.name));
}

/**
 * The caller's grants that lead into a team scope, across all their organizations: those whose
 * team has a slug and is `Active`, with the team's org, ordered by org name then team name. One
 * query; the org comes through `Team.organization`, not the grant's composite relation.
 */
export async function listForCaller(ctx: UserServiceContext): Promise<TeamScopeGrantData[]> {
    const grants = await ctx.prisma.teamUser.findMany({
        where: { userId: ctx.userId, team: { slug: { not: null }, status: "Active" } },
        select: {
            team: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    organization: { select: { id: true, name: true, slug: true } },
                },
            },
        },
    });

    return grants
        .map(({ team: { organization, ...team } }) =>
            TeamUserData.scopeGrantSchema.parse({ team, organization }),
        )
        .sort(
            (a, b) =>
                a.organization.name.localeCompare(b.organization.name) ||
                a.team.name.localeCompare(b.team.name),
        );
}

/**
 * Grant a member of the organization access to one of its teams.
 * @throws NotFoundError if the team isn't in the organization, or the user isn't a member of it
 * (or their account is soft-deleted).
 * @throws ConflictError if the team isn't Active, or the user already has access.
 */
export async function grant(ctx: OrgServiceContext, teamId: TeamId, userId: UserId) {
    const team = await ctx.prisma.team.findUnique({
        where: { id: teamId, organizationId: ctx.organizationId },
        select: { id: true, name: true, status: true },
    });
    if (!team) throw new NotFoundError(`Team(id=${teamId}) not found.`);
    if (team.status !== "Active") {
        throw new ConflictError("Only active teams can be granted access.");
    }

    const member = await ctx.prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId: ctx.organizationId, userId } },
        select: { user: { select: { name: true, status: true } } },
    });
    if (!member || member.user.status === "Deleted") {
        throw new NotFoundError(`OrganizationUser(userId=${userId}) not found.`);
    }

    const existing = await ctx.prisma.teamUser.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: { id: true },
    });
    const alreadyGranted = () =>
        new ConflictError(`${member.user.name} already has access to ${team.name}.`);
    if (existing) throw alreadyGranted();

    const id = TeamUserId.create();
    // A concurrent grant can land between the check above and the insert; the unique index on
    // (teamId, userId) catches it, and it reads as the same duplicate grant.
    const [created] = await ctx.prisma
        .$transaction([
            ctx.prisma.teamUser.create({
                data: { id, organizationId: ctx.organizationId, teamId, userId },
            }),
            ctx.logEvent({
                action: "Create",
                objectType: "TeamUser",
                objectId: id,
                description: `Granted ${member.user.name} access to team ${team.name}.`,
                refs: grantRefs(teamId, userId),
            }),
        ])
        .catch((error: unknown) => {
            throw isUniqueViolation(error) ? alreadyGranted() : error;
        });

    return created;
}

/**
 * Revoke a user's access to a team. A hard delete: grants aren't in the Rubbish bin, so the log
 * entry's description names the user and team.
 * @throws NotFoundError if the user has no access to the team in this organization.
 */
export async function revoke(
    ctx: OrgServiceContext,
    teamId: TeamId,
    userId: UserId,
): Promise<void> {
    const existing = await ctx.prisma.teamUser.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: {
            id: true,
            organizationId: true,
            team: { select: { name: true } },
            user: { select: { name: true } },
        },
    });
    if (!existing || existing.organizationId !== ctx.organizationId) {
        throw new NotFoundError(`TeamUser(teamId=${teamId}, userId=${userId}) not found.`);
    }

    await ctx.prisma.$transaction([
        ctx.prisma.teamUser.delete({ where: { id: existing.id } }),
        ctx.logEvent({
            action: "Delete",
            objectType: "TeamUser",
            objectId: existing.id,
            description: `Revoked ${existing.user.name}'s access to team ${existing.team.name}.`,
            refs: grantRefs(teamId, userId),
        }),
    ]);
}

/** A grant entry's primary is the grant; these refs put it on the team's and the user's timelines. */
function grantRefs(teamId: TeamId, userId: UserId): LogEntryRef[] {
    return [
        { objectType: "Team", objectId: teamId, role: "context" },
        { objectType: "User", objectId: userId, role: "context" },
    ];
}
