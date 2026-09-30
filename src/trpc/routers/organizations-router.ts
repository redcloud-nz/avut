/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { diffObject } from "@/lib/diff";
import type { ModuleId } from "@/lib/modules";
import {
    grantableRoleSchema,
    hasOwnerRole,
    parseStoredRoles,
    roleCovers,
    roleSchema,
} from "@/lib/permissions";
import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { OrganizationUserId } from "@/lib/schemas/organization-user";
import { UserId } from "@/lib/schemas/user";
import { auth, type AuthOrganizationMember } from "@/server/auth";
import { revalidateOrganization } from "@/server/cache/organization";
import { getOrganizationUserRoles } from "@/server/cache/organization-user";
import { revalidateOrganizationUser } from "@/server/cache/organization-user-revalidate";

import { createTrpcRouter, organizationProcedure, systemAdminProcedure } from "../init";
import { Messages } from "../messages";

/** A membership whose account isn't in the Rubbish bin — the row is kept for recovery. */
const activeMember = { user: { status: { not: "Deleted" as const } } };

/**
 * The caller's organization's membership row for `userId`, skipping a Deleted (Rubbish bin)
 * account.
 * @throws TRPCError(NOT_FOUND) if the user isn't an active member.
 */
async function requireActiveMembership(
    ctx: { prisma: PrismaClient; organizationId: OrganizationId },
    userId: UserId,
) {
    const membership = await ctx.prisma.organizationUser.findFirst({
        where: { organizationId: ctx.organizationId, userId, ...activeMember },
        select: { id: true, role: true },
    });
    if (!membership) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "That user is not a member of this organisation.",
        });
    }
    return membership;
}

/**
 * Throws `NOT_FOUND` if the user does not exist (surfaces a clear error before an FK violation),
 * or is in the system Rubbish bin — a deleted account can't be given a new membership.
 */
async function assertUserExists(prisma: Pick<PrismaClient, "user">, userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true },
    });
    if (!user || user.status === "Deleted") {
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
     * Retrieves the calling user's role(s) within the organization, for client-side
     * permission checks (see `Protect`, `useOrganization`).
     */
    getMyRoles: organizationProcedure({ organization: ["view"] })
        .output(z.array(roleSchema))
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
     * Site-wide lookup of any organization by ID, for the system-admin console — unlike
     * `getOrganization`, the caller need not belong to it.
     */
    getOrganizationAsAdmin: systemAdminProcedure
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
                            providerCredentials: { where: { provider: "D4H" } },
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
                d4hTokenCount: org._count.providerCredentials,
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
     * Grant one role to an existing member, leaving the rest of their role set untouched. Gated
     * per role by `roleGrant` rather than `member: ["update"]`, so a module admin can hand out
     * the roles it covers (e.g. `skills-admin` → `skills-assessor`) without being able to edit
     * anything else about a membership. Granting a role the member already holds is a no-op.
     */
    grantMemberRole: organizationProcedure()
        .input(z.object({ userId: UserId.schema, role: grantableRoleSchema }))
        .mutation(async ({ ctx, input }) => {
            await ctx.hasPermission(ctx.organizationId, { roleGrant: [input.role] });

            const membership = await requireActiveMembership(ctx, input.userId);
            if (OrganizationRole.includes(membership.role, input.role)) {
                return { id: membership.id };
            }

            const role = [...membership.role.split(",").filter(Boolean), input.role].join(",");

            await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.update({
                    where: { id: membership.id },
                    data: { role },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "OrganizationMembership",
                    objectId: membership.id,
                    changes: [],
                    description: `Granted ${OrganizationRole.displayNames[input.role]} to user ${input.userId}`,
                }),
            ]);

            await revalidateOrganizationUser(input.userId);

            return { id: membership.id };
        }),

    /**
     * Lists every member of the organization, shaped like Better Auth's own
     * `authClient.organization.listMembers` — a plain Prisma read of the same
     * `organization_users` table Better Auth's organization plugin already writes to.
     */
    listMembers: organizationProcedure({ member: ["view"] }).query(
        async ({ ctx }): Promise<AuthOrganizationMember[]> => {
            const members = await ctx.prisma.organizationUser.findMany({
                where: { organizationId: ctx.organizationId },
                include: { user: { select: { id: true, name: true, email: true, image: true } } },
            });

            return members.map((member) => ({
                id: member.id,
                organizationId: member.organizationId,
                userId: member.userId,
                // Stored comma-joined ("member,i3-editor") for a multi-role membership — Better
                // Auth's own inferred type claims a single literal role, same as it already did
                // when this came straight from `authClient.organization.listMembers`.
                role: member.role as AuthOrganizationMember["role"],
                createdAt: member.createdAt,
                personId: member.personId ?? undefined,
                user: { ...member.user, image: member.user.image ?? undefined },
            }));
        },
    ),

    /**
     * Lists the organization's members for granting or revoking `role` — only what the grant
     * page needs, since a caller holding `roleGrant` alone (e.g. `skills-admin`) has no
     * `member: ["view"]` and shouldn't see anyone's full role set. `coveredBy` names another role
     * the member holds that already includes `role`, which makes granting it redundant.
     */
    listMembersForRoleGrant: organizationProcedure()
        .input(z.object({ role: grantableRoleSchema }))
        .query(async ({ ctx, input }) => {
            await ctx.hasPermission(ctx.organizationId, { roleGrant: [input.role] });

            const members = await ctx.prisma.organizationUser.findMany({
                where: { organizationId: ctx.organizationId, ...activeMember },
                select: {
                    userId: true,
                    role: true,
                    personId: true,
                    user: { select: { name: true, email: true } },
                },
            });

            return members
                .map((member) => {
                    const roles = parseStoredRoles(member.role);
                    return {
                        userId: member.userId,
                        name: member.user.name,
                        email: member.user.email,
                        personId: member.personId,
                        holdsRole: roles.includes(input.role),
                        coveredBy:
                            roles.find(
                                (other) => other !== input.role && roleCovers(other, input.role),
                            ) ?? null,
                        // Revoking a member's only role would leave the membership empty.
                        isOnlyRole: roles.length === 1 && roles[0] === input.role,
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));
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
                ownerCount: users.filter((u) => hasOwnerRole(u.role)).length,
                enabledModules: Object.entries(OrganizationSettings.fromRecords(configs).modules)
                    .filter(([, v]) => v.enabled)
                    .map(([k]) => k as ModuleId),
            })),
        };
    }),

    /**
     * Grant a member ownership of the organization, in addition to whatever other roles they
     * already hold — `owner` is orthogonal to the flat role set, not exclusive with it. Only an
     * existing owner holds `member: ["owner"]`.
     *
     * `allowSystemAdmin` is the way back for an organization left with no owner: nobody inside
     * it holds `member: ["owner"]` any more, so a system admin appoints one.
     */
    makeOwner: organizationProcedure({ member: ["owner"] }, { allowSystemAdmin: true })
        .input(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            const membership = await ctx.prisma.organizationUser.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    userId: input.userId,
                    // A Deleted (Rubbish bin) account can't be appointed the recovery owner.
                    user: { status: { not: "Deleted" } },
                },
                select: { id: true, role: true },
            });
            if (!membership) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "That user is not a member of this organisation.",
                });
            }

            if (hasOwnerRole(membership.role)) {
                return { id: membership.id };
            }

            const role = ["owner", ...membership.role.split(",").filter(Boolean)].join(",");

            await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.update({
                    where: { id: membership.id },
                    data: { role },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "OrganizationMembership",
                    objectId: membership.id,
                    changes: [],
                    description: `Made user ${input.userId} an owner`,
                }),
            ]);

            await revalidateOrganizationUser(input.userId);

            return { id: membership.id };
        }),

    /**
     * Remove a member from the organization. Only an owner (or a system admin) may remove a
     * member who holds `owner`. Removing the last owner is allowed — the dialog warns, and a
     * system admin can make someone an owner again (`makeOwner`).
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

            // `member: ["delete"]` alone doesn't reach an owner — an admin can't remove one.
            if (hasOwnerRole(membership.role) && !ctx.isSystemAdmin) {
                await ctx.hasPermission(ctx.organizationId, { member: ["owner"] });
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
     * Strip ownership from a member — the target must not be the caller (an owner cannot
     * remove their own ownership; only a different owner can). Only an existing owner holds
     * `member: ["owner"]`.
     */
    removeOwner: organizationProcedure({ member: ["owner"] })
        .input(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            if (input.userId === ctx.userId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "You cannot remove your own ownership — ask another owner to.",
                });
            }

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

            if (!hasOwnerRole(membership.role)) {
                return { id: membership.id };
            }

            const role = membership.role
                .split(",")
                .filter((r) => r !== "owner")
                .join(",");

            // No last-owner check: the caller is an owner and can't target themselves, but two owners
            // removing each other concurrently can still leave the org ownerless. That's allowed; a
            // system admin recovers it with makeOwner.
            await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.update({
                    where: { id: membership.id },
                    data: { role },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "OrganizationMembership",
                    objectId: membership.id,
                    changes: [],
                    description: `Removed owner status from user ${input.userId}`,
                }),
            ]);

            await revalidateOrganizationUser(input.userId);

            return { id: membership.id };
        }),

    /**
     * Revoke one role from an existing member — the reciprocal of `grantMemberRole`, under the
     * same `roleGrant` permission. Revoking a role the member doesn't hold is a no-op; revoking
     * their only role is refused, since a membership always holds at least one (an admin
     * removes the member instead).
     */
    revokeMemberRole: organizationProcedure()
        .input(z.object({ userId: UserId.schema, role: grantableRoleSchema }))
        .mutation(async ({ ctx, input }) => {
            await ctx.hasPermission(ctx.organizationId, { roleGrant: [input.role] });

            const membership = await requireActiveMembership(ctx, input.userId);
            if (!OrganizationRole.includes(membership.role, input.role)) {
                return { id: membership.id };
            }

            const remaining = membership.role
                .split(",")
                .filter((role) => role !== "" && role !== input.role);
            if (remaining.length === 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `${OrganizationRole.displayNames[input.role]} is this member's only role, so it can't be revoked.`,
                });
            }
            const role = remaining.join(",");

            await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.update({
                    where: { id: membership.id },
                    data: { role },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "OrganizationMembership",
                    objectId: membership.id,
                    changes: [],
                    description: `Revoked ${OrganizationRole.displayNames[input.role]} from user ${input.userId}`,
                }),
            ]);

            await revalidateOrganizationUser(input.userId);

            return { id: membership.id };
        }),

    /**
     * Replace a member's non-owner roles within an organization — a freely-combinable set with
     * at least one role. Ownership is granted/revoked separately (`makeOwner`/`removeOwner`), so
     * an existing `owner` grant is always preserved untouched.
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

            // Ownership is out-of-band here — preserve it if the member already has it.
            const role = hasOwnerRole(membership.role)
                ? ["owner", ...input.roles].join(",")
                : OrganizationRole.serialize(input.roles);

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
                roles: OrganizationRole.schema
                    .array()
                    .parse(role.split(",").filter((r) => r !== "owner")),
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
