/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import type { PrismaClient } from "@/generated/prisma/client";
import { diffObject } from "@/lib/diff";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { OrganizationUserId } from "@/lib/schemas/organization-user";
import { UserId } from "@/lib/schemas/user";
import { auth } from "@/server/auth";
import { revalidateOrganization } from "@/server/cache/organization";
import { getOrganizationUserRoles } from "@/server/cache/organization-user";
import { revalidateOrganizationUser } from "@/server/cache/organization-user-revalidate";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

/**
 * The memberships holding the `owner` role, filtered by `where`.
 *
 * `OrganizationUser.role` is comma-joined (an owner who is also an `i3-editor` is stored as
 * `"owner,i3-editor"`), so matching `role: "owner"` exactly would miss them. `contains` narrows
 * the query and the exact-role check afterwards keeps it from matching on a substring.
 */
export async function findOwnerMemberships(
    prisma: Pick<PrismaClient, "organizationUser">,
    where: { organizationId?: string | { in: string[] }; userId?: string },
) {
    const rows = await prisma.organizationUser.findMany({
        where: { ...where, role: { contains: "owner" } },
        select: { organizationId: true, userId: true, role: true },
    });
    return rows.filter((row) => OrganizationRole.includes(row.role, "owner"));
}

/**
 * Guard against orphaning an organization: throws `BAD_REQUEST` if `userId` is the
 * organization's only `owner` (so removing them, or demoting them from `owner`, would
 * leave the org with no owner).
 */
export async function assertNotLastOwner(
    prisma: Pick<PrismaClient, "organizationUser">,
    organizationId: string,
    userId: string,
) {
    const owners = await findOwnerMemberships(prisma, { organizationId });
    if (owners.length <= 1 && owners.some((o) => o.userId === userId)) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove or demote the last owner of an organisation.",
        });
    }
}

/** Throws `NOT_FOUND` if the user does not exist (surfaces a clear error before an FK violation). */
async function assertUserExists(prisma: Pick<PrismaClient, "user">, userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: `User ${userId} not found.` });
    }
}

/**
 * Whether `error` is a Prisma unique-constraint violation (`P2002`) — what a concurrent duplicate
 * insert raises after a `findFirst` pre-check has already passed.
 */
function isUniqueViolation(error: unknown): boolean {
    return error instanceof Object && "code" in error && error.code === "P2002";
}

export const organizationsRouter = createTrpcRouter({
    /**
     * Attach an existing user to an organization as a direct membership (not the invitation
     * flow). `CONFLICT` if the user is already a member.
     *
     * This deliberately skips the invitation-only `personId` link that
     * `organizationHooks.afterAcceptInvitation` copies — a direct assignment has no invitation
     * to source a `personId` from, and that link is optional. Nothing else in that hook affects
     * a plain membership insert.
     *
     * `allowSystemAdmin` lets a site-wide administrator add a member to an organization they
     * don't themselves belong to (the system-admin console's org member management).
     */
    addOrganizationMember: organizationProcedure({ member: ["create"] }, { allowSystemAdmin: true })
        .input(z.object({ userId: UserId.schema, roles: OrganizationRole.assignmentSchema }))
        .mutation(async ({ ctx, input }) => {
            await assertUserExists(ctx.prisma, input.userId);

            const existing = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId: ctx.organizationId, userId: input.userId },
                select: { id: true },
            });
            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "That user is already a member of this organisation.",
                });
            }

            const id = OrganizationUserId.create();

            try {
                await ctx.prisma.$transaction([
                    ctx.prisma.organizationUser.create({
                        data: {
                            id,
                            organizationId: ctx.organizationId,
                            userId: input.userId,
                            role: OrganizationRole.serialize(input.roles),
                            createdAt: new Date(),
                        },
                    }),
                    ctx.logEvent({
                        action: "Create",
                        objectType: "OrganizationMembership",
                        objectId: id,
                        changes: [],
                        description: `Added user ${input.userId} as ${OrganizationRole.serialize(input.roles)}`,
                    }),
                ]);
            } catch (error) {
                // A concurrent add slipped in between the check above and this insert.
                if (isUniqueViolation(error)) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "That user is already a member of this organisation.",
                    });
                }
                throw error;
            }

            await revalidateOrganizationUser(input.userId);

            return { id };
        }),

    /**
     * Retrieves the calling user's role(s) within the organization, for client-side
     * permission checks (see `Protect`, `useOrganization`).
     */
    getMyRoles: organizationProcedure({ organization: ["view"] })
        .output(z.array(OrganizationRole.schema))
        .query(async ({ ctx }) => {
            return getOrganizationUserRoles(ctx.organizationId, ctx.userId);
        }),

    /**
     * Retrieves the organization details.
     * @param ctx The authenticated context.
     * @returns The organization object.
     * @throws TRPCError(NOT_FOUND) if the organization does not exist.
     */
    getOrganization: organizationProcedure({ organization: ["view"] })
        .output(OrganizationData.schema)
        .query(async ({ ctx }) => {
            const organization = await ctx.prisma.organization.findUnique({
                where: { id: ctx.organizationId },
            });

            if (!organization) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Organisation not found",
                });
            }

            return OrganizationData.fromRecord(organization);
        }),

    /**
     * Remove a member from the organization. `BAD_REQUEST` if this would remove the
     * organization's last `owner`.
     *
     * `allowSystemAdmin` lets a site-wide administrator remove a member of an organization
     * they don't themselves belong to (the system-admin console's org member management).
     */
    removeOrganizationMember: organizationProcedure(
        { member: ["delete"] },
        { allowSystemAdmin: true },
    )
        .input(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            const membership = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId: ctx.organizationId, userId: input.userId },
                select: { id: true, role: true },
            });
            if (!membership) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "That user is not a member of this organisation.",
                });
            }

            // Only an owner removal can orphan the org — skip the owners query otherwise.
            if (OrganizationRole.includes(membership.role, "owner")) {
                await assertNotLastOwner(ctx.prisma, ctx.organizationId, input.userId);
            }

            await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.delete({ where: { id: membership.id } }),
                ctx.logEvent({
                    action: "Delete",
                    objectType: "OrganizationMembership",
                    objectId: membership.id,
                    changes: [],
                    description: `Removed user ${input.userId}`,
                }),
            ]);

            await revalidateOrganizationUser(input.userId);

            return { ok: true as const };
        }),

    /**
     * Replace a member's roles within an organization — one primary role plus any secondary
     * roles. `BAD_REQUEST` if this would remove `owner` from the organization's last owner.
     *
     * `allowSystemAdmin` lets a site-wide administrator change a member's roles in an
     * organization they don't themselves belong to (the system-admin console's org member
     * management).
     */
    setOrganizationMemberRole: organizationProcedure(
        { member: ["update"] },
        { allowSystemAdmin: true },
    )
        .input(z.object({ userId: UserId.schema, roles: OrganizationRole.assignmentSchema }))
        .mutation(async ({ ctx, input }) => {
            const membership = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId: ctx.organizationId, userId: input.userId },
                select: { id: true, role: true },
            });
            if (!membership) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "That user is not a member of this organisation.",
                });
            }

            // The guard only matters when an existing owner is losing the owner role.
            if (
                OrganizationRole.includes(membership.role, "owner") &&
                !input.roles.includes("owner")
            ) {
                await assertNotLastOwner(ctx.prisma, ctx.organizationId, input.userId);
            }

            const role = OrganizationRole.serialize(input.roles);

            const [updated] = await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.update({
                    where: { id: membership.id },
                    data: { role },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "OrganizationMembership",
                    objectId: membership.id,
                    changes: [],
                    description: `Changed user ${input.userId} role from ${membership.role} to ${role}`,
                }),
            ]);

            await revalidateOrganizationUser(input.userId);

            return {
                id: updated.id,
                roles: OrganizationRole.schema.array().parse(role.split(",")),
            };
        }),

    /**
     * Updates the organization details.
     */
    updateOrganization: organizationProcedure({ organization: ["update"] })
        .input(
            z.object({
                update: OrganizationData.modifiableSchema,
            }),
        )
        .output(
            z.object({
                updated: OrganizationData.schema,
            }),
        )
        .mutation(async ({ ctx, input: { update } }) => {
            const existing = await ctx.prisma.organization.findUnique({
                where: { id: ctx.organizationId },
            });

            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.organizationNotFound(ctx.organizationId),
                });
            }

            await auth.api.updateOrganization({
                headers: await ctx.getHeaders(),
                body: {
                    organizationId: ctx.organizationId,
                    data: {
                        slug: update.slug,
                        name: update.name,
                    },
                },
            });

            const changes = diffObject(OrganizationData.modifiableSchema.parse(existing), update);

            await ctx.logEvent({
                action: "Update",
                objectType: "Organization",
                objectId: ctx.organizationId,
                changes,
            });

            await revalidateOrganization(update.slug);

            return {
                updated: OrganizationData.fromRecord({
                    ...existing,
                    ...update,
                }),
            };
        }),
});
