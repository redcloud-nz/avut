/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { InvitationId, OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { OrganizationUser } from "@/lib/schemas/organization-user";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { UserData, UserId } from "@/lib/schemas/user";
import { auth } from "@/server/auth";
import prisma from "@/server/prisma";

import { FieldConflictError } from "../errors";
import { authenticatedProcedure, createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

/**
 * TRPC router for access control related operations, including managing organization invitations, memberships, and personnel access.
 */
export const accessControlRouter = createTrpcRouter({
    /**
     * Accept an organization invitation.
     *
     * @param ctx The authenticated context.
     * @param input The invitation ID to accept.
     * @returns True if the invitation was accepted successfully.
     * @throws TRPCError(NOT_FOUND) if the invitation does not exist, is not pending, or does not belong to the user.
     */
    acceptInvitation: authenticatedProcedure
        .input(
            z.object({
                invitationId: InvitationId.schema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const invitation = await ctx.prisma.organizationInvitation.findUnique({
                where: {
                    id: input.invitationId,
                    status: "pending",
                    email: ctx.auth.user.email,
                },
            });

            if (!invitation)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Invitation not found",
                });

            // Accept the invitation via the auth API.
            try {
                await auth.api.acceptInvitation({
                    body: {
                        invitationId: input.invitationId,
                    },
                    headers: ctx.headers,
                });
            } catch (error) {
                console.log("Error accepting invitation:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to accept invitation",
                });
            }
            return true;
        }),

    /**
     * Create a new organization invitation.
     *
     * @param ctx The authenticated context.
     * @param input The invitation data.
     * @returns The created invitation.
     */
    createInvitation: organizationProcedure({ invitation: ["create"] })
        .input(
            z.object({
                email: z.email(),
                roles: z.array(OrganizationRole.schema),
                personId: PersonId.schema,
            }),
        )
        .output(z.object({ created: z.object({ id: z.string(), email: z.string() }) }))
        .mutation(async ({ ctx, input }) => {
            // Check for an existing pending invitation
            const existingInvitation = await ctx.prisma.organizationInvitation.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    email: input.email,
                    status: "pending",
                },
            });

            if (existingInvitation)
                throw new TRPCError({
                    code: "CONFLICT",
                    cause: new FieldConflictError(
                        "email",
                        "An invitation has already been sent to this email.",
                    ),
                });

            // Check if a user with this email is already a member of the organization
            const existingUser = await ctx.prisma.organizationUser.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    user: {
                        email: input.email,
                    },
                },
            });

            if (existingUser)
                throw new TRPCError({
                    code: "CONFLICT",
                    cause: new FieldConflictError(
                        "email",
                        "A user with this email already exists in the organization.",
                    ),
                });

            const invitation = await auth.api.createInvitation({
                body: {
                    organizationId: ctx.organizationId,
                    email: input.email,
                    role: input.roles,
                    personId: input.personId,
                },
                headers: ctx.headers,
            });

            return {
                created: { id: invitation.id, email: invitation.email },
            };
        }),

    /**
     * Retrieves an invitation by ID.
     *
     * @param ctx The authenticated context.
     * @param input The invitation ID to retrieve.
     * @returns The invitation data.
     * @throws TRPCError(NOT_FOUND) if the invitation does not exist, is not pending, or does not belong to the user.
     */
    getInvitation: authenticatedProcedure
        .input(
            z.object({
                invitationId: InvitationId.schema,
            }),
        )
        .output(
            OrganizationInvitationData.schema.extend({
                inviter: UserData.schema.pick({
                    id: true,
                    name: true,
                    email: true,
                }),
                organization: OrganizationData.schema.pick({
                    id: true,
                    name: true,
                    slug: true,
                }),
            }),
        )
        .query(async ({ ctx, input }) => {
            const invitation = await ctx.prisma.organizationInvitation.findUnique({
                where: {
                    id: input.invitationId,
                    status: "pending",
                    email: ctx.auth.user.email,
                },
                include: { organization: true, user: true },
            });

            if (!invitation)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Invitation not found",
                });

            return {
                ...OrganizationInvitationData.fromRecord(invitation),
                inviter: UserData.schema
                    .pick({ id: true, name: true, email: true })
                    .parse(invitation.user),
                organization: OrganizationData.schema
                    .pick({ id: true, name: true, slug: true })
                    .parse(invitation.organization),
            };
        }),

    /**
     * Retrieves the personnel record linked to a user, if any.
     * @param ctx The authenticated context.
     * @param input The user ID to look up.
     * @returns The linked personnel record, or null if no link exists.
     * @throws TRPCError(NOT_FOUND) if the user does not exist or is not part of the organization.
     */
    getLinkedPerson: organizationProcedure({ member: ["view"], person: ["view"] })
        .input(z.object({ userId: UserId.schema }))
        .output(PersonData.schema.nullable())
        .query(async ({ ctx, input }) => {
            const user = await ctx.prisma.organizationUser.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    userId: input.userId,
                    personId: { not: null },
                },
                include: { person: true },
            });

            if (!user)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.userNotFound(input.userId),
                });

            return user?.person ? PersonData.fromRecord(user.person) : null;
        }),

    /**
     * Lists the personnel in the organization that have access along with their access status, roles, and linked user/invitation data if applicable.
     * This is used to manage access control for personnel, including those who have been invited but have not yet joined.
     * @param ctx The authenticated organization context.
     * @returns An array of personnel records with access details.
     */
    listPersonnelWithAccess: organizationProcedure({
        invitation: ["view"],
        member: ["view"],
        person: ["view"],
    })
        .output(
            z.array(
                z.discriminatedUnion("accessStatus", [
                    PersonData.schema.extend({
                        accessStatus: z.literal("None"),
                        roles: z.array(OrganizationRole.schema),
                        user: z.null(),
                        invitation: z.null(),
                    }),
                    PersonData.schema.extend({
                        accessStatus: z.literal("Invited"),
                        roles: z.array(OrganizationRole.schema),
                        user: z.null(),
                        invitation: OrganizationInvitationData.schema,
                    }),
                    PersonData.schema.extend({
                        accessStatus: z.literal("Joined"),
                        roles: z.array(OrganizationRole.schema),
                        user: OrganizationUser.schema,
                        invitation: z.null(),
                    }),
                ]),
            ),
        )
        .query(async ({ ctx }) => {
            const personnel = await ctx.prisma.person.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    status: "Active",
                },
                include: {
                    organizationUser: {
                        include: { user: true },
                    },
                    organizationInvitation: true,
                },
            });

            return personnel.map((person) => {
                const base = PersonData.fromRecord(person);
                const user = person.organizationUser;
                const invitation = person.organizationInvitation;

                if (user) {
                    return {
                        ...base,
                        accessStatus: "Joined" as const,
                        roles: user.role.split(",") as OrganizationRole[],
                        user: OrganizationUser.fromRecord(user.user, user),
                        invitation: null,
                    };
                }

                if (invitation) {
                    return {
                        ...base,
                        accessStatus: "Invited" as const,
                        roles: (invitation.role ?? "").split(",") as OrganizationRole[],
                        user: null,
                        invitation: OrganizationInvitationData.fromRecord(invitation),
                    };
                }

                return {
                    ...base,
                    accessStatus: "None" as const,
                    roles: [] as OrganizationRole[],
                    user: null,
                    invitation: null,
                };
            });
        }),

    /**
     * Lists all users in the organization that are not linked to any personnel record.
     * @param ctx The authenticated context.
     * @returns An array of unlinked user objects
     */
    listUnlinkedUsers: organizationProcedure({ person: ["view"] })
        .output(z.array(OrganizationUser.schema))
        .query(async ({ ctx }) => {
            const users = await ctx.prisma.organizationUser.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    personId: null,
                },
                include: { user: true },
            });

            return users.map((u) => OrganizationUser.fromRecord(u.user, u));
        }),

    listUserInvitations: authenticatedProcedure
        .output(
            z.array(
                OrganizationInvitationData.schema.extend({
                    inviter: UserData.schema.pick({
                        id: true,
                        name: true,
                        email: true,
                    }),
                    organization: OrganizationData.schema.pick({
                        id: true,
                        name: true,
                        slug: true,
                    }),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const invitations = await ctx.prisma.organizationInvitation.findMany({
                where: {
                    email: ctx.auth.user.email,
                },
                include: { organization: true, user: true },
            });

            return invitations.map((invitation) => ({
                ...OrganizationInvitationData.fromRecord(invitation),
                inviter: UserData.schema
                    .pick({ id: true, name: true, email: true })
                    .parse(invitation.user),
                organization: OrganizationData.schema
                    .pick({ id: true, name: true, slug: true })
                    .parse(invitation.organization),
            }));
        }),

    /**
     * Reject an organization invitation.
     *
     * @param ctx The authenticated context.
     * @param input The invitation ID to reject.
     * @returns True if the invitation was rejected successfully.
     * @throws TRPCError(NOT_FOUND) if the invitation does not exist, is not pending, or does not belong to the user.
     */
    rejectInvitation: authenticatedProcedure
        .input(
            z.object({
                invitationId: InvitationId.schema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const invitation = await ctx.prisma.organizationInvitation.findUnique({
                where: {
                    id: input.invitationId,
                    status: "pending",
                    email: ctx.auth.user.email,
                },
            });

            if (!invitation)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Invitation not found",
                });

            // Reject the invitation via the auth API.
            try {
                await auth.api.rejectInvitation({
                    body: {
                        invitationId: input.invitationId,
                    },
                    headers: ctx.headers,
                });
            } catch (error) {
                console.log("Error rejecting invitation:", error);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to reject invitation",
                });
            }
            return true;
        }),

    /**
     * Remove a user from the organization.
     */
    removeOrganizationUser: organizationProcedure({
        member: ["delete"],
    })
        .input(
            z.object({
                userId: UserId.schema,
            }),
        )
        .mutation(async ({ ctx, input: { userId } }) => {
            try {
                const orgUser = await findOrganizationUserById(ctx.organizationId, userId);

                await auth.api.removeMember({
                    headers: ctx.headers,
                    body: {
                        organizationId: ctx.organizationId,
                        memberIdOrEmail: orgUser.organizationUserId,
                    },
                });

                await ctx.logEvent({
                    action: "Delete",
                    objectType: "OrganizationMembership",
                    objectId: orgUser.organizationUserId,
                    description: `Removed user (${orgUser.userId}, ${orgUser.email}) from organization.`,
                });
            } catch (error) {
                console.error("Error removing organization member:", error);

                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to remove organization member",
                    cause: error,
                });
            }
        }),

    /**
     * Update the roles on a pending invitation by cancelling and re-creating it.
     *
     * @param ctx The authenticated organization context.
     * @param input The invitation ID and new roles.
     */
    updateInvitationRoles: organizationProcedure({ invitation: ["create"] })
        .input(
            z.object({
                invitationId: InvitationId.schema,
                roles: z.array(OrganizationRole.schema),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const invitation = await ctx.prisma.organizationInvitation.findUnique({
                where: { id: input.invitationId, organizationId: ctx.organizationId },
            });

            if (!invitation || invitation.status !== "pending")
                throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });

            await ctx.prisma.organizationInvitation.update({
                where: { id: input.invitationId },
                data: { role: input.roles.join(",") },
            });
        }),
});

/**
 * Find an organization membership by ID.
 * @param organizationId The organization ID.
 * @param userId The user ID.
 * @returns The organization user data with user info.
 * @throws TRPCError(NOT_FOUND) if the user is not found.
 */
async function findOrganizationUserById(
    organizationId: OrganizationId,
    userId: UserId,
): Promise<OrganizationUser> {
    const membership = await prisma.organizationUser.findUnique({
        where: {
            organizationId_userId: {
                organizationId,
                userId,
            },
        },
        include: { user: true },
    });

    if (!membership) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization membership not found for userId = " + userId,
        });
    }

    return OrganizationUser.fromRecord(membership.user, membership);
}
