/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTrpcRouter } from "../init";

export const appRouter = createTrpcRouter({});

export type AppRouter = typeof appRouter;

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
