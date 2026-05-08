/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTrpcRouter } from "../init";

import { accessControlRouter } from "./access-control";
import { d4hAccessTokensRouter } from "./d4h-access-tokens-router";
import { d4hApiRouter } from "./d4h-api-router";
import { formsRouter } from "./forms-router";
import { i3Router } from "./i3-router";
import { notificationsRouter } from "./notification-router";
import { organizationsRouter } from "./organizations-router";
import { personnelRouter } from "./personnel-router";
import { settingsRouter } from "./settings-router";
import { skillChecksRouter } from "./skill-checks-router";
import { skillsRouter } from "./skills-router";
import { skillPackageBuilderRouter } from "./skill-package-builder-router";
import { teamsRouter } from "./teams-router";

export const appRouter = createTrpcRouter({
    accessControl: accessControlRouter,
    d4hAccessTokens: d4hAccessTokensRouter,
    d4hApi: d4hApiRouter,
    forms: formsRouter,
    i3: i3Router,
    notifications: notificationsRouter,
    organizations: organizationsRouter,
    personnel: personnelRouter,
    settings: settingsRouter,
    skillChecks: skillChecksRouter,
    skillPackageBuilder: skillPackageBuilderRouter,
    skills: skillsRouter,
    teams: teamsRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
