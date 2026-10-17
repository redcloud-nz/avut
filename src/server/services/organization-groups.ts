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
import { OrganizationGroupData, OrganizationGroupId } from "@/lib/schemas/organization-group";
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
            id: m.id,
            role: m.role,
            status: m.status,
            organization: m.organization,
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
