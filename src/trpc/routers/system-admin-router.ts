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
import { revalidateOrganizationSettings } from "@/server/organization-settings-cache";
import {
    readOrganizationSettings,
    writeOrganizationSettings,
} from "@/server/organization-settings-store";

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
 * Throws `NOT_FOUND` if the organization does not exist. Settings resolve from defaults when no
 * config rows exist, so without this an unknown id would silently look like a valid, untouched
 * organization.
 */
async function assertOrganizationExists(
    prisma: Pick<PrismaClient, "organization">,
    organizationId: string,
) {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
    });
    if (!org) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `Organization ${organizationId} not found.`,
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
            await assertOrganizationExists(ctx.prisma, input.organizationId);
            await assertUserExists(ctx.prisma, input.userId);

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

            const organizationId = OrganizationId.create();
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
     * NOTE: global user-level actions have no audit log home yet — `organizationLogEntry` requires
     * an `organizationId` and this action has no org context. See the deferred "system audit log"
     * issue (#78); Phase 11 / #14 has the same gap.
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

            const target = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: { id: true },
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

            const ownerships = await ctx.prisma.organizationUser.findMany({
                where: { userId: input.userId, role: "owner" },
                select: { organizationId: true },
            });
            const ownedOrgIds = ownerships.map((o) => o.organizationId);

            // One query for every owner row across the orgs this user owns; the target is
            // an owner of each, so an org with a single owner row is one they solely own.
            const soleOwnerOrgIds: string[] = [];
            if (ownedOrgIds.length > 0) {
                const ownerRows = await ctx.prisma.organizationUser.findMany({
                    where: { organizationId: { in: ownedOrgIds }, role: "owner" },
                    select: { organizationId: true },
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
                ctx.prisma.teamUser.deleteMany({ where: { userId: input.userId } }),
                ctx.prisma.organizationUser.deleteMany({ where: { userId: input.userId } }),
                ctx.prisma.organizationInvitation.deleteMany({
                    where: { inviterId: input.userId },
                }),
                ctx.prisma.d4hAccessToken.deleteMany({ where: { userId: input.userId } }),
                ctx.prisma.note.deleteMany({ where: { authorId: input.userId } }),
                ctx.prisma.organizationLogEntry.deleteMany({ where: { userId: input.userId } }),
                ctx.prisma.user.delete({ where: { id: input.userId } }),
            ]);

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
     * Resolve an organization's settings, keyed purely on `organizationId` — no membership in
     * that organization is required (or consulted).
     *
     * Reads through `readOrganizationSettings`, which layers the stored `OrganizationConfig`
     * rows over `OrganizationSettings.default()`. That makes a config-less organization (the
     * normal org-creation path seeds no rows) and a fully materialised one (`createOrganization`
     * above seeds every default leaf) resolve identically.
     */
    getOrganizationSettings: systemAdminProcedure
        .input(z.object({ organizationId: OrganizationId.schema }))
        .output(OrganizationSettings.schema)
        .query(async ({ ctx, input }) => {
            await assertOrganizationExists(ctx.prisma, input.organizationId);

            return await readOrganizationSettings(ctx.prisma, input.organizationId);
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

            // Only an owner removal can orphan the org — skip the owners query otherwise.
            if (membership.role === "owner") {
                await assertNotLastOwner(ctx.prisma, input.organizationId, input.userId);
            }

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

            // The guard only matters when demoting an existing owner to a non-owner role.
            if (membership.role === "owner" && input.role !== "owner") {
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

    /**
     * Promote a user to the global `admin` role, or demote them to `user`.
     *
     * Guards, in order: (a) you cannot change your own role; (b) demoting the last remaining
     * system administrator is refused (mirrors `deleteUser`'s last-admin guard). Promotion needs
     * no guard.
     *
     * NOTE: global role changes are not yet audited — see #78 (system audit log). Same gap as
     * `deleteUser`: `organizationLogEntry` requires an `organizationId` and this action has none.
     * A plain `user.update` is enough here — there is nothing to atomically pair, so no
     * `$transaction`.
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
                select: { id: true },
            });
            if (!target) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `User ${input.userId} not found.`,
                });
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
            }

            const updated = await ctx.prisma.user.update({
                where: { id: input.userId },
                data: { role: input.role },
            });

            return { id: updated.id, role: updated.role };
        }),

    /**
     * Replace an organization's settings, without requiring membership in it.
     *
     * The incoming `settings` are validated against `OrganizationSettings.schema` (by the input
     * schema, and again inside `writeOrganizationSettings` before anything is written), and only
     * the `OrganizationConfig` leaves whose value actually changed are upserted — so this behaves
     * identically for a config-less and a fully materialised organization.
     *
     * `systemAdminProcedure` has no `ctx.logEvent` (that is org-scoped), so the audit entry is
     * written directly into the same `$transaction` as the config writes — see
     * `createOrganization`.
     */
    updateOrganizationSettings: systemAdminProcedure
        .input(
            z.object({
                organizationId: OrganizationId.schema,
                settings: OrganizationSettings.schema,
            }),
        )
        .output(OrganizationSettings.schema)
        .mutation(async ({ ctx, input }) => {
            await assertOrganizationExists(ctx.prisma, input.organizationId);

            const userId = ctx.auth.user.id;

            const settings = await writeOrganizationSettings(
                ctx.prisma,
                input.organizationId,
                input.settings,
                (changes) =>
                    ctx.prisma.organizationLogEntry.create({
                        data: {
                            id: nanoId16(),
                            organizationId: input.organizationId,
                            userId,
                            action: "Update",
                            objectType: "OrganizationSettings",
                            objectId: input.organizationId,
                            changes: changes as object[],
                            description: "Updated settings from system administration",
                        },
                    }),
            );

            // Same tag the in-org settings path invalidates, so in-org UI reflects the change.
            await revalidateOrganizationSettings(input.organizationId);

            return settings;
        }),
});
