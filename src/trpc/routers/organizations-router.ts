/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { headers as nextHeaders } from "next/headers";
import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import { OrganizationMemberData } from "@/lib/schemas/organization-member";
import { UserData } from "@/lib/schemas/user";
import { auth } from "@/server/auth";

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
                organizationMemberId: OrganizationMemberData.schema.shape.id,
            }),
        )
        .output(OrganizationMemberData.schema.extend({ user: UserData.schema }))
        .query(async ({ ctx, input }) => {
            const member = await ctx.prisma.organizationMember.findUnique({
                where: {
                    id: input.organizationMemberId,
                    organizationId: ctx.organizationId,
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
                headers: await nextHeaders(),
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
                headers: await nextHeaders(),
            });

            return members.map((member) => ({
                ...OrganizationMemberData.fromRecord(member),
                user: UserData.schema.parse(member.user),
            }));
        }),
});
