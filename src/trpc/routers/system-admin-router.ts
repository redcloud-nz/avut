/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

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
