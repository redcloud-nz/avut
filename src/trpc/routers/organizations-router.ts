/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import {
    OrganizationUserData,
    OrganizationUserId,
} from "@/lib/schemas/organization-member";
import { UserData } from "@/lib/schemas/user";
import { auth } from "@/server/auth";

import prisma from "@/server/prisma";

import { createTrpcRouter, organizationProcedure } from "../init";

export const organizationsRouter = createTrpcRouter({
    /**
     * Retrieves the organization details.
     * @param ctx The authenticated context.
     * @returns The organization object.
     * @throws TRPCError(NOT_FOUND) if the organization does not exist.
     */
    getOrganization: organizationProcedure().query(async ({ ctx }) => {
        const organization = await ctx.prisma.organization.findUnique({
            where: { id: ctx.organizationId },
        });

        if (!organization) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Organization not found",
            });
        }

        return organization;
    }),

    /**
     * Retrieves an organization user by ID.
     */
    getOrganizationUser: organizationProcedure()
        .input(
            z.object({
                organizationUserId: OrganizationUserId.schema,
            }),
        )
        .output(OrganizationUserData.schema.extend({ user: UserData.schema }))
        .query(async ({ ctx, input }) => {
            return findOrganizationUserById(
                ctx.organizationId,
                input.organizationUserId,
            );
        }),

    /**
     * List all invitations for an organization.
     *
     *
     */
    listOrganizationInvitations: organizationProcedure({
        invitation: ["create"],
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
     * List all users that have access to the organization.
     */
    listOrganizationUsers: organizationProcedure()
        .output(
            z.array(
                OrganizationUserData.schema.extend({ user: UserData.schema }),
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
                ...OrganizationUserData.fromRecord(member),
                user: UserData.schema.parse(member.user),
            }));
        }),

    /**
     * Remove a user from the organization.
     */
    removeOrganizationUser: organizationProcedure({
        member: ["delete"],
    })
        .input(
            z.object({
                organizationUserId: OrganizationUserId.schema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const organizationUser = await findOrganizationUserById(
                    ctx.organizationId,
                    input.organizationUserId,
                );

                await auth.api.removeMember({
                    headers: ctx.headers,
                    body: {
                        organizationId: ctx.organizationId,
                        memberIdOrEmail: input.organizationUserId,
                    },
                });

                await ctx.logEvent({
                    action: "Delete",
                    objectType: "OrganizationUser",
                    objectId: input.organizationUserId,
                    description: `Removed user (${organizationUser.user.id}, ${organizationUser.user.email}) from organization.`,
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
});

/**
 * Find an organization user by ID.
 * @param organizationId The organization ID.
 * @param organizationUserId The organization user ID.
 * @returns The organization user data with user info.
 * @throws TRPCError(NOT_FOUND) if the user is not found.
 */
async function findOrganizationUserById(
    organizationId: OrganizationId,
    organizationUserId: OrganizationUserId,
) {
    const member = await prisma.organizationUser.findUnique({
        where: {
            id: organizationUserId,
            organizationId: organizationId,
        },
        include: { user: true },
    });

    if (!member) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization user not found",
        });
    }

    return {
        ...OrganizationUserData.fromRecord(member),
        user: UserData.schema.parse(member.user),
    };
}
