/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import { createTrpcRouter } from "../init";

import { d4hAccessTokensRouter } from "./d4h-access-tokens-router";
import { d4hApiRouter } from "./d4h-api-router";
import { formsRouter } from "./forms-router";
import { i3Router } from "./i3-router";
import { invitationsRouter } from "./invitations-router";
import { notificationsRouter } from "./notification-router";
import { organizationsRouter } from "./organizations-router";
import { personnelRouter } from "./personnel-router";
import { settingsRouter } from "./settings-router";
import { skillCheckSessionsRouter } from "./skill-check-sessions-router";
import { skillChecksRouter } from "./skill-checks-router";
import { skillPackageBuilderRouter } from "./skill-package-builder-router";
import { skillPackageSubscriptionsRouter } from "./skill-package-subscriptions-router";
import { teamsRouter } from "./teams-router";
import { trashRouter } from "./trash-router";
import { userRouter } from "./user-router";
import { usersRouter } from "./users-router";

export const appRouter = createTrpcRouter({
    d4hAccessTokens: d4hAccessTokensRouter,
    d4hApi: d4hApiRouter,
    forms: formsRouter,
    i3: i3Router,
    invitations: invitationsRouter,
    notifications: notificationsRouter,
    organizations: organizationsRouter,
    personnel: personnelRouter,
    settings: settingsRouter,
    skillCheckSessions: skillCheckSessionsRouter,
    skillChecks: skillChecksRouter,
    skillPackageBuilder: skillPackageBuilderRouter,
    skillPackageSubscriptions: skillPackageSubscriptionsRouter,
    teams: teamsRouter,
    trash: trashRouter,
    user: userRouter,
    users: usersRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
