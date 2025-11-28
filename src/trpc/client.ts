/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import superjson from "superjson";

import { type QueryClient, isServer } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { makeQueryClient } from "./query-client";
import type { AppRouter, RouterInput, RouterOutput } from "./routers/_app";
