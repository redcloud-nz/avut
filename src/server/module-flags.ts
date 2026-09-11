/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { cache } from "react";

import { i3ModuleFlag, notesModuleFlag } from "@/lib/flags";
import type { ModuleFlagState } from "@/lib/module-flags";
import { moduleList, type OrganizationModuleId } from "@/lib/modules";

/** Flag evaluators, keyed by module id. Modules absent here are always available. */
const MODULE_FLAG_EVALUATORS: Partial<Record<OrganizationModuleId, () => Promise<boolean>>> = {
    i3: i3ModuleFlag,
    notes: notesModuleFlag,
};

/**
 * Resolve every org-scoped module's flag state for the current deployment environment.
 *
 * Cached per request — the values are fixed for the lifetime of a deployment, so repeated
 * calls within a request (layout + dashboard + nav data) share one evaluation.
 */
export const resolveModuleFlags = cache(async (): Promise<ModuleFlagState> => {
    const ids = moduleList
        .filter((m) => m.scope === "organization")
        .map((m) => m.id as OrganizationModuleId);

    const entries = await Promise.all(
        ids.map(async (id) => {
            const evaluate = MODULE_FLAG_EVALUATORS[id];
            return [id, evaluate ? await evaluate() : true] as const;
        }),
    );

    return Object.fromEntries(entries) as ModuleFlagState;
});
