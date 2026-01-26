/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import {
    OrganizationMemberData,
    OrganizationMemberId,
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
    getOrganization: organizationProcedure().query(async ({ ctx, input }) => {
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
     * Retrieves an organization member by ID.
     */
    getOrganizationMember: organizationProcedure()
        .input(
            z.object({
                organizationMemberId: OrganizationMemberId.schema,
            }),
        )
        .output(OrganizationMemberData.schema.extend({ user: UserData.schema }))
        .query(async ({ ctx, input }) => {
            return findOrganizationMemberById(
                ctx.organizationId,
                input.organizationMemberId,
            );
        }),

    /**
     * List all invitations for an organization.
     */
    listOrganizationInvitations: organizationProcedure()
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
     * List all members of an organization.
     */
    listOrganizationMembers: organizationProcedure()
        .output(
            z.array(
                OrganizationMemberData.schema.extend({ user: UserData.schema }),
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
                ...OrganizationMemberData.fromRecord(member),
                user: UserData.schema.parse(member.user),
            }));
        }),

    /**
     * Remove a member from the organization.
     */
    removeOrganizationMember: organizationProcedure({
        member: ["delete"],
    })
        .input(
            z.object({
                organizationMemberId: OrganizationMemberId.schema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            try {
                const organizationMember = await findOrganizationMemberById(
                    ctx.organizationId,
                    input.organizationMemberId,
                );

                await auth.api.removeMember({
                    headers: ctx.headers,
                    body: {
                        organizationId: ctx.organizationId,
                        memberIdOrEmail: input.organizationMemberId,
                    },
                });

                await ctx.logEvent({
                    action: "Delete",
                    objectType: "OrganizationMember",
                    objectId: input.organizationMemberId,
                    description: `Removed user (${organizationMember.user.id}, ${organizationMember.user.email}) from organization.`,
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
 * Find an organization member by ID.
 * @param organizationId The organization ID.
 * @param organizationMemberId The organization member ID.
 * @returns The organization member data with user info.
 * @throws TRPCError(NOT_FOUND) if the member is not found.
 */
async function findOrganizationMemberById(
    organizationId: OrganizationId,
    organizationMemberId: OrganizationMemberId,
) {
    const member = await prisma.organizationMember.findUnique({
        where: {
            id: organizationMemberId,
            organizationId: organizationId,
        },
        include: { user: true },
    });

    if (!member) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization member not found",
        });
    }

    return {
        ...OrganizationMemberData.fromRecord(member),
        user: UserData.schema.parse(member.user),
    };
}
