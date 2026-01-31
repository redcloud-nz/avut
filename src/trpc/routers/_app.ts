/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTrpcRouter } from "../init";

import { invitationsRouter } from "./invitations-router";
import { organizationsRouter } from "./organizations-router";
import { personnelRouter } from "./personnel-router";
import { settingsRouter } from "./settings-router";

export const appRouter = createTrpcRouter({
    invitations: invitationsRouter,
    organizations: organizationsRouter,
    personnel: personnelRouter,
    settings: settingsRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
