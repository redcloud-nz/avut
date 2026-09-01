/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import type { ModuleId } from "@/lib/modules";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { UserId } from "@/lib/schemas/user";

import { createTrpcRouter, systemAdminProcedure } from "../init";

/**
 * Site-wide administration router. Gated by `systemAdminProcedure`
 * (`session.user.role === "admin"`), not by org-scoped permissions.
 *
 * Procedures must be kept in alphabetical order.
 */
export const systemAdminRouter = createTrpcRouter({
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
});
