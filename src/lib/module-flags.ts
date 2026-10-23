/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    Modules,
    requiredModuleOf,
    type OrganizationModuleDef,
    type OrganizationModuleId,
} from "@/lib/modules";
import type { OrganizationSettings } from "@/lib/schemas/organization-settings";

/**
 * Environment-level availability of every org-scoped module, keyed by id.
 *
 * A module is available in a deployment only when its Vercel flag is on for that
 * environment (production / preview / development). Modules without a flag are always
 * `true`. This is layered *in front of* the per-org `settings.modules.<id>.enabled`
 * opt-in — both must be true for a module to be usable.
 */
export type ModuleFlagState = Record<OrganizationModuleId, boolean>;

/** Org modules whose availability is gated by a Vercel flag. */
export const FLAGGED_MODULE_IDS = [
    "d4h-i3",
    "notes",
] as const satisfies readonly OrganizationModuleId[];

/**
 * Whether the organization has `moduleId` switched on in its settings, as a lookup for
 * {@link isModuleUsable}. Modules without a settings entry (`org-admin`) read as off here;
 * `isModuleUsable` handles `alwaysOn` itself.
 */
export function enabledInSettings(
    settings: OrganizationSettings,
): (moduleId: OrganizationModuleId) => boolean {
    return (moduleId) =>
        settings.modules[moduleId as keyof OrganizationSettings["modules"]]?.enabled === true;
}

/**
 * Whether an org-scoped module is usable: its Vercel flag isn't off for this deployment, the
 * organization has it on (or it's `alwaysOn`), and the module it `requires`, if any, is usable
 * too. The one rule `OrganizationClient.isModuleEnabled`, the server pages and the system-admin
 * screens, which sit outside any one organization, all apply.
 *
 * @param isEnabled Whether the organization has a module switched on in its settings. Takes a
 *     lookup rather than a boolean because the rule also reads the required module's setting.
 */
export function isModuleUsable(
    moduleFlags: ModuleFlagState,
    moduleId: OrganizationModuleId,
    isEnabled: (moduleId: OrganizationModuleId) => boolean,
): boolean {
    if (moduleFlags[moduleId] === false) return false;

    const moduleDef: OrganizationModuleDef = Modules[moduleId];
    if (moduleDef.alwaysOn !== true && !isEnabled(moduleId)) return false;

    const required = requiredModuleOf(moduleId);
    return required === undefined || isModuleUsable(moduleFlags, required, isEnabled);
}
