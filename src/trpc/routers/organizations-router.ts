/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import { OrganizationMembershipData } from "@/lib/schemas/organization-member";
import { UserData, UserId } from "@/lib/schemas/user";

import { auth } from "@/server/auth";
import { revalidateOrganization } from "@/server/organization";
import prisma from "@/server/prisma";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

export const organizationsRouter = createTrpcRouter({
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
                    message: "Organization not found",
                });
            }

            return OrganizationData.fromRecord(organization);
        }),

    /**
     * List all invitations for an organization.
     *
     *
     */
    listOrganizationInvitations: organizationProcedure({
        invitation: ["view"],
    })
        .output(z.array(OrganizationInvitationData.schema))
        .query(async ({ ctx, input }) => {
            const invitations = await auth.api.listInvitations({
                query: {
                    organizationId: input.organizationId,
                },
                headers: ctx.headers,
            });

            return invitations.map((invitation) =>
                OrganizationInvitationData.fromRecord({
                    ...invitation,
                    teamId: invitation.teamId ?? null,
                }),
            );
        }),

    /**
     * List all users that are members of the organization.
     */
    listOrganizationMembers: organizationProcedure({ member: ["view"] })
        .output(
            z.array(
                OrganizationMembershipData.schema.extend({
                    user: UserData.schema,
                }),
            ),
        )

        .query(async ({ ctx, input }) => {
            const { members } = await auth.api.listMembers({
                query: {
                    organizationId: input.organizationId,
                },
                headers: ctx.headers,
            });

            return members.map((member) => ({
                ...OrganizationMembershipData.fromRecord(member),
                user: UserData.schema.parse(member.user),
            }));
        }),

    /**
     * Remove a user from the organization.
     */
    removeOrganizationMembership: organizationProcedure({
        member: ["delete"],
    })
        .input(
            z.object({
                userId: UserId.schema,
            }),
        )
        .mutation(async ({ ctx, input: { userId } }) => {
            try {
                const organizationMembership =
                    await findOrganizationMembershipById(
                        ctx.organizationId,
                        userId,
                    );

                await auth.api.removeMember({
                    headers: ctx.headers,
                    body: {
                        organizationId: ctx.organizationId,
                        memberIdOrEmail: organizationMembership.id,
                    },
                });

                await ctx.logEvent({
                    action: "Delete",
                    objectType: "OrganizationMembership",
                    objectId: organizationMembership.id,
                    description: `Removed user (${organizationMembership.user.id}, ${organizationMembership.user.email}) from organization.`,
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
                headers: ctx.headers,
                body: {
                    organizationId: ctx.organizationId,
                    data: {
                        slug: update.slug,
                        name: update.name,
                    },
                },
            });

            const changes = diffObject(
                OrganizationData.modifiableSchema.parse(existing),
                update,
            );

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

/**
 * Find an organization membership by ID.
 * @param organizationId The organization ID.
 * @param userId The user ID.
 * @returns The organization membership data with user info.
 * @throws TRPCError(NOT_FOUND) if the membership is not found.
 */
async function findOrganizationMembershipById(
    organizationId: OrganizationId,
    userId: UserId,
) {
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

    return {
        ...OrganizationMembershipData.fromRecord(membership),
        user: UserData.schema.parse(membership.user),
    };
}
