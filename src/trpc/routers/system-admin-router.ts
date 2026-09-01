/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import type { PrismaClient } from "@/generated/prisma/client";
import { nanoId16 } from "@/lib/id";
import type { ModuleId } from "@/lib/modules";
import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { UserId } from "@/lib/schemas/user";

import { createTrpcRouter, systemAdminProcedure } from "../init";

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
    const owners = await prisma.organizationUser.findMany({
        where: { organizationId, role: "owner" },
        select: { userId: true },
    });
    if (owners.length <= 1 && owners.some((o) => o.userId === userId)) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove or demote the last owner of an organization.",
        });
    }
}

/**
 * Site-wide administration router. Gated by `systemAdminProcedure`
 * (`session.user.role === "admin"`), not by org-scoped permissions.
 *
 * Procedures must be kept in alphabetical order.
 */
export const systemAdminRouter = createTrpcRouter({
    /**
     * Attach an existing user to an organization as a direct membership (not the invitation
     * flow). `CONFLICT` if the user is already a member.
     *
     * This deliberately skips the invitation-only `personId` link that
     * `organizationHooks.afterAcceptInvitation` copies — a system-admin direct assignment has
     * no invitation to source a `personId` from, and that link is optional. Nothing else in
     * that hook affects a plain membership insert.
     *
     * `systemAdminProcedure` has no `ctx.logEvent` (that is org-scoped), so the audit entry is
     * written directly into the same `$transaction` — see `createOrganization`.
     */
    addOrganizationMember: systemAdminProcedure
        .input(
            z.object({
                organizationId: OrganizationId.schema,
                userId: UserId.schema,
                role: OrganizationRole.schema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId: input.organizationId, userId: input.userId },
                select: { id: true },
            });
            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "That user is already a member of this organization.",
                });
            }

            const id = nanoId16();

            await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.create({
                    data: {
                        id,
                        organizationId: input.organizationId,
                        userId: input.userId,
                        role: input.role,
                        createdAt: new Date(),
                    },
                }),
                ctx.prisma.organizationLogEntry.create({
                    data: {
                        id: nanoId16(),
                        organizationId: input.organizationId,
                        userId: ctx.auth.user.id,
                        action: "Create",
                        objectType: "OrganizationMembership",
                        objectId: id,
                        changes: [],
                        description: `Added user ${input.userId} as ${input.role}`,
                    },
                }),
            ]);

            return { id };
        }),

    /**
     * Provision a new organization site-wide. Seeds the same default `OrganizationConfig` rows a
     * user-created org would resolve to (`OrganizationSettings.default()` flattened to
     * `{ key, value }` leaves) so the two are indistinguishable, and — only when `addSelfAsOwner`
     * is set — attaches the acting system admin as `owner`.
     *
     * `systemAdminProcedure` has no `ctx.logEvent` (that is org-scoped), so the audit entry is
     * written directly into the same `$transaction` — equivalent to what `ctx.logEvent` does.
     */
    createOrganization: systemAdminProcedure
        .input(
            OrganizationData.createSchema.extend({
                addSelfAsOwner: z.boolean().default(false),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.prisma.organization.findUnique({
                where: { slug: input.slug },
                select: { id: true },
            });
            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `An organization with the slug "${input.slug}" already exists.`,
                });
            }

            const organizationId = OrganizationId.schema.parse(nanoId16());
            const userId = ctx.auth.user.id;

            const configRows = Object.entries(
                OrganizationSettings.flatten(OrganizationSettings.default()),
            ).map(([key, value]) => ({ organizationId, key, value }));

            await ctx.prisma.$transaction([
                ctx.prisma.organization.create({
                    data: {
                        id: organizationId,
                        name: input.name,
                        slug: input.slug,
                        createdAt: new Date(),
                    },
                }),
                ...configRows.map((data) => ctx.prisma.organizationConfig.create({ data })),
                ...(input.addSelfAsOwner
                    ? [
                          ctx.prisma.organizationUser.create({
                              data: {
                                  id: nanoId16(),
                                  organizationId,
                                  userId,
                                  role: "owner",
                                  createdAt: new Date(),
                              },
                          }),
                      ]
                    : []),
                ctx.prisma.organizationLogEntry.create({
                    data: {
                        id: nanoId16(),
                        organizationId,
                        userId,
                        action: "Create",
                        objectType: "Organization",
                        objectId: organizationId,
                        changes: [],
                    },
                }),
            ]);

            return { id: organizationId, slug: input.slug };
        }),

    getOrganization: systemAdminProcedure
        .input(z.object({ organizationId: OrganizationId.schema }))
        .query(async ({ ctx, input }) => {
            const org = await ctx.prisma.organization.findUnique({
                where: { id: input.organizationId },
                include: {
                    users: {
                        include: {
                            user: { select: { id: true, name: true, email: true } },
                        },
                    },
                    teams: {
                        select: {
                            id: true,
                            name: true,
                            _count: { select: { teamMemberships: true } },
                        },
                    },
                    configs: true,
                    _count: {
                        select: {
                            d4hAccessTokens: true,
                            personnel: true,
                            skillChecks: true,
                            skillCheckSessions: true,
                            notes: true,
                            skillPackages: true,
                            i3IssuedItems: true,
                            formInstances: true,
                        },
                    },
                },
            });

            if (!org) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Organization ${input.organizationId} not found.`,
                });
            }

            return {
                id: org.id,
                name: org.name,
                slug: org.slug,
                logo: org.logo,
                createdAt: org.createdAt,
                members: org.users.map((m) => ({
                    userId: m.userId,
                    name: m.user.name,
                    email: m.user.email,
                    role: m.role,
                })),
                teams: org.teams.map((t) => ({
                    id: t.id,
                    name: t.name,
                    memberCount: t._count.teamMemberships,
                })),
                enabledModules: Object.entries(
                    OrganizationSettings.fromRecords(org.configs).modules,
                )
                    .filter(([, v]) => v.enabled)
                    .map(([k]) => k as ModuleId),
                d4hTokenCount: org._count.d4hAccessTokens,
                recordCounts: {
                    personnel: org._count.personnel,
                    skillChecks: org._count.skillChecks,
                    skillCheckSessions: org._count.skillCheckSessions,
                    notes: org._count.notes,
                    skillPackages: org._count.skillPackages,
                    i3IssuedItems: org._count.i3IssuedItems,
                    formInstances: org._count.formInstances,
                } as Record<string, number>,
            };
        }),

    getUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema }))
        .query(async ({ ctx, input }) => {
            const user = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                include: {
                    organizationUsers: {
                        include: {
                            organization: { select: { id: true, name: true, slug: true } },
                        },
                    },
                },
            });

            if (!user) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `User ${input.userId} not found.`,
                });
            }

            const { organizationUsers, ...rest } = user;

            return {
                ...rest,
                role: user.role ?? "user",
                banned: user.banned ?? false,
                organizations: organizationUsers.map((m) => ({ ...m.organization, role: m.role })),
            };
        }),

    health: systemAdminProcedure.query(() => ({ ok: true as const })),

    listOrganizations: systemAdminProcedure.query(async ({ ctx }) => {
        const rows = await ctx.prisma.organization.findMany({
            select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
                createdAt: true,
                configs: true,
                _count: { select: { users: true } },
                users: { where: { role: "owner" }, select: { id: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        return {
            organizations: rows.map(({ _count, configs, users, ...o }) => ({
                ...o,
                memberCount: _count.users,
                ownerCount: users.length,
                enabledModules: Object.entries(OrganizationSettings.fromRecords(configs).modules)
                    .filter(([, v]) => v.enabled)
                    .map(([k]) => k as ModuleId),
            })),
        };
    }),

    listUsers: systemAdminProcedure.query(async ({ ctx }) => {
        const rows = await ctx.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                banned: true,
                emailVerified: true,
                createdAt: true,
                _count: { select: { organizationUsers: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        return {
            users: rows.map(({ _count, ...u }) => ({
                ...u,
                role: u.role ?? "user",
                banned: u.banned ?? false,
                organizationCount: _count.organizationUsers,
            })),
        };
    }),

    /**
     * Remove a user's direct membership from an organization. `BAD_REQUEST` if they are the
     * organization's last `owner`.
     */
    removeOrganizationMember: systemAdminProcedure
        .input(z.object({ organizationId: OrganizationId.schema, userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            const membership = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId: input.organizationId, userId: input.userId },
                select: { id: true, role: true },
            });
            if (!membership) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "That user is not a member of this organization.",
                });
            }

            await assertNotLastOwner(ctx.prisma, input.organizationId, input.userId);

            await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.delete({ where: { id: membership.id } }),
                ctx.prisma.organizationLogEntry.create({
                    data: {
                        id: nanoId16(),
                        organizationId: input.organizationId,
                        userId: ctx.auth.user.id,
                        action: "Delete",
                        objectType: "OrganizationMembership",
                        objectId: membership.id,
                        changes: [],
                        description: `Removed user ${input.userId}`,
                    },
                }),
            ]);

            return { ok: true as const };
        }),

    /**
     * Change a member's role within an organization. `BAD_REQUEST` if this would demote the
     * organization's last `owner`.
     */
    setOrganizationMemberRole: systemAdminProcedure
        .input(
            z.object({
                organizationId: OrganizationId.schema,
                userId: UserId.schema,
                role: OrganizationRole.schema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const membership = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId: input.organizationId, userId: input.userId },
                select: { id: true, role: true },
            });
            if (!membership) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "That user is not a member of this organization.",
                });
            }

            if (input.role !== "owner") {
                await assertNotLastOwner(ctx.prisma, input.organizationId, input.userId);
            }

            const [updated] = await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.update({
                    where: { id: membership.id },
                    data: { role: input.role },
                }),
                ctx.prisma.organizationLogEntry.create({
                    data: {
                        id: nanoId16(),
                        organizationId: input.organizationId,
                        userId: ctx.auth.user.id,
                        action: "Update",
                        objectType: "OrganizationMembership",
                        objectId: membership.id,
                        changes: [],
                        description: `Changed user ${input.userId} role from ${membership.role} to ${input.role}`,
                    },
                }),
            ]);

            return { id: updated.id, role: updated.role };
        }),
});
