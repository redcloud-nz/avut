/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { cache } from "react";

import { i3ModuleFlag, notesModuleFlag } from "@/lib/flags";
import { isModuleUsable, type ModuleFlagState } from "@/lib/module-flags";
import {
    moduleList,
    userModules,
    type OrganizationModuleId,
    type UserModuleId,
} from "@/lib/modules";
import type { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { requireOrganization } from "./organization-access";

/** Flag evaluators, keyed by module id. Modules absent here are always available. */
const MODULE_FLAG_EVALUATORS: Partial<Record<OrganizationModuleId, () => Promise<boolean>>> = {
    i3: i3ModuleFlag,
    notes: notesModuleFlag,
};

/**
 * Flag evaluators for user-scoped modules, keyed by module id. Modules absent here are always
 * available. Personal notes share the org Notes module's flag, so neither ships without the other.
 */
const USER_MODULE_FLAG_EVALUATORS: Partial<Record<UserModuleId, () => Promise<boolean>>> = {
    "user-notes": notesModuleFlag,
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

/**
 * Resolve every user-scoped module's flag state for the current deployment environment. User
 * modules have no per-user opt-in to layer this over (they're all `alwaysOn`), so a user module
 * is usable exactly when its entry here is `true`.
 *
 * Cached per request, like {@link resolveModuleFlags}. As there, flag evaluation uses
 * `Math.random()`, which prerendering rejects, so call it only after a request read (e.g.
 * `requireSession()`) has made the render dynamic.
 */
export const resolveUserModuleFlags = cache(async (): Promise<Record<UserModuleId, boolean>> => {
    const entries = await Promise.all(
        userModules.map(async ({ id }) => {
            const evaluate = USER_MODULE_FLAG_EVALUATORS[id];
            return [id, evaluate ? await evaluate() : true] as const;
        }),
    );

    return Object.fromEntries(entries) as Record<UserModuleId, boolean>;
});

/**
 * Whether `moduleId` is usable in the organization `slug`: its flag is on for this deployment and
 * the org has it enabled.
 *
 * For server pages and layouts under a module's client gate (`"use client"` layout that throws
 * `NotEnabledError`). Next renders a page in parallel with its layouts, so the gate can't stop the
 * page's own prefetches, D4H calls and queries. The page checks this first and returns `null`
 * (`generateMetadata`, `{}`), leaving the gate to throw: `describeError` recognises
 * `NotEnabledError` only when it's thrown on the client.
 */
export async function isOrganizationModuleUsable(
    slug: string,
    moduleId: keyof OrganizationSettings["modules"],
): Promise<boolean> {
    // Sequential: flag evaluation uses `Math.random()`, which prerendering rejects until the
    // session read in `requireOrganization` has made the render dynamic.
    const { settings } = await requireOrganization(slug);
    const moduleFlags = await resolveModuleFlags();

    return isModuleUsable(moduleFlags, moduleId, settings.modules[moduleId].enabled);
}
