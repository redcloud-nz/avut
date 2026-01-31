/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { auth } from "@/server/auth";

import { authenticatedProcedure, createTrpcRouter } from "../init";

export const notificationsRouter = createTrpcRouter({
    getUserNotifications: authenticatedProcedure.query(async ({ ctx }) => {
        // Check if the user has any pending invitations.

        const invitations = await auth.api.listUserInvitations({
            query: {
                email: ctx.auth.user.email,
            },
        });
    }),
});
