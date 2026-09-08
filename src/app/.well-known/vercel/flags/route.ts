/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";

import * as flags from "@/lib/flags";

/**
 * Flags Explorer discovery endpoint. Exposes the app's flag definitions to the
 * Vercel Toolbar and dashboard. Access is verified against FLAGS_SECRET.
 */
export const GET = createFlagsDiscoveryEndpoint(async () => getProviderData(flags));
