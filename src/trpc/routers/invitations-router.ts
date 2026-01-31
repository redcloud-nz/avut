/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { OrganizationData } from "@/lib/schemas/organization";
import {
    InvitationId,
    OrganizationInvitationData,
} from "@/lib/schemas/organization-invitation";
import { UserData } from "@/lib/schemas/user";
import { auth } from "@/server/auth";
import prisma from "@/server/prisma";

import { authenticatedProcedure, createTrpcRouter } from "../init";

/**
 * Router for handling a users invitations.
 */
export const invitationsRouter = createTrpcRouter({
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
            const invitation = await prisma.invitation.findUnique({
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
            const invitation = await prisma.invitation.findUnique({
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
            const invitations = await prisma.invitation.findMany({
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
            const invitation = await prisma.invitation.findUnique({
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
});
