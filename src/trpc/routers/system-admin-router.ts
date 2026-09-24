/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

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
import { prepareSkillPackageImport } from "@/server/skill-package-io";

import { assertOrganizationExists, createTrpcRouter, systemAdminProcedure } from "../init";

import { findOwnerMemberships } from "./organizations-router";
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

            const configRows = Object.entries(
                OrganizationSettings.flatten(OrganizationSettings.default()),
            ).map(([key, value]) => ({ organizationId, key, value }));

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
     * Hard-delete a user account and everything that hangs off it.
     *
     * Guards, in order: (a) you cannot delete your own account; (b) you cannot delete the last
     * remaining system administrator; (c) you cannot delete a user who is the sole `owner` of any
     * organization — the operator must transfer ownership (`setOrganizationMemberRole` /
     * `removeOrganizationMember`) or delete the organization first.
     *
     * Every FK into `User` in the schema is `onDelete: Cascade` or `SetNull`, so no migration is
     * needed — but the dependent rows are still cleared explicitly inside the `$transaction`
     * (mirroring the schema's referential actions) so the behaviour is pinned here and doesn't
     * silently depend on the database's cascade config.
     *
     * Log entries are deliberately *not* cleared here: `LogEntry.userId` is `SetNull` and
     * `LogEntry.ownerId` is `Cascade`, so the FKs already implement the policy — the user's own
     * log goes with them, their actions elsewhere survive, anonymised.
     *
     * The deletion's own entry is therefore `scope: "system"`, not user-scoped. A user-scoped
     * entry would carry `ownerId: input.userId`, which is `onDelete: Cascade` — it would be
     * inserted and cascaded away inside this same `$transaction`, giving it a zero-length
     * lifetime. A system-scoped entry has neither owner FK, so nothing can cascade it; the
     * subject is named by `objectId` and by the denormalized label in `description`, which is
     * what keeps it readable once the `User` row is gone.
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

            // `name`/`email` are read for the audit entry's description: the entry outlives
            // the `User` row, so the subject has to be denormalized into it here.
            // `formatActorLabel` is reused for the subject rather than the actor — it is the
            // one place the `Name <email>` form lives, and a second format would read oddly
            // next to `actorLabel` in the same log.
            const target = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: { id: true, name: true, email: true },
            });
            if (!target) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `User ${input.userId} not found.`,
                });
            }

            const otherAdmins = await ctx.prisma.user.count({
                where: { role: "admin", id: { not: input.userId } },
            });
            if (otherAdmins === 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Cannot delete the last system administrator.",
                });
            }

            const ownerships = await findOwnerMemberships(ctx.prisma, { userId: input.userId });
            const ownedOrgIds = ownerships.map((o) => o.organizationId);

            // One query for every owner row across the orgs this user owns; the target is
            // an owner of each, so an org with a single owner row is one they solely own.
            const soleOwnerOrgIds: string[] = [];
            if (ownedOrgIds.length > 0) {
                const ownerRows = await findOwnerMemberships(ctx.prisma, {
                    organizationId: { in: ownedOrgIds },
                });
                const ownerCountByOrg = new Map<string, number>();
                for (const { organizationId } of ownerRows) {
                    ownerCountByOrg.set(
                        organizationId,
                        (ownerCountByOrg.get(organizationId) ?? 0) + 1,
                    );
                }
                for (const orgId of ownedOrgIds) {
                    if ((ownerCountByOrg.get(orgId) ?? 0) <= 1) soleOwnerOrgIds.push(orgId);
                }
            }
            if (soleOwnerOrgIds.length > 0) {
                const orgs = await ctx.prisma.organization.findMany({
                    where: { id: { in: soleOwnerOrgIds } },
                    select: { name: true },
                });
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Cannot delete a user who is the sole owner of ${orgs
                        .map((o) => o.name)
                        .join(", ")}. Transfer ownership or delete the organization first.`,
                });
            }

            await ctx.prisma.$transaction([
                ctx.prisma.formInstance.updateMany({
                    where: { userId: input.userId },
                    data: { userId: null },
                }),
                ctx.prisma.session.deleteMany({ where: { userId: input.userId } }),
                ctx.prisma.account.deleteMany({ where: { userId: input.userId } }),
                ctx.prisma.organizationUser.deleteMany({ where: { userId: input.userId } }),
                ctx.prisma.organizationInvitation.deleteMany({
                    where: { inviterId: input.userId },
                }),
                ctx.prisma.d4HAccessToken.deleteMany({ where: { userId: input.userId } }),
                ctx.prisma.note.deleteMany({ where: { authorId: input.userId } }),
                ctx.logEvent({
                    scope: "system",
                    action: "Delete",
                    objectType: "User",
                    objectId: input.userId,
                    changes: [],
                    description: `Account ${formatActorLabel(target.name, target.email)} deleted by a system administrator`,
                }),
                ctx.prisma.user.delete({ where: { id: input.userId } }),
            ]);

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
     * Create-or-sync keyed on the record IDs in the envelope (see `prepareSkillPackageImport`):
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

            const { plan, writeItems } = await prepareSkillPackageImport(
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
                users: { where: { role: { contains: "owner" } }, select: { role: true } },
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
                    where: { role: "admin", id: { not: input.userId } },
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
    updateOrganizationSettings: settingsRouter.updateOrganizationSettings,
});
