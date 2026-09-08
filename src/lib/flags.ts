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

const booleanOptions = [
    { value: true, label: "On" },
    { value: false, label: "Off" },
];

export const i3ModuleFlag = flag<boolean>({
    key: "i3-module",
    adapter: vercelAdapter(),
    defaultValue: false,
    description: "Is the i3 module available.",
    options: booleanOptions,
});

export const notesModuleFlag = flag<boolean>({
    key: "notes-module",
    adapter: vercelAdapter(),
    defaultValue: false,
    description: "Is the notes module available.",
    options: booleanOptions,
});

export const structuredDocumentsModuleFlag = flag<boolean>({
    key: "structured-documents-module",
    adapter: vercelAdapter(),
    defaultValue: false,
    description: "Is the structured documents module available.",
    options: booleanOptions,
});
