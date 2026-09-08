/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { flag } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";

/**
 * Feature flags backed by Vercel's hosted flags store. Each flag can carry a
 * different value per deployment environment (production / preview / development),
 * set in the Vercel dashboard or via `vercel flags enable <key> --environment <env>`.
 * The code only declares the flags; environment differentiation lives on the platform.
 */

export const exampleFlag = flag<boolean>({
    key: "example-flag",
    adapter: vercelAdapter(),
    defaultValue: false,
    description: "Placeholder flag — replace when the first real flag lands",
    options: [
        { value: true, label: "On" },
        { value: false, label: "Off" },
    ],
});
