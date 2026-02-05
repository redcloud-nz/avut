/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTrpcRouter } from "../init";

import { d4hAccessTokensRouter } from "./d4h-access-tokens";
import { invitationsRouter } from "./invitations-router";
import { notificationsRouter } from "./notification-router";
import { organizationsRouter } from "./organizations-router";
import { personnelRouter } from "./personnel-router";
import { settingsRouter } from "./settings-router";
import { teamsRouter } from "./teams-router";

export const appRouter = createTrpcRouter({
    d4hAccessTokens: d4hAccessTokensRouter,
    invitations: invitationsRouter,
    notifications: notificationsRouter,
    organizations: organizationsRouter,
    personnel: personnelRouter,
    settings: settingsRouter,
    teams: teamsRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
