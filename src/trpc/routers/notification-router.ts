/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { Notification } from "@/lib/schemas/notification";
import prisma from "@/server/prisma";

import { authenticatedProcedure, createTrpcRouter } from "../init";

export const notificationsRouter = createTrpcRouter({
    getUserNotifications: authenticatedProcedure
        .output(z.array(Notification.schema))
        .query(async ({ ctx }) => {
            // Fetch all pending invitations for the user
            const invitations = await prisma.invitation.findMany({
                where: {
                    email: ctx.auth.user.email,
                    status: "pending",
                },
                include: { organization: true, user: true },
            });

            return invitations.map((invitation) => ({
                id: invitation.id,
                title: "Organization Invite",
                description: `${invitation.user.name} invited you to join ${invitation.organization.name}.`,
                path: `/personal/invitations/${invitation.id}`,
                date: invitation.createdAt,
            }));
        }),
});
