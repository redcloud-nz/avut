/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { AVUTConsoleLogger, AVUTLogger } from "@/lib/logger";

export function useLogger(module: string, component: string): AVUTLogger {
    return new AVUTConsoleLogger(`${module}/${component}`);
}
