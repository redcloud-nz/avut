/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { flag } from "flags/next";
import { edgeConfigAdapter } from "@flags-sdk/edge-config";

export const objectTagsFeatureFlag = flag({
    key: "object-tags-enabled",
    defaultValue: false,
    adapter: edgeConfigAdapter(),
});

// Module availability flags

export const availabilityModuleFlag = flag<boolean>({
    key: "availability-module",
    defaultValue: false,
    adapter: edgeConfigAdapter(),
});

export const checklistsModuleFlag = flag<boolean>({
    key: "checklists-module",
    defaultValue: false,
    adapter: edgeConfigAdapter(),
});

export const d4hViewsModuleFlag = flag<boolean>({
    key: "d4h-views-module",
    defaultValue: false,
    adapter: edgeConfigAdapter(),
});

export const fogModuleFlag = flag<boolean>({
    key: "fog-module",
    defaultValue: false,
    adapter: edgeConfigAdapter(),
});

export const notesModuleFlag = flag<boolean>({
    key: "notes-module",
    defaultValue: false,
    adapter: edgeConfigAdapter(),
});
