/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import type { Prisma } from "@/generated/prisma/client";
import { diffObject } from "@/lib/diff";
import type { ModuleId } from "@/lib/modules";
import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { OrganizationUserId } from "@/lib/schemas/organization-user";
import { SkillPackageExport } from "@/lib/schemas/skill-package-export";
import { UserId } from "@/lib/schemas/user";
import { revalidateOrganizationUser } from "@/server/cache/organization-user-revalidate";
import { createLogBatch, formatActorLabel } from "@/server/log-entry";
import * as SkillPackages from "@/server/services/skill-packages";
import * as UserAccounts from "@/server/services/user-accounts";

import {
    assertOrganizationExists,
    createTrpcRouter,
    systemAdminProcedure,
    type SystemAdminContext,
} from "../init";

import { settingsRouter } from "./settings-router";

/**
 * Whether `error` is a Prisma unique-constraint violation (`P2002`) — what a concurrent duplicate
 * insert raises after a `findFirst` pre-check has already passed.
 */
function isUniqueViolation(error: unknown): boolean {
    return error instanceof Object && "code" in error && error.code === "P2002";
}

/**
 * Site-wide administration router. Gated by `systemAdminProcedure`
 * (`session.user.role === "admin"`), not by org-scoped permissions.
 *
 * Procedures must be kept in alphabetical order.
 */
/** A membership whose account isn't in the Rubbish bin — the row is kept for recovery. */
const activeMember = { user: { status: { not: "Deleted" as const } } };

/** A system admin's context, as the account service takes it: every entry system-scoped. */
function systemServiceContext(ctx: SystemAdminContext): UserAccounts.SystemServiceContext {
    return {
        prisma: ctx.prisma,
        logSystemEvent: (options, tx) => ctx.logEvent({ scope: "system", ...options }, tx),
    };
}

export const systemAdminRouter = createTrpcRouter({
    /**
     * Provision a new organization site-wide. Seeds the same default `OrganizationConfig` rows a
     * user-created org would resolve to (`OrganizationSettings.default()` flattened to
     * `{ key, value }` leaves) so the two are indistinguishable, and — only when `addSelfAsOwner`
     * is set — attaches the acting system admin as `owner`.
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
                    message: `An organisation with the slug "${input.slug}" already exists.`,
                });
            }

            const organizationId = OrganizationId.create();
            const userId = ctx.auth.user.id;

            // `flatten` types a leaf as `unknown` — it is whatever JSON that path declares.
            const configRows = Object.entries(
                OrganizationSettings.flatten(OrganizationSettings.default()),
            ).map(([key, value]) => ({
                organizationId,
                key,
                value: value as Prisma.InputJsonValue,
            }));

            try {
                await ctx.prisma.$transaction([
                    ctx.prisma.organization.create({
                        data: {
                            id: organizationId,
                            name: input.name,
                            slug: input.slug,
                            createdAt: new Date(),
                        },
                    }),
                    ctx.prisma.organizationConfig.createMany({ data: configRows }),
                    ...(input.addSelfAsOwner
                        ? [
                              ctx.prisma.organizationUser.create({
                                  data: {
                                      id: OrganizationUserId.create(),
                                      organizationId,
                                      userId,
                                      role: "owner",
                                      createdAt: new Date(),
                                  },
                              }),
                          ]
                        : []),
                    ctx.logEvent({
                        organizationId,
                        action: "Create",
                        objectType: "Organization",
                        objectId: organizationId,
                        changes: [],
                    }),
                ]);
            } catch (error) {
                // A concurrent create took the slug between the check above and this insert.
                if (isUniqueViolation(error)) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: `An organisation with the slug "${input.slug}" already exists.`,
                    });
                }
                throw error;
            }

            if (input.addSelfAsOwner) {
                await revalidateOrganizationUser(userId);
            }

            return { id: organizationId, slug: input.slug };
        }),

    /**
     * Soft-delete a user account into the system Rubbish bin (#296): it can't sign in, every
     * session is revoked, and the daily auto-purge removes it for good after
     * `USER_RETENTION_DAYS`. Recover with `recoverUser`; purge early with `purgeUser`.
     *
     * Guards: you cannot delete your own account (close it from your settings instead); the
     * service refuses the last system administrator and the sole owner of any organization.
     */
    deleteUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            if (input.userId === ctx.auth.user.id) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "You cannot delete your own account.",
                });
            }

            await UserAccounts.softDelete(systemServiceContext(ctx), input.userId, "admin");
            await revalidateOrganizationUser(input.userId);

            return { id: input.userId };
        }),

    getOrganization: systemAdminProcedure
        .input(z.object({ organizationId: OrganizationId.schema }))
        .query(async ({ ctx, input }) => {
            const org = await ctx.prisma.organization.findUnique({
                where: { id: input.organizationId },
                include: {
                    users: {
                        where: activeMember,
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

    /**
     * Reused directly from `settingsRouter` via `{ allowSystemAdmin: true }` rather than
     * duplicated — a system admin hits the same permission-checked procedure org members do,
     * just without needing membership of their own.
     */
    getOrganizationSettings: settingsRouter.getOrganizationSettings,

    getUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema }))
        .query(async ({ ctx, input }) => {
            const user = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    banned: true,
                    emailVerified: true,
                    createdAt: true,
                    organizationUsers: {
                        select: {
                            role: true,
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

    /**
     * Import a skill-package export envelope (produced by `skillPackageBuilder.exportPackage`)
     * into a target organization, moving a package across AVUT instances.
     *
     * Create-or-sync keyed on the record IDs in the envelope (see `SkillPackages.prepareImport`):
     * the tree is created if new, otherwise groups/skills are upserted and anything the
     * envelope omits is archived. A package ID that already belongs to another organization is
     * rejected. Imported packages always land `published: false`.
     *
     * `dryRun: true` computes and returns the plan without writing — the UI shows it for
     * confirmation before a real import.
     *
     * Each changed package/group/skill is its own `ctx.prisma.$transaction([write, logEvent])`
     * rather than one transaction for the whole import — a package with many groups/skills
     * would otherwise risk tripping Prisma's interactive-transaction timeout. The entries are
     * independently meaningful (each lands on its own group's/skill's timeline), so they're
     * correlated by a `LogBatch` instead of one combined entry. Unchanged nodes are skipped
     * entirely — no write, no log entry.
     */
    importSkillPackage: systemAdminProcedure
        .input(
            z.object({
                envelope: SkillPackageExport.schema,
                targetOrganizationId: OrganizationId.schema,
                dryRun: z.boolean().default(false),
            }),
        )
        .mutation(async ({ ctx, input: { envelope, targetOrganizationId, dryRun } }) => {
            await assertOrganizationExists(ctx.prisma, targetOrganizationId);

            const { plan, writeItems } = await SkillPackages.prepareImport(
                ctx.prisma,
                envelope,
                targetOrganizationId,
            );

            if (dryRun) return { plan, applied: false as const };
            if (writeItems.length === 0) return { plan, applied: true as const };

            const { counts } = plan;
            const batch = await createLogBatch(
                {
                    operationKey: "skill-package-import",
                    userId: ctx.userId,
                    actorLabel: formatActorLabel(ctx.auth.user.name, ctx.auth.user.email),
                    description: `${plan.packageAction === "Create" ? "Imported" : "Re-imported"} skill package "${envelope.package.name}" into another organisation (${counts.created} created, ${counts.updated} updated, ${counts.archived} archived).`,
                },
                ctx.prisma,
            );

            for (const item of writeItems) {
                await ctx.prisma.$transaction([
                    item.write(ctx.prisma),
                    ctx.logEvent({
                        organizationId: targetOrganizationId,
                        ...item.log,
                        batchId: batch.id,
                    }),
                ]);
            }

            return { plan, applied: true as const };
        }),

    /** Every account in the system Rubbish bin, with its deletion and purge dates. */
    listDeletedUsers: systemAdminProcedure
        .output(
            z.array(
                z.object({
                    id: UserId.schema,
                    name: z.string(),
                    email: z.string(),
                    deletedAt: z.iso.datetime().nullable(),
                    purgeAt: z.iso.datetime().nullable(),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const users = await UserAccounts.listDeleted(ctx.prisma);
            return users.map((u) => ({
                ...u,
                id: UserId.schema.parse(u.id),
                deletedAt: u.deletedAt?.toISOString() ?? null,
                purgeAt: u.purgeAt?.toISOString() ?? null,
            }));
        }),

    listOrganizations: systemAdminProcedure.query(async ({ ctx }) => {
        const rows = await ctx.prisma.organization.findMany({
            select: {
                id: true,
                name: true,
                slug: true,
                logo: true,
                createdAt: true,
                configs: true,
                _count: { select: { users: { where: activeMember } } },
                users: {
                    where: { role: { contains: "owner" }, ...activeMember },
                    select: { role: true },
                },
            },
            orderBy: { createdAt: "asc" },
        });

        return {
            organizations: rows.map(({ _count, configs, users, ...o }) => ({
                ...o,
                memberCount: _count.users,
                ownerCount: users.filter((u) => OrganizationRole.includes(u.role, "owner")).length,
                enabledModules: Object.entries(OrganizationSettings.fromRecords(configs).modules)
                    .filter(([, v]) => v.enabled)
                    .map(([k]) => k as ModuleId),
            })),
        };
    }),

    listUsers: systemAdminProcedure.query(async ({ ctx }) => {
        // Deleted accounts live in the system Rubbish bin (`listDeletedUsers`) instead.
        const rows = await ctx.prisma.user.findMany({
            where: { status: { not: "Deleted" } },
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
     * Permanently delete an account from the system Rubbish bin, ahead of the auto-purge.
     * @throws TRPCError(BAD_REQUEST) if it isn't deleted, or it's now the sole owner of an org.
     */
    purgeUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            await UserAccounts.purge(systemServiceContext(ctx), input.userId);
            await revalidateOrganizationUser(input.userId);
        }),

    /** Recover an account from the system Rubbish bin; it signs in again from scratch. */
    recoverUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            await UserAccounts.recover(systemServiceContext(ctx), input.userId);
            await revalidateOrganizationUser(input.userId);
        }),

    /**
     * Promote a user to the global `admin` role, or demote them to `user`.
     *
     * Guards, in order: (a) you cannot change your own role; (b) demoting the last remaining
     * system administrator is refused (mirrors `deleteUser`'s last-admin guard). Promotion needs
     * no guard. A call that doesn't change the role returns early — no guard, no session churn.
     *
     * On a demotion (`role === "user"`) the target's `session` rows are deleted in the same
     * `$transaction` as the `user.update` — `session.cookieCache` lasts 5 minutes, so without
     * this a just-demoted admin keeps `systemAdmin` access until it expires (mirrors
     * `deleteUser`). Promotion is a plain `user.update` — nothing to atomically pair.
     *
     * The audit entry is user-scoped and owned by the subject (`ownerId: input.userId`), so it
     * cascades away if that user is later deleted.
     */
    setUserRole: systemAdminProcedure
        .input(z.object({ userId: UserId.schema, role: z.enum(["admin", "user"]) }))
        .mutation(async ({ ctx, input }) => {
            if (input.userId === ctx.auth.user.id) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "You cannot change your own role.",
                });
            }

            const target = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: { id: true, role: true },
            });
            if (!target) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `User ${input.userId} not found.`,
                });
            }

            // No admin-role transition: skip the last-admin guard and the session
            // revocation — a no-op update must not log the target out.
            const currentRole = target.role === "admin" ? "admin" : "user";
            if (currentRole === input.role) {
                return { id: target.id, role: input.role };
            }

            if (input.role === "user") {
                const otherAdmins = await ctx.prisma.user.count({
                    where: { role: "admin", id: { not: input.userId }, status: { not: "Deleted" } },
                });
                if (otherAdmins === 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot demote the last system administrator.",
                    });
                }

                const [updated] = await ctx.prisma.$transaction([
                    ctx.prisma.user.update({
                        where: { id: input.userId },
                        data: { role: input.role },
                    }),
                    ctx.prisma.session.deleteMany({ where: { userId: input.userId } }),
                    ctx.logEvent({
                        ownerId: input.userId,
                        action: "Update",
                        objectType: "User",
                        objectId: input.userId,
                        changes: diffObject({ role: currentRole }, { role: input.role }),
                        description: `Changed global role from ${currentRole} to ${input.role}`,
                    }),
                ]);

                return { id: updated.id, role: updated.role };
            }

            const [updated] = await ctx.prisma.$transaction([
                ctx.prisma.user.update({
                    where: { id: input.userId },
                    data: { role: input.role },
                }),
                ctx.logEvent({
                    ownerId: input.userId,
                    action: "Update",
                    objectType: "User",
                    objectId: input.userId,
                    changes: diffObject({ role: currentRole }, { role: input.role }),
                    description: `Changed global role from ${currentRole} to ${input.role}`,
                }),
            ]);

            return { id: updated.id, role: updated.role };
        }),

    /** Reused directly from `settingsRouter` — see `getOrganizationSettings` above. */
    updateOrganizationSettingsSlice: settingsRouter.updateOrganizationSettingsSlice,
});
