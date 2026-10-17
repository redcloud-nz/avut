/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Organization groups (avut#382): a set of organizations bound together, managed only by system
 * administrators in v1. The link grants nothing yet — no capability consumes it.
 *
 * Every entry here is `scope: "system"` (only system admins act on groups in v1, and a deleted
 * group's entry must outlive it).
 */

import "server-only";

import * as z from "zod";

import { diffObject } from "@/lib/diff";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { OrganizationId } from "@/lib/schemas/organization";
import {
    OrganizationGroupData,
    OrganizationGroupId,
    OrganizationGroupMembershipId,
    OrganizationGroupRole,
} from "@/lib/schemas/organization-group";
import type { LogEntryRef } from "@/server/log-entry";
import { isUniqueViolation } from "@/server/prisma-errors";

import type { SystemServiceContext } from "./service-context";

/**
 * Organizations in group results are plain `{ id, name, slug }` selects, never parsed through
 * `OrganizationRef` (whose `min(5)` name would throw on a short org name).
 */
const organizationSelect = { select: { id: true, name: true, slug: true } } as const;

function slugTakenMessage(slug: string) {
    return `A group with the slug "${slug}" already exists.`;
}

/**
 * The group with `groupId`.
 * @throws NotFoundError if there is no such group.
 */
export async function requireGroupById(ctx: SystemServiceContext, groupId: OrganizationGroupId) {
    const group = await ctx.prisma.organizationGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError(`OrganizationGroup(${groupId}) not found.`);
    return group;
}

/** The group whose slug is `slug`, or `null`. Routers pre-check this for a field-level conflict. */
export async function getGroupBySlug(ctx: SystemServiceContext, slug: string) {
    return ctx.prisma.organizationGroup.findUnique({ where: { slug } });
}

/**
 * Throws `ConflictError` if another group already holds `slug`. A match on `ignoreGroupId` (the
 * group being updated, keeping its own slug) is not a conflict.
 */
async function assertSlugAvailable(
    ctx: SystemServiceContext,
    slug: string,
    ignoreGroupId?: OrganizationGroupId,
) {
    const existing = await getGroupBySlug(ctx, slug);
    if (existing && existing.id !== ignoreGroupId) {
        throw new ConflictError(slugTakenMessage(slug));
    }
}

/**
 * Every group, by name, with its active member count and its active overseer's organization (or
 * `null`). Revoked (and dormant `Invited`) memberships count for neither.
 */
export async function listGroups(ctx: SystemServiceContext) {
    const groups = await ctx.prisma.organizationGroup.findMany({
        orderBy: { name: "asc" },
        include: {
            memberships: {
                where: { status: "Active" },
                select: {
                    role: true,
                    organization: organizationSelect,
                },
            },
        },
    });

    return groups.map(({ memberships, ...group }) => ({
        id: group.id as OrganizationGroupId,
        name: group.name,
        slug: group.slug,
        logo: group.logo,
        createdAt: group.createdAt,
        activeMemberCount: memberships.length,
        overseer: memberships.find((m) => m.role === "Overseer")?.organization ?? null,
    }));
}

/**
 * The group plus every membership it has had (any status), ordered by organization name.
 * @throws NotFoundError if there is no such group.
 */
export async function getGroupDetail(ctx: SystemServiceContext, groupId: OrganizationGroupId) {
    const group = await ctx.prisma.organizationGroup.findUnique({
        where: { id: groupId },
        include: {
            memberships: {
                select: {
                    id: true,
                    role: true,
                    status: true,
                    organization: organizationSelect,
                },
                orderBy: { organization: { name: "asc" } },
            },
        },
    });
    if (!group) throw new NotFoundError(`OrganizationGroup(${groupId}) not found.`);

    const { memberships, ...rest } = group;
    return {
        id: rest.id as OrganizationGroupId,
        name: rest.name,
        slug: rest.slug,
        logo: rest.logo,
        createdAt: rest.createdAt,
        updatedAt: rest.updatedAt,
        memberships: memberships.map((m) => ({
            id: m.id as OrganizationGroupMembershipId,
            role: m.role,
            status: m.status,
            organization: { ...m.organization, id: m.organization.id as OrganizationId },
        })),
    };
}

/**
 * Create a group with no members.
 * @throws ConflictError if the slug is taken (checked first, and again via the unique constraint
 *   for a concurrent create).
 */
export async function createGroup(
    ctx: SystemServiceContext,
    input: z.infer<typeof OrganizationGroupData.createSchema>,
): Promise<{ id: OrganizationGroupId; slug: string }> {
    await assertSlugAvailable(ctx, input.slug);

    const id = OrganizationGroupId.create();
    try {
        await ctx.prisma.$transaction([
            ctx.prisma.organizationGroup.create({
                data: { id, name: input.name, slug: input.slug },
            }),
            ctx.logSystemEvent({
                action: "Create",
                objectType: "OrganizationGroup",
                objectId: id,
                changes: diffObject({}, { name: input.name, slug: input.slug }),
                description: `Created group ${input.name} (${input.slug}).`,
            }),
        ]);
    } catch (error) {
        // A concurrent create took the slug between the check above and this insert.
        if (isUniqueViolation(error)) throw new ConflictError(slugTakenMessage(input.slug));
        throw error;
    }

    return { id, slug: input.slug };
}

/**
 * Change a group's name and slug. Keeping its own slug is not a conflict.
 * @throws NotFoundError if there is no such group.
 * @throws ConflictError if another group holds the slug.
 */
export async function updateGroup(
    ctx: SystemServiceContext,
    input: z.infer<typeof OrganizationGroupData.updateSchema>,
): Promise<{ id: OrganizationGroupId }> {
    const { groupId, name, slug } = input;
    const existing = await requireGroupById(ctx, groupId);
    await assertSlugAvailable(ctx, slug, groupId);

    const changes = diffObject({ name: existing.name, slug: existing.slug }, { name, slug });
    try {
        await ctx.prisma.$transaction([
            ctx.prisma.organizationGroup.update({ where: { id: groupId }, data: { name, slug } }),
            ctx.logSystemEvent({
                action: "Update",
                objectType: "OrganizationGroup",
                objectId: groupId,
                changes,
                description: `Updated group ${name} (${slug}).`,
            }),
        ]);
    } catch (error) {
        if (isUniqueViolation(error)) throw new ConflictError(slugTakenMessage(slug));
        throw error;
    }

    return { id: groupId };
}

/**
 * Hard-delete a group. Its revoked memberships cascade with it.
 * @throws NotFoundError if there is no such group.
 * @throws ConflictError while any membership is `Active`.
 */
export async function deleteGroup(
    ctx: SystemServiceContext,
    groupId: OrganizationGroupId,
): Promise<{ id: OrganizationGroupId }> {
    const group = await requireGroupById(ctx, groupId);

    const activeMembers = await ctx.prisma.organizationGroupMembership.count({
        where: { groupId, status: "Active" },
    });
    if (activeMembers > 0) {
        throw new ConflictError(
            `Group ${group.name} still has ${activeMembers} active member${activeMembers === 1 ? "" : "s"}. Revoke its members first.`,
        );
    }
    // TODO(avut-ideas#18): once group-owned credentials are real, refuse here while the group owns
    // any `ProviderCredential` — the FK cascade would otherwise delete them with it.

    await ctx.prisma.$transaction([
        ctx.prisma.organizationGroup.delete({ where: { id: groupId } }),
        ctx.logSystemEvent({
            action: "Delete",
            objectType: "OrganizationGroup",
            objectId: groupId,
            // The group is gone, so the description is all that identifies it.
            description: `Deleted group ${group.name} (${group.slug}).`,
        }),
    ]);

    return { id: groupId };
}

// ---------------------------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------------------------

/** What every membership mutation returns: enough for cache effects to find the affected lists. */
export interface MembershipMutationResult {
    id: OrganizationGroupMembershipId;
    groupId: OrganizationGroupId;
    organizationId: OrganizationId;
}

/**
 * A membership entry's primary is the membership; these refs tie it to the organization (so the
 * fan-out index surfaces it there) and to the group.
 */
function membershipRefs(groupId: string, organizationId: string): LogEntryRef[] {
    return [
        { objectType: "Organization", objectId: organizationId, role: "context" },
        { objectType: "OrganizationGroup", objectId: groupId, role: "context" },
    ];
}

function roleLabel(role: OrganizationGroupRole) {
    return OrganizationGroupRole.displayNames[role].toLowerCase();
}

/**
 * The membership with `membershipId`, with its group's `{ id, name }` and its organization's
 * `{ id, name, slug }`.
 * @throws NotFoundError if there is no such membership.
 */
export async function requireMembershipById(
    ctx: SystemServiceContext,
    membershipId: OrganizationGroupMembershipId,
) {
    const membership = await ctx.prisma.organizationGroupMembership.findUnique({
        where: { id: membershipId },
        include: {
            group: { select: { id: true, name: true } },
            organization: organizationSelect,
        },
    });
    if (!membership) {
        throw new NotFoundError(`OrganizationGroupMembership(${membershipId}) not found.`);
    }
    return membership;
}

/**
 * Every membership `organizationId` has had (any status), with its group's `{ id, name }`,
 * ordered by group name.
 */
export async function listGroupsForOrganization(
    ctx: SystemServiceContext,
    organizationId: OrganizationId,
) {
    const memberships = await ctx.prisma.organizationGroupMembership.findMany({
        where: { organizationId },
        select: {
            id: true,
            role: true,
            status: true,
            group: { select: { id: true, name: true } },
        },
        orderBy: { group: { name: "asc" } },
    });

    return memberships.map((m) => ({
        id: m.id as OrganizationGroupMembershipId,
        role: m.role,
        status: m.status,
        group: { id: m.group.id as OrganizationGroupId, name: m.group.name },
    }));
}

/**
 * Throws `ConflictError` if the group already has an active overseer. Only `Active` rows count,
 * so a revoked row that kept `role: Overseer` doesn't block. The check-then-write race is
 * accepted: only system admins write, and a second overseer is visible and fixable in the UI.
 */
async function assertNoActiveOverseer(
    ctx: SystemServiceContext,
    group: { id: string; name: string },
) {
    const overseer = await ctx.prisma.organizationGroupMembership.findFirst({
        where: { groupId: group.id, role: "Overseer", status: "Active" },
        select: { organization: { select: { name: true } } },
    });
    if (overseer) {
        throw new ConflictError(
            `Group ${group.name} already has an overseer (${overseer.organization.name}). Make it a member first.`,
        );
    }
}

/**
 * Add `organizationId` to the group with `role`. An organization whose membership was revoked
 * gets that same row back (`status: Active`, the given role), logged as `Update`; otherwise a new
 * row is created and logged as `Create`.
 * @throws NotFoundError if the group or organization doesn't exist.
 * @throws ConflictError if the organization is already an active member, or `role` is `Overseer`
 *   and the group already has an active overseer.
 */
export async function addMember(
    ctx: SystemServiceContext,
    input: {
        groupId: OrganizationGroupId;
        organizationId: OrganizationId;
        role: OrganizationGroupRole;
    },
): Promise<MembershipMutationResult> {
    const { groupId, organizationId, role } = input;
    const group = await requireGroupById(ctx, groupId);
    const organization = await ctx.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
    });
    if (!organization) throw new NotFoundError(`Organization(${organizationId}) not found.`);

    const alreadyMember = `${organization.name} is already a member of group ${group.name}.`;
    const existing = await ctx.prisma.organizationGroupMembership.findUnique({
        where: { groupId_organizationId: { groupId, organizationId } },
    });
    if (existing?.status === "Active") throw new ConflictError(alreadyMember);
    if (role === "Overseer") await assertNoActiveOverseer(ctx, group);

    const refs = membershipRefs(groupId, organizationId);

    if (existing) {
        // Reactivate the revoked row rather than creating a second one.
        const id = existing.id as OrganizationGroupMembershipId;
        await ctx.prisma.$transaction([
            ctx.prisma.organizationGroupMembership.update({
                where: { id },
                data: { role, status: "Active" },
            }),
            ctx.logSystemEvent({
                action: "Update",
                objectType: "OrganizationGroupMembership",
                objectId: id,
                changes: diffObject(
                    { role: existing.role, status: existing.status },
                    { role, status: "Active" },
                ),
                description: `Re-added ${organization.name} to group ${group.name} as ${roleLabel(role)}.`,
                refs,
            }),
        ]);
        return { id, groupId, organizationId };
    }

    const id = OrganizationGroupMembershipId.create();
    try {
        await ctx.prisma.$transaction([
            ctx.prisma.organizationGroupMembership.create({
                data: { id, groupId, organizationId, role, status: "Active" },
            }),
            ctx.logSystemEvent({
                action: "Create",
                objectType: "OrganizationGroupMembership",
                objectId: id,
                changes: diffObject({}, { role, status: "Active" }),
                description: `Added ${organization.name} to group ${group.name} as ${roleLabel(role)}.`,
                refs,
            }),
        ]);
    } catch (error) {
        // A concurrent add created the (groupId, organizationId) row after the check above.
        if (isUniqueViolation(error)) throw new ConflictError(alreadyMember);
        throw error;
    }
    return { id, groupId, organizationId };
}

/**
 * Change an active membership's role. Setting the role it already has is a no-op: no write and
 * no log entry.
 * @throws NotFoundError if there is no such membership.
 * @throws ConflictError if the membership isn't `Active`, or `role` is `Overseer` and the group
 *   already has an active overseer.
 */
export async function setMemberRole(
    ctx: SystemServiceContext,
    input: { membershipId: OrganizationGroupMembershipId; role: OrganizationGroupRole },
): Promise<MembershipMutationResult> {
    const { membershipId, role } = input;
    const { group, organization, ...membership } = await requireMembershipById(ctx, membershipId);
    const result = {
        id: membershipId,
        groupId: group.id as OrganizationGroupId,
        organizationId: organization.id as OrganizationId,
    };

    if (membership.status !== "Active") {
        throw new ConflictError(
            `${organization.name} is not an active member of group ${group.name}.`,
        );
    }
    if (membership.role === role) return result;
    if (role === "Overseer") await assertNoActiveOverseer(ctx, group);

    await ctx.prisma.$transaction([
        ctx.prisma.organizationGroupMembership.update({
            where: { id: membershipId },
            data: { role },
        }),
        ctx.logSystemEvent({
            action: "Update",
            objectType: "OrganizationGroupMembership",
            objectId: membershipId,
            changes: diffObject({ role: membership.role }, { role }),
            description: `Made ${organization.name} ${roleLabel(role)} of group ${group.name}.`,
            refs: membershipRefs(group.id, organization.id),
        }),
    ]);

    return result;
}

/**
 * Revoke an active membership. The row stays (`status: Revoked`) so its history survives, and
 * re-adding the organization reactivates it.
 * @throws NotFoundError if there is no such membership.
 * @throws ConflictError if the membership isn't `Active`.
 */
export async function revokeMember(
    ctx: SystemServiceContext,
    membershipId: OrganizationGroupMembershipId,
): Promise<MembershipMutationResult> {
    const { group, organization, ...membership } = await requireMembershipById(ctx, membershipId);

    if (membership.status !== "Active") {
        throw new ConflictError(
            `${organization.name} is not an active member of group ${group.name}.`,
        );
    }

    await ctx.prisma.$transaction([
        ctx.prisma.organizationGroupMembership.update({
            where: { id: membershipId },
            data: { status: "Revoked" },
        }),
        ctx.logSystemEvent({
            action: "Revoke",
            objectType: "OrganizationGroupMembership",
            objectId: membershipId,
            changes: diffObject({ status: membership.status }, { status: "Revoked" }),
            description: `Revoked ${organization.name}'s membership of group ${group.name}.`,
            refs: membershipRefs(group.id, organization.id),
        }),
    ]);

    return {
        id: membershipId,
        groupId: group.id as OrganizationGroupId,
        organizationId: organization.id as OrganizationId,
    };
}
