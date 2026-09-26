/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { diffObject } from "@/lib/diff";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { PersonId } from "@/lib/schemas/person";
import { TeamData, type TeamId } from "@/lib/schemas/team";
import {
    TeamMembershipData,
    TeamMembershipId,
    type ModifiableTeamMembershipData,
} from "@/lib/schemas/team-membership";

import type { OrgServiceContext } from "./service-context";

/**
 * Fetch a team by ID, or `null` if it does not exist within the organization. Callers that need
 * the team to exist should use `requireById` instead.
 */
export async function getById(ctx: OrgServiceContext, teamId: TeamId): Promise<TeamData | null> {
    const team = await ctx.prisma.team.findUnique({
        where: {
            id: teamId,
            organizationId: ctx.organizationId,
        },
        include: {
            d4h: true,
        },
    });

    if (!team) return null;

    // Resolve the D4H organisation name from the org-level cache (at most one
    // `Organization_D4H` per org) so the detail view can show it alongside the id.
    const orgD4H = team.d4h
        ? await ctx.prisma.organization_D4H.findUnique({
              where: { organizationId: ctx.organizationId },
              select: { d4hOrganisationName: true },
          })
        : null;

    return TeamData.fromRecord({
        ...team,
        d4h: team.d4h
            ? { ...team.d4h, d4hOrganisationName: orgD4H?.d4hOrganisationName ?? null }
            : null,
    });
}

/**
 * Fetch a team by ID and ensure it belongs to the organization.
 * @throws NotFoundError if the team does not exist within the organization.
 */
export async function requireById(ctx: OrgServiceContext, teamId: TeamId): Promise<TeamData> {
    const team = await getById(ctx, teamId);

    if (!team) {
        throw new NotFoundError(`Team(id=${teamId}) not found.`);
    }

    return team;
}

/**
 * Archive a team (reversible via `restoreFromArchive`). No-op, returning the existing record
 * unchanged, if the team is already `Archived`.
 * @throws NotFoundError if the team is not found in the organization.
 */
export async function archive(ctx: OrgServiceContext, teamId: TeamId): Promise<TeamData> {
    const existing = await requireById(ctx, teamId);

    if (existing.status === "Archived") {
        return existing;
    }

    await ctx.prisma.$transaction([
        ctx.prisma.team.update({
            where: { id: teamId, organizationId: ctx.organizationId },
            data: { status: "Archived" },
        }),
        ctx.logEvent({ action: "Archive", objectType: "Team", objectId: teamId }),
    ]);

    return await requireById(ctx, teamId);
}

/**
 * Restore an `Archived` team back to `Active`. No-op, returning the existing record unchanged, if
 * the team is already `Active`.
 * @throws NotFoundError if the team is not found in the organization.
 * @throws ValidationError if the team is `Deleted` — use `restoreFromTrash` instead.
 */
export async function restoreFromArchive(
    ctx: OrgServiceContext,
    teamId: TeamId,
): Promise<TeamData> {
    const existing = await requireById(ctx, teamId);

    if (existing.status === "Active") {
        return existing;
    }

    if (existing.status !== "Archived") {
        throw new ValidationError(
            `Team(id=${teamId}) has status ${existing.status}; only an Archived team can be restored from archive.`,
        );
    }

    return await restoreToActive(ctx, teamId);
}

/**
 * Restore a `Deleted` team back to `Active`. No-op, returning the existing record unchanged, if
 * the team is already `Active`.
 * @throws NotFoundError if the team is not found in the organization.
 * @throws ValidationError if the team is `Archived` — use `restoreFromArchive` instead.
 */
export async function restoreFromTrash(ctx: OrgServiceContext, teamId: TeamId): Promise<TeamData> {
    const existing = await requireById(ctx, teamId);

    if (existing.status === "Active") {
        return existing;
    }

    if (existing.status !== "Deleted") {
        throw new ValidationError(
            `Team(id=${teamId}) has status ${existing.status}; only a Deleted team can be restored from rubbish.`,
        );
    }

    return await restoreToActive(ctx, teamId);
}

async function restoreToActive(ctx: OrgServiceContext, teamId: TeamId): Promise<TeamData> {
    await ctx.prisma.$transaction([
        ctx.prisma.team.update({
            where: { id: teamId, organizationId: ctx.organizationId },
            data: { status: "Active" },
        }),
        ctx.logEvent({ action: "Restore", objectType: "Team", objectId: teamId }),
    ]);

    return await requireById(ctx, teamId);
}

/**
 * Soft-delete a team (reversible via `restoreFromTrash`). No-op, returning the existing record
 * unchanged, if the team is already `Deleted`.
 *
 * Always soft — nothing physically removes the row here. `TeamMembership` rows are deliberately
 * left untouched (no cascade on soft-delete, unlike the FK `onDelete: Cascade` that only fired for
 * the old hard delete); they are filtered by status at query time instead.
 * @throws NotFoundError if the team is not found in the organization.
 */
export async function deleteRecord(ctx: OrgServiceContext, teamId: TeamId): Promise<TeamData> {
    const existing = await requireById(ctx, teamId);

    if (existing.status === "Deleted") {
        return existing;
    }

    await ctx.prisma.$transaction([
        ctx.prisma.team.update({
            where: { id: teamId, organizationId: ctx.organizationId },
            data: { status: "Deleted" },
        }),
        ctx.logEvent({ action: "Delete", objectType: "Team", objectId: teamId }),
    ]);

    return await requireById(ctx, teamId);
}

/**
 * Summarize what becomes hidden from active views if this team is deleted, for the delete
 * confirmation dialog's impact preview. Not a cascade list — nothing here is destroyed at delete
 * time.
 * @throws NotFoundError if the team is not found in the organization.
 */
export async function getDeleteImpact(
    ctx: OrgServiceContext,
    teamId: TeamId,
): Promise<{ memberCount: number }> {
    await requireById(ctx, teamId);

    const memberCount = await ctx.prisma.teamMembership.count({
        where: { organizationId: ctx.organizationId, teamId, status: "Active" },
    });

    return { memberCount };
}

/**
 * Fetch a team membership by (teamId, personId), or `null` if none exists within the
 * organization.
 */
export async function getMembership(
    ctx: OrgServiceContext,
    teamId: TeamId,
    personId: PersonId,
): Promise<TeamMembershipData | null> {
    const membership = await ctx.prisma.teamMembership.findUnique({
        where: {
            organizationId: ctx.organizationId,
            teamId_personId: { teamId, personId },
        },
    });

    return membership ? TeamMembershipData.fromRecord(membership) : null;
}

/**
 * Fetch a team membership by (teamId, personId) and ensure it belongs to the organization.
 * @throws NotFoundError if no membership exists for that pair within the organization.
 */
export async function requireMembership(
    ctx: OrgServiceContext,
    teamId: TeamId,
    personId: PersonId,
): Promise<TeamMembershipData> {
    const membership = await getMembership(ctx, teamId, personId);

    if (!membership) {
        throw new NotFoundError(
            `TeamMembership(teamId=${teamId}, personId=${personId}) not found.`,
        );
    }

    return membership;
}

/**
 * Create a team membership for a (teamId, personId) pair.
 *
 * If a `Deleted` membership already exists for the pair, revives it in place instead of inserting
 * a second row — `@@unique([teamId, personId])` means a fresh `create` would fail once a row for
 * that pair exists at all, deleted or not. Mirrors `d4h-team-sync.ts`'s `adoptExistingMembership`,
 * which revives the same way for the D4H-driven add path.
 * @throws ConflictError if an Active or Archived membership already exists for this pair.
 */
export async function createMembership(
    ctx: OrgServiceContext,
    teamId: TeamId,
    personId: PersonId,
    data: ModifiableTeamMembershipData,
): Promise<TeamMembershipData> {
    const existing = await ctx.prisma.teamMembership.findUnique({
        where: { organizationId: ctx.organizationId, teamId_personId: { teamId, personId } },
    });

    if (existing && existing.status !== "Deleted") {
        throw new ConflictError(`Person(${personId}) is already a member of Team(${teamId}).`);
    }

    if (existing) {
        await ctx.prisma.$transaction([
            ctx.prisma.teamMembership.update({
                where: { id: existing.id },
                data: { status: "Active", tags: data.tags, properties: data.properties },
            }),
            ctx.logEvent({
                action: "Create",
                objectType: "TeamMembership",
                objectId: existing.id,
                changes: diffObject({ tags: existing.tags, properties: existing.properties }, data),
                refs: [
                    { objectType: "Person", objectId: personId, role: "context" },
                    { objectType: "Team", objectId: teamId, role: "context" },
                ],
            }),
        ]);
    } else {
        const id = TeamMembershipId.create();

        await ctx.prisma.$transaction([
            ctx.prisma.teamMembership.create({
                data: {
                    id,
                    organizationId: ctx.organizationId,
                    teamId,
                    personId,
                    tags: data.tags,
                    properties: data.properties,
                },
            }),
            ctx.logEvent({
                action: "Create",
                objectType: "TeamMembership",
                objectId: id,
                changes: diffObject({ tags: [], properties: {} }, data),
                refs: [
                    { objectType: "Person", objectId: personId, role: "context" },
                    { objectType: "Team", objectId: teamId, role: "context" },
                ],
            }),
        ]);
    }

    return requireMembership(ctx, teamId, personId);
}

/**
 * Soft-delete a team membership (reversible via `restoreMembershipFromTrash`). No-op, returning
 * the existing record unchanged, if the membership is already `Deleted`.
 *
 * Unlike Team/Person, a membership has no archive pair — there is no intermediate "hidden but
 * still cared about" state distinct from being removed, so this is the only delete verb.
 * @throws NotFoundError if no membership exists for that pair within the organization.
 */
export async function deleteMembership(
    ctx: OrgServiceContext,
    teamId: TeamId,
    personId: PersonId,
): Promise<TeamMembershipData> {
    const existing = await requireMembership(ctx, teamId, personId);

    if (existing.status === "Deleted") {
        return existing;
    }

    await ctx.prisma.$transaction([
        ctx.prisma.teamMembership.update({
            where: { organizationId: ctx.organizationId, teamId_personId: { teamId, personId } },
            data: { status: "Deleted" },
        }),
        ctx.logEvent({
            action: "Delete",
            objectType: "TeamMembership",
            objectId: existing.id,
            refs: [
                { objectType: "Person", objectId: personId, role: "context" },
                { objectType: "Team", objectId: teamId, role: "context" },
            ],
        }),
    ]);

    return await requireMembership(ctx, teamId, personId);
}

/**
 * Restore a `Deleted` team membership back to `Active`. No-op, returning the existing record
 * unchanged, if the membership is already `Active`.
 * @throws NotFoundError if no membership exists for that pair within the organization.
 * @throws ValidationError if the membership is not `Deleted`.
 */
export async function restoreMembershipFromTrash(
    ctx: OrgServiceContext,
    teamId: TeamId,
    personId: PersonId,
): Promise<TeamMembershipData> {
    const existing = await requireMembership(ctx, teamId, personId);

    if (existing.status === "Active") {
        return existing;
    }

    if (existing.status !== "Deleted") {
        throw new ValidationError(
            `TeamMembership(teamId=${teamId}, personId=${personId}) has status ${existing.status}; only a Deleted membership can be restored from rubbish.`,
        );
    }

    await ctx.prisma.$transaction([
        ctx.prisma.teamMembership.update({
            where: { organizationId: ctx.organizationId, teamId_personId: { teamId, personId } },
            data: { status: "Active" },
        }),
        ctx.logEvent({
            action: "Restore",
            objectType: "TeamMembership",
            objectId: existing.id,
            refs: [
                { objectType: "Person", objectId: personId, role: "context" },
                { objectType: "Team", objectId: teamId, role: "context" },
            ],
        }),
    ]);

    return await requireMembership(ctx, teamId, personId);
}
